import { inngest } from "@/inngest/client";
import { db } from "@/server/db";
import { discoverAllFullText, fetchFirstAvailable } from "@/lib/sources/registry";
import { segmentIntoChapters, chunkText } from "@/lib/sources/text-processing";
import { stageBookTextChunks, embedPendingBookTextChunks } from "@/lib/utils/vector";

// Hard cap on total full-text chunks embedded per book so an unusually long public-domain work
// (a multi-volume omnibus, the Bible, War and Peace, …) can't trigger a runaway embed that exhausts
// the provider quota. ~2000 chunks ≈ ~600k words — covers virtually any single book.
const MAX_FULL_TEXT_CHUNKS = 2000;

/**
 * Phase-3 BOOK FULL-TEXT ingestion — its OWN Inngest function, fully DECOUPLED from extract-book.
 *
 * extract-book fires `book/fulltext.requested` right after it persists the global extraction row;
 * this function then locates an open full text (Gutenberg / Standard Ebooks / Wikisource / Internet
 * Archive), fetches it, and chunks + embeds it into the GLOBAL book_text_chunks RAG catalog for
 * source-grounded quoting at generation time.
 *
 * WHY a separate function (this is the fix): extract-book bundles the core extraction + a book-level
 * embed + a web-grounded SECTIONS facts-sheet + a spine cross-walk, each a heavy AI step. On Vercel
 * Hobby (60s/step) any of those earlier steps can TIME OUT and fail the WHOLE run — which used to
 * kill full-text before it ever ran (it was the LAST step). Splitting full-text into an independent
 * function means the extraction's flakiness can NEVER block it, and vice-versa.
 *
 * All tables here are GLOBAL / context-free → PLAIN db (no withTenant). Split into bounded steps so
 * none approaches the 60s ceiling: DISCOVER → FETCH (park raw) → STAGE (segment+chunk) → EMBED
 * (batches) → MARK. Best-effort throughout: a failure records UNAVAILABLE (visible), never NULL.
 */
