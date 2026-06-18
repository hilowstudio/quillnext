import { inngest } from "@/inngest/client";
import { db, withTenant } from "@/server/db";
import { structureSectionsFromText, classifySectionsToObjectives } from "@/lib/ai/book-extraction";
import { retrieveBookChunks } from "@/lib/utils/vector";

/**
 * Phase-2 BOOK SECTIONS facts-sheet — its OWN Inngest function, DECOUPLED from extract-book.
 *
 * extract-book fires `book/sections.requested` once it persists the extraction row. This function then
 * builds the per-section facts sheet FROM THE BOOK'S OWN INGESTED FULL TEXT (public-domain books): for
 * each published-TOC section it retrieves the most-relevant full-text chunks (retrieveBookChunks) and a
 * single no-tools model call structures them into facts. NO web grounding — `google_search` research
 * is search-round-trip bound and exceeds Vercel Hobby's 60s even for ONE chapter (measured), so it can
 * never produce a facts-sheet on Hobby. Books WITHOUT ingested full text (non-public-domain) get NO
 * facts-sheet on Hobby (sectionsStatus = UNAVAILABLE) — that path awaits Vercel Pro (300s), where
 * web-grounded sections become viable again.
 *
 * WHY a separate function: a sections failure (or its absence) must never touch the book. Isolated
 * here, it only sets BookExtraction.sectionsStatus (EXTRACTED | UNAVAILABLE); the book's own
 * extraction_status is never affected. book_extractions + book_extraction_sections +
 * book_section_objectives + spine_gaps are GLOBAL / context-free → PLAIN db; the ONLY org-scoped read
 * (the book's subjectId for the cross-walk) goes through withTenant with the org/user on the event.
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

        // Load the extraction's identity + published TOC + whether its FULL TEXT is ingested.
        const loaded = await step.run("load", async () => {
            const ext = await db.bookExtraction.findUnique({
                where: { id: bookExtractionId },
                select: { title: true, authors: true, tableOfContents: true, fullTextStatus: true },
            });
            if (!ext) return null;
            const toc = Array.isArray(ext.tableOfContents) ? (ext.tableOfContents as unknown[]) : [];
            return {
                title: ext.title,
                authors: ext.authors,
                fullTextIngested: ext.fullTextStatus === "INGESTED",
                // Published-TOC sections, numbered by order (the TOC entries are {title} / {chapterNumber,title}).
                sections: toc
                    .map((t, i) => {
                        const title =
                            t && typeof t === "object" && typeof (t as { title?: unknown }).title === "string"
                                ? ((t as { title: string }).title)
                                : "";
                        return { sectionNumber: i + 1, title: title.trim() };
                    })
                    .filter((s) => s.title.length > 0),
            };
        });
        if (!loaded) return { skipped: true, reason: "no-extraction" };

        // We build the facts-sheet ONLY from the book's own ingested full text. Requires public-domain
        // full text AND a usable published TOC. Anything else gets NO facts-sheet on Hobby (web-grounded
        // sections exceed the 60s ceiling) → UNAVAILABLE until Vercel Pro re-enables grounding. This is
        // a missing best-effort artifact only — the book is already EXTRACTED and never touched.
        if (!loaded.fullTextIngested || loaded.sections.length === 0) {
            await step.run("mark-unavailable", async () => {
                await db.bookExtraction
                    .update({ where: { id: bookExtractionId }, data: { sectionsStatus: "UNAVAILABLE" } })
                    .catch((e) => console.error("[ingest-book-sections] mark UNAVAILABLE failed", e));
                return { sectionsStatus: "UNAVAILABLE" };
            });
            return {
                sectionsWritten: false,
                reason: loaded.fullTextIngested ? "no-toc" : "no-full-text",
            };
        }

        // Derive the facts-sheet from the full text, BATCHED so each step stays under Hobby-60s: per
        // batch, retrieve each section's most-relevant chunks (from the book's OWN embedded text) and
        // a single no-tools call structures them. Clear once, then append per batch.
        await step.run("clear-sections", async () => {
            await db.bookExtractionSection.deleteMany({ where: { bookExtractionId } });
            return {};
        });

        // 2 sections/step keeps each structuring call comfortably under Vercel's 60s (4 sections
        // measured ~32s locally → too close to the ceiling once Vercel cold-start + latency are added).
        const FACTS_BATCH = 2;
        const meta = { title: loaded.title, authors: loaded.authors };
        let written = 0;
        const numBatches = Math.ceil(loaded.sections.length / FACTS_BATCH);
        for (let b = 0; b < numBatches; b++) {
            const batch = loaded.sections.slice(b * FACTS_BATCH, b * FACTS_BATCH + FACTS_BATCH);
            const count = await step.run(`facts-${b}`, async () => {
                try {
                    const withExcerpts = [];
                    for (const s of batch) {
                        const chunks = await retrieveBookChunks(bookExtractionId, `${loaded.title} ${s.title}`, {
                            limit: 6,
                        });
                        withExcerpts.push({ ...s, excerpts: chunks.map((c) => c.content) });
                    }
                    const facts = await structureSectionsFromText(meta, withExcerpts);
                    if (facts.length === 0) return 0;
                    await db.bookExtractionSection.createMany({
                        data: facts.map((s) => ({
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
                            factsSource: "TEXT",
                        })),
                    });
                    return facts.length;
                } catch (e) {
                    console.error(`[ingest-book-sections facts-${b}] failed`, e);
                    return 0;
                }
            });
            written += count;
        }

        // Nothing produced (retrieval/structuring degraded across all batches) → UNAVAILABLE, book safe.
        if (written === 0) {
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
