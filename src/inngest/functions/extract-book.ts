import { revalidateTag } from "next/cache";
import { inngest } from "@/inngest/client";
import { db, withTenant } from "@/server/db";
import {
    groundBook,
    structureBookResearch,
    degradedBookResult,
    groundBookSections,
    structureBookSections,
    classifySectionsToObjectives,
} from "@/lib/ai/book-extraction";
import {
    generateBookEmbedding,
    stageBookTextChunks,
    embedPendingBookTextChunks,
} from "@/lib/utils/vector";
import { discoverFullText, fetchFullText } from "@/lib/sources/registry";
import { segmentIntoChapters, chunkText } from "@/lib/sources/text-processing";

// Hard cap on total full-text chunks embedded per book, so an unusually long public-domain
// work (a multi-volume omnibus, the Bible, War and Peace, ...) can't trigger a runaway embed
// that exhausts the provider quota. ~2000 chunks ≈ ~600k words — covers virtually any single
// book. Embedding is fanned out across ~ceil(N/EMBED_BATCH) memoized steps (see 8b), so each step
// stays well under Vercel Hobby's 60s per-invocation ceiling; this cap just bounds the total
// number of those steps. Truly massive works ingest their first ~2000 chunks.
const MAX_FULL_TEXT_CHUNKS = 2000;

