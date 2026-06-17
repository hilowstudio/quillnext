import { db, withTenant } from "@/server/db";
import { getPlaylistDetails } from "@/app/actions/youtube-actions";
import { models } from "@/lib/ai/config";
import { generateText, tool } from "ai";
import { PHILOSOPHY_PROMPTS } from "@/lib/constants/educational-philosophies";
import { EducationalPhilosophy } from "@/generated/client";
import { PromptBuilder } from "@/lib/ai/prompt-builder";
import { z } from "zod";
import { generateNanoBananaImage } from "@/lib/services/image-generation";
import { generateObject } from "ai";
import { QuizSchema, WorksheetSchema } from "@/lib/ai/schemas";
import {
    QUOTE_GROUNDING_RULE,
    QUOTE_GROUNDING_RULE_WITH_SOURCE,
    buildCanonicalFactsBlock,
    verifyAndReviseMarkdown,
    verifyAndReviseObject,
} from "@/lib/ai/generation-guards";
import { retrieveBookChunks } from "@/lib/utils/vector";

// Helper to determine ingestion tier (deprecated, using DB flag)

/**
 * Coerce a Prisma Json? value (usually a string[]) into a clean string[] defensively.
 * Section facts (keyPoints/charactersPresent/vocabulary) are stored as Json.
 */
function toStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((v) => (v ?? "").toString().trim()).filter(Boolean);
}

/**
 * Compactly render a book section's facts sheet (key points, characters, vocabulary)
 * for use as grounding context when generation is scoped to that chapter.
 */
function renderSectionFacts(section: {
    summary: string | null;
    keyPoints: unknown;
    charactersPresent: unknown;
    vocabulary: unknown;
}): string {
    const keyPoints = toStringList(section.keyPoints);
    const characters = toStringList(section.charactersPresent);
    const vocabulary = toStringList(section.vocabulary);

    const lines: string[] = [];
    if (section.summary?.trim()) lines.push(`Section summary: ${section.summary.trim()}`);
    if (keyPoints.length > 0) lines.push(`Key points:\n${keyPoints.map((p) => `- ${p}`).join("\n")}`);
    if (characters.length > 0) lines.push(`Characters present: ${characters.join(", ")}`);
    if (vocabulary.length > 0) lines.push(`Vocabulary: ${vocabulary.join(", ")}`);
    return lines.join("\n");
}

export interface GenerateResourceCoreParams {
    organizationId: string;
    userId: string;
    sourceId: string;
    sourceType: "BOOK" | "VIDEO" | "COURSE" | "TOPIC" | "URL" | "FILE" | "YOUTUBE_PLAYLIST";
    resourceKindId: string;
    instructions?: string;
    additionalData?: {
        topicText?: string;
        url?: string;
        fileContent?: string;
        fileName?: string;
        studentId?: string;
        // Phase-2 (grounded-generation): when targeting a specific chapter of a BOOK,
        // scope generation to that section's facts sheet (book_extraction_sections).
        sectionNumber?: number;
    };
}

/**
 * Session-less core generation. Identity (organizationId, userId) is passed in by
 * the caller: the browser wrapper (generate-resource.ts) authenticates and forwards
 * it; the Inngest compiler forwards the org/user it carried on the event. This file
 * is intentionally NOT "use server", so it is never exposed as an unauthenticated
 * server action.
 */