export const ingestBookFullText = inngest.createFunction(
    {
        id: "ingest-book-fulltext",
        retries: 3,
        concurrency: { limit: 2 },
        onFailure: async ({ event }) => {
            const id = event.data?.event?.data?.bookExtractionId;
            if (id) {
                await db.bookExtraction
                    .update({ where: { id }, data: { fullTextStatus: "UNAVAILABLE", fullTextRaw: null } })
                    .catch((e) => console.error("[ingest-book-fulltext onFailure] mark UNAVAILABLE failed", e));
            }
        },
    },
    { event: "book/fulltext.requested" },
    async ({ event, step }) => {
        const { bookExtractionId } = event.data;

        // DISCOVER: probe EVERY source (light catalog lookups) so the fetch can fall through if the
        // best source's heavy fetch fails. No open source → record UNAVAILABLE and stop.
        const discovered = await step.run("discover", async () => {
            try {
                const extraction = await db.bookExtraction.findUnique({
                    where: { id: bookExtractionId },
                    select: { title: true, authors: true },
                });
                if (!extraction) return [];
                const hits = await discoverAllFullText({
                    title: extraction.title,
                    authors: extraction.authors,
                });
                if (hits.length === 0) {
                    await db.bookExtraction.update({
                        where: { id: bookExtractionId },
                        data: { fullTextStatus: "UNAVAILABLE" },
                    });
                    return [];
                }
                return hits; // BookTextLocation[] best-first
            } catch (e) {
                console.error("[ingest-book-fulltext discover] non-fatal failure", e);
                return [];
            }
        });

        // FETCH: the ONLY network step — download the winning source's body and PARK it in
        // book_extractions.full_text_raw. The multi-MB body stays in the DB, never crossing the
        // Inngest step boundary (output-size limit), and is the only work here so the slow fetch never
        // shares the 60s ceiling with segmentation/staging. A miss/error records UNAVAILABLE (visible).
        const fetched = discovered.length > 0
            ? await step.run("fetch", async () => {
                  try {
                      const result = await fetchFirstAvailable(discovered, { budgetMs: 40000 });
                      if (!result) {
                          await db.bookExtraction.update({
                              where: { id: bookExtractionId },
                              data: { fullTextStatus: "UNAVAILABLE" },
                          });
                          return { ok: false as const, reason: "fetch-failed" };
                      }
                      await db.bookExtraction.update({
                          where: { id: bookExtractionId },
                          data: {
                              fullTextRaw: result.text,
                              publicDomain: true,
                              fullTextSource: result.source,
                              fullTextSourceId: result.sourceId,
                              fullTextStatus: "INGESTING",
                          },
                      });
                      return { ok: true as const, source: result.source, length: result.text.length };
                  } catch (e) {
                      console.error("[ingest-book-fulltext fetch] non-fatal failure", e);
                      await db.bookExtraction
                          .update({ where: { id: bookExtractionId }, data: { fullTextStatus: "UNAVAILABLE" } })
                          .catch((err) => console.error("[ingest-book-fulltext fetch] status write failed", err));
                      return { ok: false as const, reason: "error" };
                  }
              })
            : { ok: false as const, reason: "unavailable" };

        // STAGE: read the parked raw text back, chapter-segment + chunk it (aligned to the book's
        // section titles when the facts-sheet happens to be ready, else generic segmentation), persist
        // content-only rows, then CLEAR the parked text. Pure CPU + DB → fits any book size.
        const staged = fetched.ok
            ? await step.run("stage", async () => {
                  try {
                      const ext = await db.bookExtraction.findUnique({
                          where: { id: bookExtractionId },
                          select: { fullTextRaw: true },
                      });
                      const text = ext?.fullTextRaw;
                      if (!text) {
                          await db.bookExtraction.update({
                              where: { id: bookExtractionId },
                              data: { fullTextStatus: "UNAVAILABLE" },
                          });
                          return { staged: 0, reason: "no-raw" };
                      }

                      const storedSections = await db.bookExtractionSection.findMany({
                          where: { bookExtractionId },
                          select: { sectionNumber: true, title: true },
                          orderBy: { sectionNumber: "asc" },
                      });
                      const toc = storedSections.map((s) => ({ sectionNumber: s.sectionNumber, title: s.title }));
                      const chapters = segmentIntoChapters(text, toc);

                      const allChunks: { sectionNumber: number | null; content: string }[] = [];
                      for (const chapter of chapters) {
                          if (allChunks.length >= MAX_FULL_TEXT_CHUNKS) break;
                          for (const content of chunkText(chapter.text)) {
                              if (allChunks.length >= MAX_FULL_TEXT_CHUNKS) break;
                              allChunks.push({ sectionNumber: chapter.sectionNumber, content });
                          }
                      }

                      if (allChunks.length === 0) {
                          await db.bookExtraction.update({
                              where: { id: bookExtractionId },
                              data: { fullTextStatus: "UNAVAILABLE", fullTextRaw: null },
                          });
                          return { staged: 0, reason: "no-chunks" };
                      }

                      const count = await stageBookTextChunks(bookExtractionId, allChunks);
                      await db.bookExtraction.update({
                          where: { id: bookExtractionId },
                          data: {
                              fullTextRaw: null,
                              ...(count === 0 ? { fullTextStatus: "UNAVAILABLE" } : {}),
                          },
                      });
                      return { staged: count };
                  } catch (e) {
                      console.error("[ingest-book-fulltext stage] non-fatal failure", e);
                      await db.bookExtraction
                          .update({
                              where: { id: bookExtractionId },
                              data: { fullTextStatus: "UNAVAILABLE", fullTextRaw: null },
                          })
                          .catch((err) => console.error("[ingest-book-fulltext stage] status write failed", err));
                      return { staged: 0, reason: "error" };
                  }
              })
            : { staged: 0, reason: "not-fetched" };

        if (staged.staged > 0) {
            // EMBED: drain the staged chunks in fixed-size batches, one memoized step each (≤2 embed
            // calls + ≤EMBED_BATCH writes — comfortably bounded). embedPendingBookTextChunks THROWS on
            // a real failure, so a failing batch retries via the function `retries`; if exhausted we
            // catch + break and MARK keeps the status honest (INGESTING, not a false INGESTED).
            const EMBED_BATCH = 200;
            const numBatches = Math.ceil(staged.staged / EMBED_BATCH);
            for (let i = 0; i < numBatches; i++) {
                try {
                    await step.run(`embed-${i}`, async () => {
                        const embedded = await embedPendingBookTextChunks(bookExtractionId, EMBED_BATCH);
                        return { embedded };
                    });
                } catch (e) {
                    console.error(`[ingest-book-fulltext] embed batch ${i} exhausted — leaving partial`, e);
                    break;
                }
            }

            // MARK: flip to INGESTED only when EVERY chunk truly has a vector, else leave INGESTING.
            await step.run("mark", async () => {
                try {
                    const rows = await db.$queryRaw<Array<{ remaining: bigint }>>`
                        SELECT count(*)::bigint AS remaining
                        FROM "book_text_chunks"
                        WHERE book_extraction_id = ${bookExtractionId} AND embedding IS NULL;
                    `;
                    const remaining = Number(rows[0]?.remaining ?? 0);
                    await db.bookExtraction.update({
                        where: { id: bookExtractionId },
                        data: { fullTextStatus: remaining === 0 ? "INGESTED" : "INGESTING" },
                    });
                    return { ingested: remaining === 0, remaining };
                } catch (e) {
                    console.error("[ingest-book-fulltext mark] non-fatal failure", e);
                    return { ingested: false };
                }
            });
        }

        return { bookExtractionId, staged: staged.staged };
    },
);
