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

        // GROUND chapter-by-chapter (one AI call). Catch inside the step for logic failures; a TIMEOUT
        // can still fail this function — but that only flips sectionsStatus, never the book.
        const sectionsResearch: { notes: string; sources: Array<{ title?: string; url: string }> } | null =
            await step.run("ground", async () => {
                try {
                    return await groundBookSections(sectionMeta);
                } catch (e) {
                    console.error("[ingest-book-sections] grounding failed — skipping sections", e);
                    return null;
                }
            });

        // STRUCTURE + persist the per-section facts (idempotent replace).
        const sectionStep = await step.run("structure", async () => {
            try {
                if (!sectionsResearch) return { sectionsWritten: false };
                const sections = await structureBookSections(sectionsResearch.notes, sectionMeta);
                if (sections.length === 0) return { sectionsWritten: false };

                await db.bookExtractionSection.deleteMany({ where: { bookExtractionId } });
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
                return { sectionsWritten: true, count: sections.length };
            } catch (e) {
                console.error("[ingest-book-sections structure] non-fatal failure", e);
                return { sectionsWritten: false };
            }
        });

        // No sections written (grounding/structuring degraded) → record UNAVAILABLE and stop. NOT a
        // book failure — the book is already EXTRACTED; this is just a missing best-effort artifact.
        if (!sectionStep.sectionsWritten) {
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
