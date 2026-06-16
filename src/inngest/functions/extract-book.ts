import { revalidateTag } from "next/cache";
import { inngest } from "@/inngest/client";
import { db, withTenant } from "@/server/db";
import { extractBookGrounded } from "@/lib/ai/book-extraction";
import { generateBookEmbedding } from "@/lib/utils/vector";

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

        return { success: true, bookExtractionId, triggeringBookId };
    },
);
