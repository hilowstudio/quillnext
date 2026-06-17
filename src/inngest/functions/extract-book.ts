import { revalidateTag } from "next/cache";
import { inngest } from "@/inngest/client";
import { db, withTenant } from "@/server/db";
import {
    extractBookGrounded,
    extractBookSectionsGrounded,
    classifySectionsToObjectives,
} from "@/lib/ai/book-extraction";
import { generateBookEmbedding, embedBookTextChunks } from "@/lib/utils/vector";
import { findFullText } from "@/lib/sources/registry";
import { segmentIntoChapters, chunkText } from "@/lib/sources/text-processing";

// Hard cap on total full-text chunks embedded per book, so an unusually long public-domain
// work (a multi-volume omnibus, the Bible, War and Peace, ...) can't trigger a runaway embed
// loop that exhausts the provider quota or stalls the worker. ~4000 chunks ≈ ~1.2M words.
const MAX_FULL_TEXT_CHUNKS = 4000;

export const extractBook = inngest.createFunction(
    {
        id: "extract-book",
        retries: 2,
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

        // 2. Web-grounded extraction (the shared AI contract).
        const result = await step.run("extract", async () => {
            return extractBookGrounded(meta);
        });

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
        // Derive the gate from the step's RETURN value (not a closure-mutated flag) so it
        // stays correct across Inngest replays, where a memoized step does not re-run.
        const sectionStep = await step.run("extract-sections", async () => {
            try {
                const extraction = await db.bookExtraction.findUnique({
                    where: { id: bookExtractionId },
                    select: {
                        title: true,
                        authors: true,
                        isbn13: true,
                        tableOfContents: true,
                    },
                });
                if (!extraction) return { sectionsWritten: false };

                const sections = await extractBookSectionsGrounded({
                    title: extraction.title,
                    authors: extraction.authors,
                    isbn: extraction.isbn13,
                    tableOfContents: extraction.tableOfContents,
                });

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
        //    embed it into the GLOBAL book_text_chunks catalog for source-grounded RAG at
        //    generation time. book_extractions + book_text_chunks are GLOBAL/context-free →
        //    PLAIN db (no withTenant). Non-fatal: a failure (or simply no open source) must NOT
        //    fail the compile — the book still generates from its web-grounded facts sheet.
        await step.run("ingest-full-text", async () => {
            try {
                const extraction = await db.bookExtraction.findUnique({
                    where: { id: bookExtractionId },
                    select: { title: true, authors: true },
                });
                if (!extraction) return { ingested: false, reason: "no-extraction" };

                const ft = await findFullText({
                    title: extraction.title,
                    authors: extraction.authors,
                });

                // No open source carries this text → record UNAVAILABLE so we don't retry blindly
                // and the UI can show "full-text quotes not available" rather than spinning.
                if (!ft) {
                    await db.bookExtraction.update({
                        where: { id: bookExtractionId },
                        data: { fullTextStatus: "UNAVAILABLE" },
                    });
                    return { ingested: false, reason: "unavailable" };
                }

                // Align full-text chapter segmentation to the stored Phase-2 section titles/order
                // so each text chunk's sectionNumber lines up with its facts-sheet section.
                const storedSections = await db.bookExtractionSection.findMany({
                    where: { bookExtractionId },
                    select: { sectionNumber: true, title: true },
                    orderBy: { sectionNumber: "asc" },
                });
                const toc = storedSections.map((s) => ({
                    sectionNumber: s.sectionNumber,
                    title: s.title,
                }));

                const chapters = segmentIntoChapters(ft.text, toc);

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
                    return { ingested: false, reason: "no-chunks" };
                }

                // Embed + store into the GLOBAL book_text_chunks catalog (plain db, best-effort,
                // idempotent delete-then-insert). Then stamp the extraction row so generation knows
                // verbatim, source-grounded quotes are available for this book.
                await embedBookTextChunks(bookExtractionId, allChunks);

                await db.bookExtraction.update({
                    where: { id: bookExtractionId },
                    data: {
                        publicDomain: true,
                        fullTextSource: ft.source,
                        fullTextSourceId: ft.sourceId,
                        fullTextStatus: "INGESTED",
                    },
                });

                return { ingested: true, source: ft.source, chunks: allChunks.length };
            } catch (e) {
                console.error("[extract-book ingest-full-text] non-fatal full-text failure", e);
                return { ingested: false, reason: "error" };
            }
        });

        return { success: true, bookExtractionId, triggeringBookId };
    },
);
