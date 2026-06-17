import { inngest } from "@/inngest/client";
import { db } from "@/server/db";
import { CORPUS_SOURCES, getCorpusSource } from "@/lib/sources/corpus-registry";
import { chunkText } from "@/lib/sources/text-processing";
import { stageTextbookChunks, embedPendingTextbookChunks } from "@/lib/utils/vector";
import { crossWalkTextbookTopics } from "@/lib/textbook-coverage";

// Per-book chunk cap so one large textbook can't run away with embedding cost. ~1500 chunks ≈ a
// strong subject sample of even a big book; the per-section coverage is what matters for grounding.
const MAX_TEXTBOOK_CHUNKS = 1500;

/**
 * DISCOVERY / fan-out for the open-textbook corpus. User-triggered (`textbook/corpus.ingest`): it
 * enumerates EVERY registered corpus source (CORPUS_SOURCES — openstax, siyavula, …), upserts a
 * TextbookDocument per book (keyed by its source + externalId), and fans out one
 * `textbook/ingest.requested` per book that still needs ingesting. The corpus tables are GLOBAL /
 * context-free, so all writes use PLAIN db (no withTenant). The actual bulk run is a deliberate,
 * cost-aware operation — this just enqueues it.
 */
export const ingestTextbookCorpus = inngest.createFunction(
    { id: "ingest-textbook-corpus", retries: 1, concurrency: { limit: 1 } },
    { event: "textbook/corpus.ingest" },
    async ({ event, step }) => {
        const force = event.data?.force === true;

        // List + upsert each source's catalog in its own step (one bounded unit of work per source).
        let discovered = 0;
        const queued: Array<{ source: string; externalId: string }> = [];
        for (const src of CORPUS_SOURCES) {
            const result = await step.run(`discover-${src.key}`, async () => {
                const books = await src.listBooks();
                const toIngest: string[] = [];
                for (const b of books) {
                    const existing = await db.textbookDocument.findUnique({
                        where: { externalId: b.externalId },
                    });
                    if (existing?.status === "INGESTED" && !force) continue; // already done
                    await db.textbookDocument.upsert({
                        where: { externalId: b.externalId },
                        create: {
                            source: src.key,
                            externalId: b.externalId,
                            title: b.title,
                            subject: b.subject,
                            category: b.category,
                            status: "PENDING",
                        },
                        update: {
                            source: src.key,
                            title: b.title,
                            subject: b.subject,
                            category: b.category,
                            ...(force ? { status: "PENDING" } : {}),
                        },
                    });
                    toIngest.push(b.externalId);
                }
                return { found: books.length, toIngest };
            });
            discovered += result.found;
            for (const externalId of result.toIngest) queued.push({ source: src.key, externalId });
        }

        if (queued.length > 0) {
            await step.sendEvent(
                "fan-out",
                queued.map((q) => ({ name: "textbook/ingest.requested" as const, data: q })),
            );
        }

        return { discovered, queued: queued.length };
    },
);

/**
 * Per-book OPEN-TEXTBOOK ingestion. Dispatches to the registered CORPUS source (by the stored
 * `source` key) to assemble the book's content sections, chunks them, and embeds them into the GLOBAL
 * textbook_chunks corpus tagged with the book's subject/category. Split into STAGE → EMBED (memoized
 * batches) → MARK → CROSS-WALK, like the book full-text worker, so each Inngest step stays under the
 * 60s Vercel ceiling and a kill/replay resumes. Global tables → PLAIN db. Best-effort throughout; a
 * failure marks the document, never crashes the corpus.
 */
export const ingestTextbook = inngest.createFunction(
    {
        id: "ingest-textbook",
        retries: 3,
        concurrency: { limit: 3 }, // gentle on the embedding provider during a bulk run
        onFailure: async ({ event }) => {
            const externalId = (event as any)?.data?.event?.data?.externalId as string | undefined;
            if (externalId) {
                await db.textbookDocument
                    .update({ where: { externalId }, data: { status: "UNAVAILABLE" } })
                    .catch((e) => console.error("[ingest-textbook onFailure] mark UNAVAILABLE failed", e));
            }
        },
    },
    { event: "textbook/ingest.requested" },
    async ({ event, step }) => {
        const { source, externalId } = event.data;

        const doc = await step.run("load-doc", async () => {
            return db.textbookDocument.findUnique({
                where: { externalId },
                select: { id: true, subject: true, category: true },
            });
        });
        if (!doc) return { skipped: true, reason: "no-document" };

        // 1. STAGE: assemble + chunk the sections, persist content-only rows (vectors come next).
        //    No try/catch swallow: a real failure (the source's assembleSections is fail-safe; stage-
        //    TextbookChunks THROWS on DB error) propagates → Inngest retries → onFailure marks the
        //    doc UNAVAILABLE. Deterministic empties (unknown source / no sections / no usable chunk
        //    text) mark UNAVAILABLE here so the doc never lingers in PENDING.
        const staged = await step.run("stage", async () => {
            const sections = (await getCorpusSource(source)?.assembleSections(externalId)) ?? [];
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

            // 4. CROSS-WALK: map this book to the spine TOPICS it covers (coarse coverage (b)). Its own
            //    bounded step (embeds ≤250 topics + a per-topic cosine over the book's chunks). Fully
            //    best-effort — crossWalkTextbookTopics never throws; a coverage gap must not fail the
            //    (already-useful) ingest. Runs on the chunks embedded by step 2, partial book included.
            await step.run("cross-walk", async () => {
                const covered = await crossWalkTextbookTopics(doc.id);
                return { coveredTopics: covered };
            });
        }

        return { success: true, source, externalId };
    },
);

/**
 * Recompute spine-Topic coverage (b) for the whole INGESTED corpus WITHOUT re-ingesting — run this
 * after tuning the cross-walk threshold/logic or adding spine topics. Fans out one
 * `textbook/crosswalk.requested` per ingested document. Global tables → PLAIN db.
 */
export const refreshTextbookCrosswalk = inngest.createFunction(
    { id: "refresh-textbook-crosswalk", retries: 1, concurrency: { limit: 1 } },
    { event: "textbook/crosswalk.refresh" },
    async ({ step }) => {
        const docs = await step.run("list-ingested", async () =>
            db.textbookDocument.findMany({ where: { status: "INGESTED" }, select: { id: true } }),
        );
        if (docs.length > 0) {
            await step.sendEvent(
                "fan-out",
                docs.map((d) => ({
                    name: "textbook/crosswalk.requested" as const,
                    data: { documentId: d.id },
                })),
            );
        }
        return { queued: docs.length };
    },
);

/**
 * Per-document coverage recompute. One bounded step (best-effort, never throws). Same idempotent
 * delete-then-insert as the ingest-time cross-walk.
 */
export const recrosswalkTextbook = inngest.createFunction(
    { id: "recrosswalk-textbook", retries: 2, concurrency: { limit: 3 } },
    { event: "textbook/crosswalk.requested" },
    async ({ event, step }) => {
        const { documentId } = event.data;
        const covered = await step.run("cross-walk", async () =>
            crossWalkTextbookTopics(documentId),
        );
        return { documentId, coveredTopics: covered };
    },
);
