import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { models } from "@/lib/ai/config";

/**
 * book-extraction.ts — the web-search-grounded PRODUCER core for the cross-org
 * shared BOOK EXTRACTION feature.
 *
 * Grounding tools (google_search) CANNOT be combined with generateObject, so this
 * runs a deliberate TWO-STEP pipeline:
 *   1) generateText + google.tools.googleSearch  -> research THIS book on the public web,
 *      collect a free-text research dump and the grounding `sources`.
 *   2) generateObject (no tools)                  -> structure that research into JSON.
 *
 * This function is the producer half of the feature: it NEVER throws. On any failure it
 * degrades gracefully so the worker can still record a status (EXTRACTED/FAILED) and so a
 * `BookExtractionResult` is always returned.
 */

export type BookExtractionStage = "perfect-parse" | "chapter-parse" | "manual-needed";

export interface BookExtractionResult {
  summary: string | null;
  tableOfContents: Array<{
    chapterNumber?: number;
    title: string;
    topics?: string[];
    keyConcepts?: string[];
  }>;
  readingLevel: string | null;
  mainThemes: string[];
  sources: Array<{ title?: string; url: string }>;
  confidence: string | null;
  stage: BookExtractionStage;
}

interface BookMeta {
  title: string;
  authors?: string[] | null;
  isbn?: string | null;
  publisher?: string | null;
  publishedDate?: string | null;
  description?: string | null;
  pageCount?: number | null;
  subject?: string | null;
}

/**
 * Zod schema for STEP 2. Grounding sources are intentionally NOT part of this schema —
 * they come from the step-1 grounding metadata, not from the model's structured guess.
 */
const structuredSchema = z.object({
  summary: z.string(),
  tableOfContents: z.array(
    z.object({
      chapterNumber: z.number().optional(),
      title: z.string(),
      topics: z.array(z.string()).optional(),
      keyConcepts: z.array(z.string()).optional(),
    }),
  ),
  readingLevel: z.string(),
  mainThemes: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  stage: z.enum(["perfect-parse", "chapter-parse", "manual-needed"]),
});