export const extractBook = inngest.createFunction(
    {
        id: "extract-book",
        // 4 (= 5 attempts) so the content-filter retries we moved from an in-process loop up to the
        // STEP level (groundBook / groundBookSections throw on a content-filtered empty) get at least
        // as many tries as the old 3x loop, with Inngest backoff between them. Every step is
        // idempotent, so the extra retries are safe for the non-AI steps too.
        retries: 4,
        concurrency: { limit: 2 },
        // Inngest runs this after retries are exhausted. Mark BOTH the global extraction
        // row (context-free) and the triggering book (org-scoped) FAILED so nothing hangs
        // in EXTRACTING. (`event` here is the inngest/function.failed event; the original
        // trigger payload is at event.data.event.data — same shape as compile-curriculum.)
        onFailure: async ({ event }) => {
            const orig = (event as any)?.data?.event?.data as
                | {
                      bookExtractionId?: string;
                      triggeringBookId?: string;
                      organizationId?: string;
                      userId?: string | null;
                  }
                | undefined;
            const bookExtractionId = orig?.bookExtractionId;
            const triggeringBookId = orig?.triggeringBookId;
            const organizationId = orig?.organizationId;
            const userId = orig?.userId ?? null;

            // Global, context-free table — plain db, USING(true)/WITH CHECK(true) for app_user.
            if (bookExtractionId) {
                await db.bookExtraction
                    .update({ where: { id: bookExtractionId }, data: { status: "FAILED" } })
                    .catch((e) =>
                        console.error("[extract-book onFailure] failed to mark BookExtraction FAILED", e),
                    );
            }

            // books is org-scoped; AsyncLocalStorage doesn't reach Prisma in the Inngest
            // runtime, so stamp the tenant explicitly or the FAILED write is silently dropped.
            if (triggeringBookId && organizationId) {
                await withTenant(
                    (tx) =>
                        tx.book.update({
                            where: { id: triggeringBookId },
                            data: { extractionStatus: "FAILED" },
                        }),
                    undefined,
                    { organizationId, userId },
                ).catch((e) =>
                    console.error("[extract-book onFailure] failed to mark Book FAILED", e),
                );
            }
        },
    },
    { event: "book/extract.requested" },
    async ({ event, step }) => {
        const { bookExtractionId, triggeringBookId, organizationId, userId } = event.data;
        // Background worker has no request — AsyncLocalStorage does NOT reach the Prisma
        // layer here. The GLOBAL BookExtraction row is context-free (read/write with plain
        // db); every org-scoped Book op must thread the tenant EXPLICITLY via withTenant.

        // 1. Load metadata: the GLOBAL extraction row (plain db) for the canonical
        //    title/authors/isbn13, plus the triggering Book (org-scoped) for richer fields.
        const meta = await step.run("load-metadata", async () => {
            const extraction = await db.bookExtraction.findUnique({
                where: { id: bookExtractionId },
            });
            if (!extraction) throw new Error("BookExtraction not found");

            const book = await withTenant(
                (tx) =>
                    tx.book.findUnique({
                        where: { id: triggeringBookId },
                        select: {
                            title: true,
                            authors: true,
                            isbn: true,
                            publisher: true,
                            publishedDate: true,
                            description: true,
                            pageCount: true,
                            subject: { select: { name: true } },
                        },
                    }),
                undefined,
                { organizationId, userId },
            );

            // Book.authors is Json? (free-form), but the AI contract wants string[]|null.
            // The GLOBAL extraction row stores the canonical normalized String[] authors,
            // so prefer it; coerce the book's JSON only as a defensive fallback.
            const bookAuthors = Array.isArray(book?.authors)
                ? (book!.authors as unknown[]).filter((a): a is string => typeof a === "string")
                : null;
            const authors =
                extraction.authors && extraction.authors.length > 0
                    ? extraction.authors
                    : bookAuthors;

            return {
                title: book?.title ?? extraction.title,
                authors,
                isbn: extraction.isbn13 ?? book?.isbn ?? null,
                publisher: book?.publisher ?? null,
                publishedDate: book?.publishedDate ?? null,
                description: book?.description ?? null,
                pageCount: book?.pageCount ?? null,
                subject: book?.subject?.name ?? null,
            };
        });

        // 2. Web-grounded extraction, split so each Inngest step is ONE AI call (Vercel Hobby's
        //    per-invocation ceiling is 60s). GROUND (one attempt) then STRUCTURE, in separate steps.
        //    The old in-process 3x retry loop is gone: a content-filtered empty THROWS, and Inngest
        //    retries that ONE step on a fresh invocation (function `retries`). If grounding is
        //    exhausted we DEGRADE (synthesized chapters) rather than fail the whole extraction.
        let research: { notes: string; sources: Array<{ title?: string; url: string }> } | null = null;
        try {
            research = await step.run("extract-ground", async () => groundBook(meta));
        } catch (e) {
            console.error("[extract-book] grounding exhausted — degrading", e);
            research = null;
        }
        const result = await step.run("extract-structure", async () =>
            research
                ? structureBookResearch(research.notes, research.sources, meta)
                : degradedBookResult(meta),
        );

        // 3. Persist to the GLOBAL extraction row — plain db (context-free global table).
        await step.run("persist-global", async () => {
            await db.bookExtraction.update({
                where: { id: bookExtractionId },
                data: {
                    status: "EXTRACTED",
                    stage: result.stage,
                    summary: result.summary,
                    tableOfContents: result.tableOfContents as any,
                    readingLevel: result.readingLevel,
                    mainThemes: result.mainThemes,
                    sources: result.sources as any,
                    confidence: result.confidence,
                    extractedAt: new Date(),
                },
            });
        });

        // 4. Copy down to ONLY the triggering book (its org is known). Other orgs copy down
        //    lazily via the extract route — do NOT fan out across orgs here.
        await step.run("copy-down", async () => {
            await withTenant(
                (tx) =>
                    tx.book.update({
                        where: { id: triggeringBookId },
                        data: {
                            summary: result.summary,
                            tableOfContents: result.tableOfContents as any,
                            extractionStatus: "EXTRACTED",
                            extractedAt: new Date(),
                            bookExtractionId,
                        },
                    }),
                undefined,
                { organizationId, userId },
            );
            // Invalidate the org's library list so the new summary/TOC surfaces.
            // @ts-ignore — matches the revalidateTag call site in process-document.ts
            revalidateTag(`library-${organizationId}`);
        });

        // 5. Best-effort embedding. generateBookEmbedding opens its OWN withTenant via ctx,
        //    so it is NOT nested inside another withTenant. Failures are non-fatal.
        await step.run("embed", async () => {
            try {
                await generateBookEmbedding(
                    triggeringBookId,
                    `${meta.title}\n${result.summary ?? ""}`,
                    { organizationId, userId },
                );
            } catch (e) {
                console.error("[extract-book embed] non-fatal embedding failure", e);
            }
            return { embedded: true };
        });

        // 6. Best-effort Phase-2 section facts sheet. Web-grounded chapter-by-chapter research
        //    structured into per-section facts. GLOBAL/context-free table → PLAIN db (no
        //    withTenant). Non-fatal: a failure here must NOT fail the whole compile.
        //
        //    Same one-AI-call-per-step split as the main extraction: GROUND (one attempt; Inngest
        //    retries a fresh invocation on a content-filtered empty) then STRUCTURE+persist. The
        //    section anchor reuses the already-loaded meta + the freshly-structured TOC (no re-read).
        const sectionMeta = {
            title: meta.title,
            authors: meta.authors,
            isbn: meta.isbn,
            tableOfContents: result.tableOfContents,
        };

        let sectionsResearch:
            | { notes: string; sources: Array<{ title?: string; url: string }> }
            | null = null;
        try {
            sectionsResearch = await step.run("sections-ground", async () =>
                groundBookSections(sectionMeta),
            );
        } catch (e) {
            // Section grounding exhausted its retries → skip sections (best-effort), don't fail.
            console.error("[extract-book] section grounding exhausted — skipping sections", e);
            sectionsResearch = null;
        }

        // Derive the gate from the step's RETURN value (not a closure-mutated flag) so it
        // stays correct across Inngest replays, where a memoized step does not re-run.
        const sectionStep = await step.run("extract-sections", async () => {
            try {
                if (!sectionsResearch) return { sectionsWritten: false };

                const sections = await structureBookSections(sectionsResearch.notes, sectionMeta);

                if (sections.length === 0) return { sectionsWritten: false };

                // Idempotent replace: deleteMany cascades old objectives + spine gaps.
                await db.bookExtractionSection.deleteMany({ where: { bookExtractionId } });
                await db.bookExtractionSection.createMany({
                    data: sections.map((s) => ({
                        bookExtractionId,
                        sectionNumber: s.sectionNumber,
                        title: s.title,
                        kind: "CHAPTER",
                        summary: s.summary,
                        keyPoints: s.keyPoints as any,
                        charactersPresent: s.charactersPresent as any,
                        vocabulary: s.vocabulary as any,
                        factsSource: "WEB",
                    })),
                });

                return { sectionsWritten: true, count: sections.length };
            } catch (e) {
                console.error("[extract-book extract-sections] non-fatal section failure", e);
                return { sectionsWritten: false };
            }
        });
        const sectionsWritten = sectionStep.sectionsWritten === true;

        // 7. Best-effort cross-walk: map each freshly-stored section to academic-spine
        //    Objectives; record SpineGaps for sections that map to nothing. Only runs if
        //    sections were actually written. GLOBAL tables → PLAIN db; the ONLY org-scoped
        //    read (the book's subjectId) goes through withTenant and completes BEFORE any
        //    plain-db work — withTenant is never nested and never wraps plain-db calls.
        if (sectionsWritten) {
            await step.run("cross-walk", async () => {
                try {
                    // Org-scoped read FIRST, fully resolved before plain-db work begins.
                    const book = await withTenant(
                        (tx) =>
                            tx.book.findUnique({
                                where: { id: triggeringBookId },
                                select: { subjectId: true },
                            }),
                        undefined,
                        { organizationId, userId },
                    );
                    const subjectId = book?.subjectId ?? null;
                    if (!subjectId) return { crossWalked: false, reason: "no-subject" };

                    // Candidate objectives for this subject — global reference data, plain db.
                    const objectives = await db.objective.findMany({
                        where: { subtopic: { topic: { strand: { subjectId } } } },
                        select: { id: true, code: true, text: true },
                        take: 120,
                    });
                    if (objectives.length === 0) {
                        return { crossWalked: false, reason: "no-objectives" };
                    }

                    // Re-read the freshly-stored sections to get their stable ids.
                    const storedSections = await db.bookExtractionSection.findMany({
                        where: { bookExtractionId },
                        select: { id: true, sectionNumber: true, title: true, summary: true },
                    });
                    if (storedSections.length === 0) {
                        return { crossWalked: false, reason: "no-sections" };
                    }

                    const codeToObjectiveId = new Map(objectives.map((o) => [o.code, o.id]));

                    const classified = await classifySectionsToObjectives({
                        sections: storedSections.map((s) => ({
                            sectionNumber: s.sectionNumber,
                            title: s.title,
                            summary: s.summary,
                        })),
                        objectives: objectives.map((o) => ({ code: o.code, text: o.text })),
                    });
                    const matchesBySection = new Map(
                        classified.map((c) => [c.sectionNumber, c.matches]),
                    );

                    let linked = 0;
                    let gaps = 0;
                    for (const section of storedSections) {
                        const matches = matchesBySection.get(section.sectionNumber) ?? [];
                        const qualifying = matches
                            .filter((m) => m.confidence >= 0.6 && codeToObjectiveId.has(m.code))
                            .map((m) => ({
                                sectionId: section.id,
                                objectiveId: codeToObjectiveId.get(m.code)!,
                                confidence: m.confidence,
                            }));

                        if (qualifying.length > 0) {
                            const res = await db.bookSectionObjective.createMany({
                                data: qualifying,
                                skipDuplicates: true,
                            });
                            linked += res.count;
                        } else {
                            // Zero qualifying matches → spine-expansion backlog entry.
                            await db.spineGap.create({
                                data: {
                                    bookExtractionId,
                                    sectionId: section.id,
                                    topicGuess: section.title,
                                },
                            });
                            gaps += 1;
                        }
                    }

                    return { crossWalked: true, linked, gaps };
                } catch (e) {
                    console.error("[extract-book cross-walk] non-fatal cross-walk failure", e);
                    return { crossWalked: false, reason: "error" };
                }
            });
        }

        // 8. Best-effort Phase-3 full-text ingestion. If the work is in the public domain and an
        //    open source (Gutenberg, ...) carries its full text, fetch + chapter-segment + chunk +
        //    embed it into the GLOBAL book_text_chunks catalog for source-grounded RAG at generation
        //    time. book_extractions + book_text_chunks are GLOBAL/context-free → PLAIN db (no
        //    withTenant). Non-fatal: a failure (or simply no open source) must NOT fail the compile —
        //    the book still generates from its web-grounded facts sheet, so EVERY step here swallows.
        //
        //    Split across MANY small steps on purpose: each Inngest step is its own Vercel invocation
        //    bounded by /api/inngest's maxDuration (60s on Hobby), so no single step may bundle the
        //    big download, the multi-MB segmentation, AND ~20 embedding batches. Each is also memoized
        //    so a kill/replay resumes instead of re-doing finished work:
        //      8a  DISCOVER    — light catalog lookup → a body URL (no large download).
        //      8b  FETCH+STAGE — download the body, chapter-segment + chunk, persist content-only rows.
        //      8c  EMBED       — drain the unembedded rows in fixed-size, individually-memoized batches.
        //      8d  MARK        — flip to INGESTED only once EVERY chunk truly has a vector.

        // 8a. DISCOVER: locate an open-source full text (a light Gutendex-style catalog lookup, no
        //     large download). Its own memoized step so a kill during the heavier download (8b) does
        //     not repeat discovery. Records UNAVAILABLE when nothing carries the text.
        const discovered = await step.run("fulltext-discover", async () => {
            try {
                const extraction = await db.bookExtraction.findUnique({
                    where: { id: bookExtractionId },
                    select: { title: true, authors: true },
                });
                if (!extraction) return null;

                const hit = await discoverFullText({
                    title: extraction.title,
                    authors: extraction.authors,
                });

                // No open source carries this text → record UNAVAILABLE so we don't retry blindly
                // and the UI can show "full-text quotes not available" rather than spinning.
                if (!hit) {
                    await db.bookExtraction.update({
                        where: { id: bookExtractionId },
                        data: { fullTextStatus: "UNAVAILABLE" },
                    });
                    return null;
                }
                return hit; // { source, sourceId, textUrl }
            } catch (e) {
                console.error("[extract-book fulltext-discover] non-fatal discover failure", e);
                return null;
            }
        });

        // 8b. FETCH + STAGE: download the body (the one heavy fetch, isolated in its own step),
        //     chapter-segment + chunk it, and persist content-only rows (vectors come in 8c). The
        //     multi-MB text never crosses a step boundary. Bounded: one ≤30s download + regex
        //     segmentation + a few batched inserts — comfortably under 60s. Only runs once discovery
        //     succeeded (deterministic from the memoized 8a result).
        const staged = discovered
            ? await step.run("fulltext-fetch-stage", async () => {
                  try {
                      const text = await fetchFullText(discovered.source, discovered.textUrl);
                      if (!text) {
                          await db.bookExtraction.update({
                              where: { id: bookExtractionId },
                              data: { fullTextStatus: "UNAVAILABLE" },
                          });
                          return { staged: 0, reason: "fetch-failed" };
                      }

                      // Align full-text chapter segmentation to the stored Phase-2 section
                      // titles/order so each text chunk's sectionNumber lines up with its facts sheet.
                      const storedSections = await db.bookExtractionSection.findMany({
                          where: { bookExtractionId },
                          select: { sectionNumber: true, title: true },
                          orderBy: { sectionNumber: "asc" },
                      });
                      const toc = storedSections.map((s) => ({
                          sectionNumber: s.sectionNumber,
                          title: s.title,
                      }));

                      const chapters = segmentIntoChapters(text, toc);

                      // Flatten chapters → overlapping word-window chunks, tagging each with its
                      // section. Cap the total so a huge book can't trigger a runaway embed.
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
                              data: { fullTextStatus: "UNAVAILABLE" },
                          });
                          return { staged: 0, reason: "no-chunks" };
                      }

                      // Persist content-only rows (vectors come in 8c). Idempotent delete-then-insert.
                      const count = await stageBookTextChunks(bookExtractionId, allChunks);
                      if (count === 0) return { staged: 0, reason: "stage-failed" };

                      // Stamp provenance + INGESTING now so the row already knows its source; status
                      // flips to INGESTED only after every chunk is embedded (8d).
                      await db.bookExtraction.update({
                          where: { id: bookExtractionId },
                          data: {
                              publicDomain: true,
                              fullTextSource: discovered.source,
                              fullTextSourceId: discovered.sourceId,
                              fullTextStatus: "INGESTING",
                          },
                      });

                      return { staged: count, source: discovered.source };
                  } catch (e) {
                      console.error("[extract-book fulltext-fetch-stage] non-fatal failure", e);
                      return { staged: 0, reason: "error" };
                  }
              })
            : { staged: 0, reason: "unavailable" as const };

        if (staged.staged > 0) {
            // 8c. EMBED: drain the staged chunks in fixed-size batches, one memoized step each. A
            //     batch (≤2 gemini-embedding-2 calls + ≤EMBED_BATCH writes) is comfortably bounded,
            //     so no single invocation approaches the ceiling. The batch COUNT is derived from the
            //     memoized stage result, so it's deterministic across replays (stable step ids); each
            //     step drains the next `embedding IS NULL` slice, so finished batches are never redone.
            //     embedPendingBookTextChunks THROWS on a real failure (it no longer swallows), so a
            //     failing batch retries via the function `retries`; if it still exhausts them, we
            //     catch + break and 8d leaves the row INGESTING (partial) rather than a false INGESTED.
            const EMBED_BATCH = 200;
            const numBatches = Math.ceil(staged.staged / EMBED_BATCH);
            for (let i = 0; i < numBatches; i++) {
                try {
                    await step.run(`fulltext-embed-${i}`, async () => {
                        const embedded = await embedPendingBookTextChunks(
                            bookExtractionId,
                            EMBED_BATCH,
                        );
                        return { embedded };
                    });
                } catch (e) {
                    // This batch exhausted its retries → stop. 8d's COUNT check keeps the status
                    // honest (INGESTING, not INGESTED); a later re-extract drains the rest idempotently.
                    console.error(
                        `[extract-book] embed batch ${i} exhausted — leaving full-text partial`,
                        e,
                    );
                    break;
                }
            }

            // 8d. MARK: flip to INGESTED ONLY when every chunk truly carries a vector — otherwise a
            //     half-embedded book would be advertised as fully ingested and RAG would silently
            //     retrieve fewer/no excerpts. Re-check the unembedded count and downgrade to INGESTING
            //     when any remain. Best-effort + idempotent: wrapped in try/catch so a transient blip
            //     on this single UPDATE can never fail the whole (already-successful) extraction.
            await step.run("fulltext-mark-ingested", async () => {
                try {
                    const rows = await db.$queryRaw<Array<{ remaining: bigint }>>`
                        SELECT count(*)::bigint AS remaining
                        FROM "book_text_chunks"
                        WHERE book_extraction_id = ${bookExtractionId} AND embedding IS NULL;
                    `;
                    const remaining = Number(rows[0]?.remaining ?? 0);
                    const done = remaining === 0;
                    await db.bookExtraction.update({
                        where: { id: bookExtractionId },
                        data: { fullTextStatus: done ? "INGESTED" : "INGESTING" },
                    });
                    return { ingested: done, remaining };
                } catch (e) {
                    console.error("[extract-book fulltext-mark-ingested] non-fatal failure", e);
                    return { ingested: false };
                }
            });
        }

        return { success: true, bookExtractionId, triggeringBookId };
    },
);
