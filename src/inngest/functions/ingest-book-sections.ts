import { inngest } from "@/inngest/client";
import { db, withTenant } from "@/server/db";
import {
    groundBookSections,
    structureBookSections,
    classifySectionsToObjectives,
} from "@/lib/ai/book-extraction";

/**
 * Phase-2 BOOK SECTIONS facts-sheet — its OWN Inngest function, DECOUPLED from extract-book.
 *
 * extract-book fires `book/sections.requested` once it persists the global extraction row; this
 * function then web-grounds the book chapter-by-chapter, structures the per-section facts into
 * book_extraction_sections, and cross-walks each section to academic-spine Objectives (recording
 * SpineGaps for misses).
 *
 * WHY a separate function (this is the fix): these are HEAVY web-grounded AI calls. On Vercel Hobby
 * (60s/step) one can TIME OUT, and a process-timeout is uncatchable in-process — so when this lived
 * inside extract-book, a sections timeout exhausted retries and failed the WHOLE run, which marked
 * the BOOK as FAILED even though its core extraction (summary/TOC) had already succeeded. Isolated in
 * its own function, a sections failure fails ONLY this function and is recorded as
 * BookExtraction.sectionsStatus = "UNAVAILABLE" — the book's own extraction_status is never touched.
 *
 * book_extractions + book_extraction_sections + book_section_objectives + spine_gaps are GLOBAL /
 * context-free → PLAIN db. The ONLY org-scoped read (the book's subjectId for the cross-walk) goes
 * through withTenant with the org/user carried on the event.
 */
