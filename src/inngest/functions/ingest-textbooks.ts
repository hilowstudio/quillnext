import { inngest } from "@/inngest/client";
import { db } from "@/server/db";
import { listOpenStaxBooks, assembleOpenStaxSections } from "@/lib/sources/openstax";
import { chunkText } from "@/lib/sources/text-processing";
import { stageTextbookChunks, embedPendingTextbookChunks } from "@/lib/utils/vector";

// Per-book chunk cap so one large textbook can't run away with embedding cost. ~1500 chunks ≈ a
// strong subject sample of even a big book; the per-section coverage is what matters for grounding.
const MAX_TEXTBOOK_CHUNKS = 1500;

/**
 * DISCOVERY / fan-out for the open-textbook corpus. User-triggered (`textbook/corpus.ingest`): it
 * lists the OpenStax catalog, upserts a TextbookDocument per book (keyed by cnx_id), and fans out one
 * `textbook/ingest.requested` per book that still needs ingesting. The corpus tables are GLOBAL /
 * context-free, so all writes use PLAIN db (no withTenant). The actual bulk run is a deliberate,
 * cost-aware operation — this just enqueues it.
 */
export const ingestTextbookCorpus = inngest.createFunction(
    { id: "ingest-textbook-corpus", retries: 1, concurrency: { limit: 1 } },
    { event: "textbook/corpus.ingest" },
    async ({ event, step }) => {
        const force = event.data?.force === true;

        const books = await step.run("list-catalog", async () => listOpenStaxBooks());
        if (books.length === 0) return { discovered: 0, queued: 0 };

        // Upsert one document per catalog book; collect those that still need ingesting.
        const queued = await step.run("upsert-docs", async () => {
            const toIngest: string[] = [];
            for (const b of books) {
                const existing = await db.textbookDocument.findUnique({ where: { cnxId: b.cnxId } });
                if (existing?.status === "INGESTED" && !force) continue; // already done
                await db.textbookDocument.upsert({
                    where: { cnxId: b.cnxId },
                    create: {
                        source: "openstax",
                        cnxId: b.cnxId,
                        title: b.title,
                        subject: b.subject,
                        category: b.category,
                        status: "PENDING",
                    },
                    update: {
                        title: b.title,
                        subject: b.subject,
                        category: b.category,
                        ...(force ? { status: "PENDING" } : {}),
                    },
                });
                toIngest.push(b.cnxId);
            }
            return toIngest;
        });

        if (queued.length > 0) {
            await step.sendEvent(
                "fan-out",
                queued.map((cnxId) => ({ name: "textbook/ingest.requested" as const, data: { cnxId } })),
            );
        }

        return { discovered: books.length, queued: queued.length };
    },
);

/**
 * Per-book OPEN-TEXTBOOK ingestion. Assembles the book's content sections from the OpenStax content
 * API, chunks them, and embeds them into the GLOBAL textbook_chunks corpus tagged with the book's
 * subject/category. Split into STAGE → EMBED (memoized batches) → MARK, like the book full-text
 * worker, so each Inngest step stays under the 60s Vercel ceiling and a kill/replay resumes. Global
 * tables → PLAIN db. Best-effort throughout; a failure marks the document, never crashes the corpus.
 */
export const ingestTextbook = inngest.createFunction(
    {
        id: "ingest-textbook",
        retries: 3,
        concurrency: { limit: 3 }, // gentle on the embedding provider during a bulk run
        onFailure: async ({ event }) => {
            const cnxId = (event as any)?.data?.event?.data?.cnxId as string | undefined;
            if (cnxId) {
                await db.textbookDocument
                    .update({ where: { cnxId }, data: { status: "UNAVAILABLE" } })
                    .catch((e) => console.error("[ingest-textbook onFailure] mark UNAVAILABLE failed", e));
            }
        },
    },
    { event: "textbook/ingest.requested" },
    async ({ event, step }) => {
        const { cnxId } = event.data;

        const doc = await step.run("load-doc", async () => {
            return db.textbookDocument.findUnique({
                where: { cnxId },
                select: { id: true, subject: true, category: true },
            });
        });
        if (!doc) return { skipped: true, reason: "no-document" };

        // 1. STAGE: assemble + chunk the sections, persist content-only rows (vectors come next).
        //    No try/catch swallow: a real failure (assembleOpenStaxSections is fail-safe; stage-
        //    TextbookChunks THROWS on DB error) propagates → Inngest retries → onFailure marks the
        //    doc UNAVAILABLE. Deterministic empties (no sections / no usable chunk text) mark
        //    UNAVAILABLE here so the doc never lingers in PENDING.
        const staged = await step.run("stage", async () => {
            const sections = await assembleOpenStaxSections(cnxId);
            if (sections.length === 0) {
                await db.textbookDocument.update({
                    where: { id: doc.id },
                    data: { status: "UNAVAILABLE" },
                });
                return { staged: 0, reason: "no-sections" };
            }

            const chunks: { sectionTitle: string | null; content: string }[] = [];
            for (const section of sections) {
                if (chunks.length >= MAX_TEXTBOOK_CHUNKS) break;
                for (const content of chunkText(section.text)) {
                    if (chunks.length >= MAX_TEXTBOOK_CHUNKS) break;
                    chunks.push({ sectionTitle: section.title, content });
                }
            }

            const count = await stageTextbookChunks(
                doc.id,
                { subject: doc.subject, category: doc.category },
                chunks,
            );
            if (count === 0) {
                await db.textbookDocument.update({
                    where: { id: doc.id },
                    data: { status: "UNAVAILABLE" },
                });
                return { staged: 0, reason: "no-chunks" };
            }

            await db.textbookDocument.update({
                where: { id: doc.id },
                data: { status: "INGESTING", chunkCount: count },
            });
            return { staged: count };
        });

        if (staged.staged > 0) {
            // 2. EMBED the staged chunks in memoized batches (each its own bounded invocation).
            const EMBED_BATCH = 200;
            const numBatches = Math.ceil(staged.staged / EMBED_BATCH);
            for (let i = 0; i < numBatches; i++) {
                try {
                    await step.run(`embed-${i}`, async () => {
                        const embedded = await embedPendingTextbookChunks(doc.id, EMBED_BATCH);
                        return { embedded };
                    });
                } catch (e) {
                    console.error(`[ingest-textbook] embed batch ${i} exhausted — leaving partial`, e);
                    break;
                }
            }

            // 3. MARK: flip to INGESTED only when every chunk has a vector (COUNT-guarded), else leave
            //    INGESTING. Best-effort: this single update can't fail the (already-useful) ingest.
            await step.run("mark", async () => {
                try {
                    const rows = await db.$queryRaw<Array<{ remaining: bigint }>>`
                        SELECT count(*)::bigint AS remaining
                        FROM "textbook_chunks"
                        WHERE document_id = ${doc.id} AND embedding IS NULL;
                    `;
                    const remaining = Number(rows[0]?.remaining ?? 0);
                    await db.textbookDocument.update({
                        where: { id: doc.id },
                        // Reconcile chunkCount to what is actually EMBEDDED (staged − remaining) so a
                        // partial book left INGESTING doesn't advertise its full staged count.
                        data: {
                            status: remaining === 0 ? "INGESTED" : "INGESTING",
                            chunkCount: Math.max(0, staged.staged - remaining),
                        },
                    });
                    return { ingested: remaining === 0, remaining };
                } catch (e) {
                    console.error("[ingest-textbook mark] non-fatal failure", e);
                    return { ingested: false };
                }
            });
        }

        return { success: true, cnxId };
    },
);