/** Human-readable line describing the book, used to disambiguate the exact edition. */
function describeBook(meta: BookMeta): string {
  const authors = (meta.authors ?? []).filter(Boolean).join(", ");
  const lines = [
    `Title: ${meta.title}`,
    authors ? `Author(s): ${authors}` : null,
    meta.isbn ? `ISBN: ${meta.isbn}` : null,
    meta.publisher ? `Publisher: ${meta.publisher}` : null,
    meta.publishedDate ? `Published: ${meta.publishedDate}` : null,
    meta.pageCount ? `Page count: ${meta.pageCount}` : null,
    meta.subject ? `Subject: ${meta.subject}` : null,
    meta.description ? `Publisher description: ${meta.description}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Defensively map the AI SDK `sources` array to `{ title?, url }[]`.
 * The Source type is a discriminated union: `url` sources carry `.url` (+ optional `.title`);
 * `document` sources carry `.title` but NO `.url`. Some providers/versions may also hand back
 * bare url objects or strings. We keep only entries we can resolve a URL for.
 */
function mapSources(rawSources: unknown): Array<{ title?: string; url: string }> {
  if (!Array.isArray(rawSources)) return [];
  const out: Array<{ title?: string; url: string }> = [];
  for (const entry of rawSources) {
    if (!entry) continue;
    if (typeof entry === "string") {
      out.push({ url: entry });
      continue;
    }
    if (typeof entry === "object") {
      const e = entry as { url?: unknown; title?: unknown; href?: unknown };
      const url =
        typeof e.url === "string"
          ? e.url
          : typeof e.href === "string"
            ? e.href
            : undefined;
      if (!url) continue; // skip document/non-url sources — nothing to link to
      const title = typeof e.title === "string" ? e.title : undefined;
      out.push(title ? { title, url } : { url });
    }
  }
  return out;
}

/**
 * Build a degraded fallback result when grounding/structuring fails.
 * - If we know the page count, synthesize ~ceil(pageCount/25) generic chapters (chapter-parse).
 * - Otherwise return a minimal result flagged manual-needed.
 */
function buildFallback(
  meta: BookMeta,
  sources: Array<{ title?: string; url: string }>,
): BookExtractionResult {
  const base: BookExtractionResult = {
    summary: meta.description ?? null,
    tableOfContents: [],
    readingLevel: null,
    mainThemes: [],
    sources,
    confidence: "low",
    stage: "manual-needed",
  };

  if (meta.pageCount && meta.pageCount > 0) {
    const chapterCount = Math.max(1, Math.ceil(meta.pageCount / 25));
    base.tableOfContents = Array.from({ length: chapterCount }, (_, i) => ({
      chapterNumber: i + 1,
      title: `Chapter ${i + 1}`,
    }));
    base.stage = "chapter-parse";
  }

  return base;
}

/**
 * Extract structured book information grounded in real, public web sources.
 * NEVER throws — always resolves to a BookExtractionResult (possibly a degraded fallback).
 */
export async function extractBookGrounded(meta: BookMeta): Promise<BookExtractionResult> {
  const bookDescription = describeBook(meta);
  let sources: Array<{ title?: string; url: string }> = [];

  try {
    // ---- STEP 1: GROUND — research this specific book on the public web (with retry). ----
    // Use models.flash (gemini-3.5-flash) for grounding: it grounds reliably with ~25 targeted-
    // query sources and is cheap. flash still intermittently returns an empty, content-filtered
    // response, so retry until we get real grounded output. (Verified empirically 2026-06-17.)
    const groundingPrompt =
      `Research this specific book on the public web and report what you find. ` +
      `Use authoritative sources: the publisher's page, Wikipedia, Google Books, library ` +
      `catalogs, and reputable reviews. Use the metadata below to make sure you are looking ` +
      `at the correct edition (match the ISBN, publisher and year when possible).\n\n` +
      `${bookDescription}\n\n` +
      `Report, as plainly and factually as you can:\n` +
      `1. The REAL table of contents — the actual chapter list, in order, with chapter ` +
      `numbers and titles exactly as published. If you can only find a partial or inferred ` +
      `structure, say so explicitly.\n` +
      `2. A factual summary of what the book is about (2-4 paragraphs).\n` +
      `3. The reading level / target grade or audience (e.g. "Grade 5-6", "Young Adult", ` +
      `"College", "General adult").\n` +
      `4. The main themes or topics the book covers.\n` +
      `Cite the specific pages you used. Do not invent chapters; if the real table of ` +
      `contents is not available, clearly state that it had to be inferred.`;

    let researchNotes = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const groundingRes = await generateText({
        model: models.flash,
        // Provider-defined Google Search grounding tool. MUST be keyed "google_search".
        tools: { google_search: google.tools.googleSearch({}) },
        prompt: groundingPrompt,
      });

      // `res.sources` carries the grounding citations on this AI SDK version; fall back to the
      // raw grounding metadata chunks if it's empty.
      let attemptSources = mapSources((groundingRes as { sources?: unknown }).sources ?? []);
      if (attemptSources.length === 0) {
        const chunks = (
          groundingRes.providerMetadata as
            | { google?: { groundingMetadata?: { groundingChunks?: unknown } } }
            | undefined
        )?.google?.groundingMetadata?.groundingChunks;
        if (Array.isArray(chunks)) {
          attemptSources = chunks
            .map((c) => {
              const web = (c as { web?: { uri?: unknown; title?: unknown } })?.web;
              const url = typeof web?.uri === "string" ? web.uri : undefined;
              const title = typeof web?.title === "string" ? web.title : undefined;
              return url ? (title ? { title, url } : { url }) : null;
            })
            .filter((s): s is { title?: string; url: string } => s !== null);
        }
      }

      const text = groundingRes.text ?? "";
      // Success = we got real research text and/or citations. Empty (content-filtered) → retry.
      if (text.length > 0 || attemptSources.length > 0) {
        researchNotes = text;
        sources = attemptSources;
        break;
      }
    }

    // ---- STEP 2: STRUCTURE — convert the research notes into JSON (no tools). ----
    // Also flash, for the same reliability reason (pro preview over-filters).
    const structuredRes = await generateObject({
      model: models.flash,
      schema: structuredSchema,
      prompt:
        `Convert the following researched notes about a book into structured JSON that ` +
        `matches the provided schema. Preserve the real chapter list and ordering exactly ` +
        `as reported in the notes — do not add, drop, renumber, or rephrase chapters.\n\n` +
        `Set "stage" as follows:\n` +
        `- "perfect-parse" if the notes contain the REAL, published table of contents.\n` +
        `- "chapter-parse" if chapters had to be inferred or are only approximate.\n` +
        `- "manual-needed" if there is not enough information to produce a usable chapter list.\n\n` +
        `Set "confidence" (high/medium/low) based on how authoritative and complete the ` +
        `source notes are. Keep the summary factual and grounded in the notes.\n\n` +
        `Book metadata (for context only):\n${bookDescription}\n\n` +
        `Researched notes:\n${researchNotes}`,
    });

    const obj = structuredRes.object;

    return {
      summary: obj.summary ?? null,
      tableOfContents: obj.tableOfContents ?? [],
      readingLevel: obj.readingLevel ?? null,
      mainThemes: obj.mainThemes ?? [],
      sources,
      confidence: obj.confidence ?? null,
      stage: obj.stage,
    };
  } catch (error) {
    // Graceful degradation: never throw out of the producer. Keep whatever sources we
    // already gathered in step 1 (if step 2 was the part that failed).
    console.error(
      `[book-extraction] extractBookGrounded failed for "${meta.title}" — returning degraded fallback.`,
      error,
    );
    return buildFallback(meta, sources);
  }
}