export async function generateResourceCore(params: GenerateResourceCoreParams) {
    const { organizationId, userId, sourceId, sourceType, resourceKindId, instructions, additionalData } = params;

    // 1. Fetch Resource Kind (Template/Prompt)
    const kind = await db.resourceKind.findUnique({
        where: { id: resourceKindId },
        select: {
            id: true,
            label: true,
            description: true,
            contentType: true,
            requiresVision: true,
        }
    });
    if (!kind) throw new Error("Resource Kind not found");

    // 1b. Fetch User's Classroom Context for Persona (Philosophy & Faith)
    // We try to find a classroom created by this user to determine their style.
    // Org-scoped table: stamp the explicit tenant (no request session in the Inngest runtime).
    const classroom = await withTenant(
        (tx) => tx.classroom.findFirst({ where: { createdByUserId: userId } }),
        undefined,
        { organizationId, userId },
    );

    // 1c. Fetch Student Context if provided
    let student = null;
    if (additionalData?.studentId) {
        const studentId = additionalData.studentId;
        student = await withTenant(
            (tx) => tx.student.findUnique({ where: { id: studentId } }),
            undefined,
            { organizationId, userId },
        );
    }


    const ingestionTier = kind.requiresVision ? "DEEP_VISION" : "TEXT_ONLY";

    // 2. Fetch Source Content & Configure Model
    let context = "";
    let sourceTitle = "";
    let bookId: string | undefined;
    let videoId: string | undefined;
    let genContext: any = undefined;
    let modelToUse = models.flash;
    let tools: any = {};
    // Authoritative "canonical facts" block injected into the prompt + used by the
    // post-generation verify/revise pass (grounded-generation spec, Phase 1).
    let factsBlock = "";

    // Phase-3 RAG grounding (grounded-generation spec): when a BOOK has ingested full
    // text (public domain → book_text_chunks), we retrieve verified excerpts the model
    // MAY quote verbatim, switch to the source-aware quote rule, and let the verify pass
    // keep quotes that appear in those excerpts. Defaults preserve Phase-1 behavior
    // (no excerpts → blanket quote rule, nothing kept verbatim).
    let quoteRule = QUOTE_GROUNDING_RULE;
    let excerptsBlock = "";
    let allowedQuoteSource = "";

    if (sourceType === "BOOK") {
        // ... (existing book logic) ...
        // Extend the book select to also read the linked extraction (mainThemes /
        // readingLevel). BookExtraction is a global, context-free table, so including
        // it here is RLS-safe and does not introduce a nested/extra transaction.
        const book = await withTenant(
            (tx) => tx.book.findUnique({
                where: { id: sourceId },
                select: {
                    title: true,
                    authors: true,
                    summary: true,
                    tableOfContents: true,
                    organizationId: true,
                    bookExtractionId: true,
                    bookExtraction: {
                        select: {
                            mainThemes: true,
                            readingLevel: true,
                            // Phase-3: provenance for full-text RAG grounding.
                            fullTextStatus: true,
                            publicDomain: true,
                        },
                    },
                },
            }),
            undefined,
            { organizationId, userId },
        );
        if (!book || book.organizationId !== organizationId) throw new Error("Book not found");

        context = `Book Title: ${book.title}\nSummary: ${book.summary || "N/A"}`;
        if (book.tableOfContents) {
            context += `\nTable of Contents: ${JSON.stringify(book.tableOfContents)}`;
        }
        sourceTitle = book.title || "Untitled Book";
        bookId = sourceId;

        // Normalize authors (Json? — usually a string[]) defensively.
        const authors = Array.isArray(book.authors)
            ? (book.authors as unknown[]).map((a) => (a ?? "").toString().trim()).filter(Boolean)
            : [];

        // Phase-2 section scoping (grounded-generation): when the parent targets a
        // specific chapter AND this book has an extraction, load that section's facts
        // sheet and anchor generation to it. The section table is GLOBAL / context-free,
        // so it is read with PLAIN db (NOT withTenant — never nest tenant transactions).
        const sectionNumber = additionalData?.sectionNumber;
        let section: {
            sectionNumber: number;
            title: string;
            summary: string | null;
            keyPoints: unknown;
            charactersPresent: unknown;
            vocabulary: unknown;
        } | null = null;
        if (typeof sectionNumber === "number" && book.bookExtractionId) {
            section = await db.bookExtractionSection.findUnique({
                where: {
                    bookExtractionId_sectionNumber: {
                        bookExtractionId: book.bookExtractionId,
                        sectionNumber,
                    },
                },
                select: {
                    sectionNumber: true,
                    title: true,
                    summary: true,
                    keyPoints: true,
                    charactersPresent: true,
                    vocabulary: true,
                },
            });
        }

        if (section) {
            // Scope the canonical facts to THIS chapter: lead with the target section,
            // then carry the book-level title + themes as background context.
            const n = section.sectionNumber;
            sourceTitle = `${book.title || "Untitled Book"} — Chapter ${n}: ${section.title}`;

            const sectionFacts = renderSectionFacts(section);
            const bookContextLines = [
                `Book: ${book.title || "Untitled Book"}`,
                authors.length > 0 ? `Author(s): ${authors.join(", ")}` : "",
                book.bookExtraction?.readingLevel ? `Reading level: ${book.bookExtraction.readingLevel}` : "",
                (book.bookExtraction?.mainThemes && book.bookExtraction.mainThemes.length > 0)
                    ? `Book themes: ${book.bookExtraction.mainThemes.join(", ")}`
                    : "",
                book.summary ? `Book summary (background): ${book.summary}` : "",
            ].filter(Boolean);

            const sectionExtra = [
                `TARGET SECTION FOR THIS MATERIAL: Chapter ${n}: ${section.title}`,
                sectionFacts,
                "",
                "BACKGROUND CONTEXT (the book this chapter belongs to):",
                bookContextLines.join("\n"),
            ].filter(Boolean).join("\n");

            // Drive generation from this chapter: the model sees the section as the
            // primary content (via context) and the canonical facts lead with it too.
            context = sectionExtra;

            factsBlock = buildCanonicalFactsBlock({
                sourceKind: "BOOK",
                title: `Chapter ${n}: ${section.title}`,
                authors,
                summary: section.summary,
                themes: book.bookExtraction?.mainThemes,
                readingLevel: book.bookExtraction?.readingLevel,
                extra: sectionExtra,
            });
        } else {
            factsBlock = buildCanonicalFactsBlock({
                sourceKind: "BOOK",
                title: book.title,
                authors,
                summary: book.summary,
                tableOfContents: book.tableOfContents,
                themes: book.bookExtraction?.mainThemes,
                readingLevel: book.bookExtraction?.readingLevel,
                extra: context,
            });
        }

        // Phase-3 RAG (grounded-generation spec): if this book has INGESTED full text
        // (public-domain works mirrored into the GLOBAL book_text_chunks catalog), pull
        // verified excerpts the model MAY quote verbatim. book_text_chunks is GLOBAL /
        // context-free, so retrieveBookChunks reads on PLAIN db (NOT withTenant — never
        // nest tenant transactions). Best-effort: retrieveBookChunks never throws, and an
        // empty result simply leaves the Phase-1 (no-excerpt) behavior in place.
        const ext = book.bookExtraction;
        const hasFullText =
            !!book.bookExtractionId &&
            (ext?.fullTextStatus === "INGESTED" || !!ext?.publicDomain);
        if (hasFullText && book.bookExtractionId) {
            // Query = resource kind label + the targeted section title (when scoped to a
            // chapter), else the book title plus its themes.
            const themeHint =
                ext?.mainThemes && ext.mainThemes.length > 0
                    ? ` ${ext.mainThemes.join(", ")}`
                    : "";
            const subject = section?.title
                ? ` ${section.title}`
                : ` ${book.title || ""}${themeHint}`;
            const ragQuery = `${kind.label}${subject}`.trim();

            const chunks = await retrieveBookChunks(book.bookExtractionId, ragQuery, {
                sectionNumber: additionalData?.sectionNumber ?? null,
                limit: 6,
            });

            const excerpts = chunks
                .map((c) => c.content?.trim())
                .filter((c): c is string => !!c);

            if (excerpts.length > 0) {
                excerptsBlock = [
                    "VERIFIED SOURCE EXCERPTS (you MAY quote these verbatim, with attribution):",
                    ...excerpts.map((c, i) => `[Excerpt ${i + 1}]\n${c}`),
                ].join("\n\n");
                // The verify pass keeps quotes found in these excerpts (instead of removing all).
                allowedQuoteSource = excerpts.join("\n\n");
                // The model is now allowed to quote — but ONLY from the excerpts above.
                quoteRule = QUOTE_GROUNDING_RULE_WITH_SOURCE;
            }
        }
    } else if (sourceType === "VIDEO") {
        // ... (existing video logic) ...
        const video = await withTenant(
            (tx) => tx.videoResource.findUnique({
                where: { id: sourceId },
                select: { title: true, extractedSummary: true, extractedKeyPoints: true, organizationId: true },
            }),
            undefined,
            { organizationId, userId },
        );
        if (!video || video.organizationId !== organizationId) throw new Error("Video not found");

        context = `Video Title: ${video.title}\nSummary: ${video.extractedSummary || "N/A"}`;
        if (video.extractedKeyPoints) {
            context += `\nKey Points: ${JSON.stringify(video.extractedKeyPoints)}`;
        }
        sourceTitle = video.title || "Untitled Video";
        videoId = sourceId;
    } else if (sourceType === "COURSE") {
        // ... (existing course logic) ...
        // Both reads are org-scoped and must be consistent — group them in one tenant tx.
        const { course, blocks } = await withTenant(
            async (tx) => {
                const course = await tx.course.findUnique({
                    where: { id: sourceId },
                    select: {
                        title: true,
                        description: true,
                        organizationId: true,
                    },
                });
                const blocks = await tx.courseBlock.findMany({
                    where: { courseId: sourceId },
                    orderBy: { position: "asc" },
                    select: { title: true, description: true, kind: true }
                });
                return { course, blocks };
            },
            undefined,
            { organizationId, userId },
        );
        if (!course || course.organizationId !== organizationId) throw new Error("Course not found");

        context = `Course Title: ${course.title}\nDescription: ${course.description || "N/A"}`;
        if (blocks.length > 0) {
            context += `\nCourse Structure:\n${blocks.map(b => `- [${b.kind}] ${b.title}: ${b.description || ""}`).join("\n")}`;
        }
        sourceTitle = course.title;
        genContext = { source: "COURSE", courseId: sourceId };
    } else if (sourceType === "TOPIC") {
        // ... (existing topic logic) ...
        context = `Topic/Objective: ${additionalData?.topicText || sourceId}`;
        sourceTitle = (additionalData?.topicText || sourceId).substring(0, 50);
        genContext = { source: "TOPIC", topic: additionalData?.topicText || sourceId };
    } else if (sourceType === "URL") {
        // ... (existing url logic) ...
        const url = additionalData?.url || sourceId;
        context = `Web Article URL: ${url}\n(Note: AI will attempt to access knowledge about this URL or generate based on the topic inferred from the URL)`;
        sourceTitle = `Article: ${url}`;
        genContext = { source: "URL", url: url };
    } else if (sourceType === "FILE") {
        // ... (existing file logic) ...
        context = `File Content (${additionalData?.fileName}):\n${additionalData?.fileContent || "No content extracted."}`;
        sourceTitle = `File: ${additionalData?.fileName || "Uploaded File"}`;
        genContext = { source: "FILE", fileName: additionalData?.fileName };
    } else if (sourceType === "YOUTUBE_PLAYLIST") {
        // YOUTUBE PLAYLIST LOGIC
        const playlistUrl = additionalData?.url || sourceId;

        if (ingestionTier === "DEEP_VISION") {
            // Tier 1: Deep Vision with Google Grounding
            // We pass the URL directly and ask the model to use its search/grounding capabilities
            modelToUse = models.pro; // Use Pro model for better reasoning/grounding

            // In a real production app with AI SDK 3.0+, we would enable google_search_retrieval tool here.
            // For this implementation, we will instruct the model strongly.
            context = `YouTube Playlist URL: ${playlistUrl}\nINSTRUCTION: Please Watch/Search the videos in this playlist using your grounding capabilities. Inspect visual details as requested by the task.`;
            // Note: If using Vertex AI SDK, we would pass tools: [{ googleSearchRetrieval: {} }]
            // Assuming the configured 'models.pro' might have this default or we rely on the prompt for now.

        } else {
            // Tier 2: Text/Metadata Only (Cheaper/Faster)
            const playlistData = await getPlaylistDetails(playlistUrl);
            if (!playlistData.success || !playlistData.data) throw new Error("Could not fetch playlist metadata.");

            const p = playlistData.data;
            context = `YouTube Playlist: ${p.title} by ${p.author}\nDescription: ${p.description}\n\nVideos (Top ${p.videos.length}):\n`;
            context += p.videos.map(v => `- [${v.title}]: ${v.description.substring(0, 200)}...`).join("\n");
        }

        sourceTitle = `Playlist: ${playlistUrl}`;
        genContext = { source: "YOUTUBE_PLAYLIST", url: playlistUrl, ingestionTier };
    }

    // For every non-BOOK source type, still build a canonical-facts block from the
    // assembled context so those sources also get grounding + the quote rule.
    if (!factsBlock) {
        factsBlock = buildCanonicalFactsBlock({
            sourceKind: sourceType,
            title: sourceTitle,
            extra: context,
        });
    }

    // 3. Generate Content
    // 3. Generate Content using PromptBuilder (Inkling 2.0)
    const builder = new PromptBuilder()
        .setIdentity() // Uses default INKLING_BASE_PERSONALITY
        .setStudentContext(student)
        .setFamilyContext(classroom)
        .setTask(
            `Create a "${kind.label}" (${kind.contentType})`,
            kind.description || "No specific context provided."
        )
        .setSourceContent(context)
        // Inject the canonical facts + (optional) verified source excerpts + quote-grounding
        // rule into what the model sees. The excerpts block is appended AFTER the canonical
        // facts; when present, `quoteRule` is QUOTE_GROUNDING_RULE_WITH_SOURCE (verbatim quotes
        // allowed, but only from those excerpts). PromptBuilder stores these verbatim and
        // build() interpolates them directly.
        .setUserInstructions(
            [instructions || "", factsBlock, excerptsBlock, quoteRule].filter(Boolean).join("\n\n"),
        );

    const prompt = builder.build();

    let textContent = "";
    let jsonContent = null;
    let storageType: "MARKDOWN" | "JSON" = "MARKDOWN";

    if (kind.contentType === "QUIZ") {
        // Structured Output for Quizzes
        const { object } = await generateObject({
            model: models.pro3, // Use Pro model for structured generation
            schema: QuizSchema,
            system: builder.getIdentity(),
            prompt: prompt,
        });
        jsonContent = object;
        storageType = "JSON";
    } else if (kind.contentType === "WORKSHEET") {
        // Structured Output for Worksheets
        const { object } = await generateObject({
            model: models.pro3,
            schema: WorksheetSchema,
            system: builder.getIdentity(),
            prompt: prompt,
        });
        jsonContent = object;
        storageType = "JSON";
    } else {
        // Standard Text Generation (Markdown)
        const { text } = await generateText({
            model: modelToUse,
            prompt: prompt,
            system: builder.getIdentity(),
            tools: {
                generate_image: tool({
                    description: "Generates an image (Nano Banana) based on a prompt. Use this to create visual aids like diagrams, charts, or illustrations.",
                    parameters: z.object({
                        prompt: z.string().describe("The detailed description of the image to generate."),
                        aspectRatio: z.enum(["1:1", "16:9", "4:3"]).optional().default("1:1"),
                    }),
                    execute: async (args: any) => {
                        const { prompt, aspectRatio } = args;
                        const base64 = await generateNanoBananaImage(prompt, aspectRatio as "1:1" | "16:9" | "4:3");
                        if (!base64) return "Failed to generate image.";
                        return `![Generated Image](data:image/png;base64,${base64})`;
                    },
                } as any),
            },
            // maxSteps: 3, // Removed temporarily due to type definition mismatch
        });
        textContent = text;
        storageType = "MARKDOWN";
    }

    // 3b. Verify & revise BEFORE storage (grounded-generation spec, Phase 1).
    // Best-effort and OUTSIDE any withTenant DB write — these are pure AI calls that
    // fix contradictions vs. the canonical facts, ungrounded verbatim quotes, and
    // garbled questions. They never throw; on error the original draft is kept.
    if (kind.contentType === "QUIZ") {
        jsonContent = await verifyAndReviseObject(jsonContent as any, QuizSchema, factsBlock, models.pro3, allowedQuoteSource);
    } else if (kind.contentType === "WORKSHEET") {
        jsonContent = await verifyAndReviseObject(jsonContent as any, WorksheetSchema, factsBlock, models.pro3, allowedQuoteSource);
    } else {
        // Markdown verification uses the fast/cheap flash model.
        textContent = await verifyAndReviseMarkdown(textContent, factsBlock, models.flash, allowedQuoteSource);
    }

    // 4. Save to DB (org-scoped write — stamp the explicit tenant).
    const resource = await withTenant(
        (tx) => tx.resource.create({
            data: {
                organizationId,
                createdByUserId: userId,
                resourceKindId,
                title: `${kind.label}: ${sourceTitle.substring(0, 100)}`, // Truncate title
                description: `AI Generated from ${sourceType.toLowerCase()}: ${sourceTitle.substring(0, 100)}`,
                storageType: storageType,
                content: storageType === "JSON" ? (jsonContent as any) : { markdown: textContent },
                generatedFromBookId: bookId,
                generatedFromVideoId: videoId,
                generationContext: genContext,
            },
        }),
        undefined,
        { organizationId, userId },
    );

    return { success: true, resourceId: resource.id };
}