export const ingestBookSections = inngest.createFunction(
    {
        id: "ingest-book-sections",
        retries: 3,
        concurrency: { limit: 2 },
        onFailure: async ({ event }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const id = (event as any)?.data?.event?.data?.bookExtractionId as string | undefined;
            if (id) {
                await db.bookExtraction
                    .update({ where: { id }, data: { sectionsStatus: "UNAVAILABLE" } })
                    .catch((e) => console.error("[ingest-book-sections onFailure] mark UNAVAILABLE failed", e));
            }
        },
    },
    { event: "book/sections.requested" },
    async ({ event, step }) => {
        const { bookExtractionId, triggeringBookId, organizationId, userId } = event.data;

        // Section anchor: reuse the persisted extraction row's identity + structured TOC.
        const sectionMeta = await step.run("load", async () => {
            const ext = await db.bookExtraction.findUnique({
                where: { id: bookExtractionId },
                select: { title: true, authors: true, isbn13: true, tableOfContents: true },
            });
            if (!ext) return null;
            return {
                title: ext.title,
                authors: ext.authors,
                isbn: ext.isbn13,
                tableOfContents: ext.tableOfContents,
            };
        });
        if (!sectionMeta) return { skipped: true, reason: "no-extraction" };

        // GROUND + STRUCTURE the per-section facts, BATCHED so no single grounded call can exceed
        // Vercel Hobby's 60s. A normal/single-volume book (TOC ≤ THRESHOLD) is ONE batch = one grounded
        // call (cheap, unchanged). A BIG book (> THRESHOLD chapters) is split into BATCH-chapter groups,
        // each grounded + structured in its OWN memoized steps so each stays bounded. (A null batch =
        // no usable TOC → one call, let the model find the structure.) Every step catches internally
        // (incl. the 50s grounding abort inside runBookGrounding), so a slow/failed batch just yields
        // nothing — it never fails this function. The book itself is never touched.
        // ≤ 8 chapters → a single grounded call; more → groups of 8. Empirically an ~18-chapter
        // single call still hit the 50s abort, so the "batch only big TOCs" line is 8, not 20: any
        // book past one batch's worth is split so each grounded call covers ≤ 8 chapters and fits.
        const SECTION_BATCH_THRESHOLD = 8;
        const SECTION_BATCH_SIZE = 8;
        const toc = Array.isArray(sectionMeta.tableOfContents)
            ? (sectionMeta.tableOfContents as unknown[])
            : [];
        const batches: (unknown[] | null)[] =
            toc.length > SECTION_BATCH_THRESHOLD
                ? Array.from({ length: Math.ceil(toc.length / SECTION_BATCH_SIZE) }, (_, i) =>
                      toc.slice(i * SECTION_BATCH_SIZE, i * SECTION_BATCH_SIZE + SECTION_BATCH_SIZE),
                  )
                : [toc.length > 0 ? toc : null];

        // Idempotent clear once; each batch then APPENDS its sections (distinct chapters → no overlap).
        await step.run("clear-sections", async () => {
            await db.bookExtractionSection.deleteMany({ where: { bookExtractionId } });
            return {};
        });

        let totalWritten = 0;
        for (let i = 0; i < batches.length; i++) {
            const batchMeta = {
                ...sectionMeta,
                tableOfContents: batches[i] ?? sectionMeta.tableOfContents,
            };

            // GROUND this batch (≤ a few chapters). Return just the notes (small → safe across the step
            // boundary). The 50s abort inside runBookGrounding keeps each call under the ceiling.
            const notes = await step.run(`ground-${i}`, async () => {
                try {
                    const r = await groundBookSections(batchMeta);
                    return r.notes;
                } catch (e) {
                    console.error(`[ingest-book-sections ground-${i}] failed — skipping batch`, e);
                    return null;
                }
            });

            // STRUCTURE this batch's notes → section facts, and append them.
            const written = await step.run(`structure-${i}`, async () => {
                try {
                    if (!notes) return 0;
                    const sections = await structureBookSections(notes, batchMeta);
                    if (sections.length === 0) return 0;
                    await db.bookExtractionSection.createMany({
                        data: sections.map((s) => ({
                            bookExtractionId,
                            sectionNumber: s.sectionNumber,
                            title: s.title,
                            kind: "CHAPTER",
                            summary: s.summary,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            keyPoints: s.keyPoints as any,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            charactersPresent: s.charactersPresent as any,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            vocabulary: s.vocabulary as any,
                            factsSource: "WEB",
                        })),
                    });
                    return sections.length;
                } catch (e) {
                    console.error(`[ingest-book-sections structure-${i}] failed`, e);
                    return 0;
                }
            });
            totalWritten += written;
        }

        // No sections produced across any batch (grounding/structuring degraded) → record UNAVAILABLE
        // and stop. NOT a book failure — the book is already EXTRACTED; this is a missing best-effort
        // artifact only.
        if (totalWritten === 0) {
            await step.run("mark-unavailable", async () => {
                await db.bookExtraction
                    .update({ where: { id: bookExtractionId }, data: { sectionsStatus: "UNAVAILABLE" } })
                    .catch((e) => console.error("[ingest-book-sections] mark UNAVAILABLE failed", e));
                return { sectionsStatus: "UNAVAILABLE" };
            });
            return { sectionsWritten: false };
        }

        // CROSS-WALK: map each freshly-stored section to academic-spine Objectives; record SpineGaps
        // for misses. Best-effort. GLOBAL tables → PLAIN db; the ONLY org-scoped read (the book's
        // subjectId) goes through withTenant and completes BEFORE any plain-db work.
        await step.run("cross-walk", async () => {
            try {
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

                const objectives = await db.objective.findMany({
                    where: { subtopic: { topic: { strand: { subjectId } } } },
                    select: { id: true, code: true, text: true },
                    take: 120,
                });
                if (objectives.length === 0) return { crossWalked: false, reason: "no-objectives" };

                const storedSections = await db.bookExtractionSection.findMany({
                    where: { bookExtractionId },
                    select: { id: true, sectionNumber: true, title: true, summary: true },
                });
                if (storedSections.length === 0) return { crossWalked: false, reason: "no-sections" };

                const codeToObjectiveId = new Map(objectives.map((o) => [o.code, o.id]));

                const classified = await classifySectionsToObjectives({
                    sections: storedSections.map((s) => ({
                        sectionNumber: s.sectionNumber,
                        title: s.title,
                        summary: s.summary,
                    })),
                    objectives: objectives.map((o) => ({ code: o.code, text: o.text })),
                });
                const matchesBySection = new Map(classified.map((c) => [c.sectionNumber, c.matches]));

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
                        await db.spineGap.create({
                            data: { bookExtractionId, sectionId: section.id, topicGuess: section.title },
                        });
                        gaps += 1;
                    }
                }

                return { crossWalked: true, linked, gaps };
            } catch (e) {
                console.error("[ingest-book-sections cross-walk] non-fatal failure", e);
                return { crossWalked: false, reason: "error" };
            }
        });

        // Sections succeeded (cross-walk is best-effort on top) → record EXTRACTED.
        await step.run("mark", async () => {
            await db.bookExtraction
                .update({ where: { id: bookExtractionId }, data: { sectionsStatus: "EXTRACTED" } })
                .catch((e) => console.error("[ingest-book-sections] mark EXTRACTED failed", e));
            return { sectionsStatus: "EXTRACTED" };
        });

        return { sectionsWritten: true };
    },
);
