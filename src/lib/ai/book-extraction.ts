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

// ============================================================================
// Phase 2 — per-section ("spine") grounded extraction + objective classification.
//
// These mirror extractBookGrounded's posture exactly:
//   - the two-step ground(generateText + google_search on flash, retry-on-empty)
//     -> structure(generateObject) pipeline, and
//   - the never-throw / degrade-to-[] producer contract.
// They are pure AI producers: no DB access, no withTenant — the worker persists the
// results into the GLOBAL Phase-2 tables.
// ============================================================================

/** Per-chapter/section facts grounded in real public sources. */
export interface SectionFacts {
  sectionNumber: number;
  title: string;
  summary: string | null;
  keyPoints: string[];
  charactersPresent: string[];
  vocabulary: string[];
}

/** Metadata anchor for section extraction. tableOfContents pins the section list/numbers. */
interface SectionMeta {
  title: string;
  authors?: string[] | null;
  isbn?: string | null;
  tableOfContents?: unknown;
}

/** Zod schema for STEP 2 of extractBookSectionsGrounded — the per-section array. */
const sectionFactsSchema = z.object({
  sections: z.array(
    z.object({
      sectionNumber: z.number().int(),
      title: z.string(),
      summary: z.string(),
      keyPoints: z.array(z.string()),
      charactersPresent: z.array(z.string()),
      vocabulary: z.array(z.string()),
    }),
  ),
});

/**
 * Render the provided tableOfContents into a compact, human-readable anchor block so the
 * model is constrained to the REAL section list/numbers and does not invent chapters.
 * Returns null when no usable TOC is present.
 */
function describeTableOfContents(toc: unknown): string | null {
  if (!Array.isArray(toc) || toc.length === 0) return null;
  const lines: string[] = [];
  for (let i = 0; i < toc.length; i++) {
    const entry = toc[i];
    if (entry == null) continue;
    if (typeof entry === "string") {
      lines.push(`${i + 1}. ${entry}`);
      continue;
    }
    if (typeof entry === "object") {
      const e = entry as { chapterNumber?: unknown; sectionNumber?: unknown; number?: unknown; title?: unknown };
      const num =
        typeof e.chapterNumber === "number"
          ? e.chapterNumber
          : typeof e.sectionNumber === "number"
            ? e.sectionNumber
            : typeof e.number === "number"
              ? e.number
              : i + 1;
      const title = typeof e.title === "string" ? e.title : `Chapter ${num}`;
      lines.push(`${num}. ${title}`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

/** Human-readable line describing the book for grounding (section-extraction subset). */
function describeSectionBook(meta: SectionMeta): string {
  const authors = (meta.authors ?? []).filter(Boolean).join(", ");
  const lines = [
    `Title: ${meta.title}`,
    authors ? `Author(s): ${authors}` : null,
    meta.isbn ? `ISBN: ${meta.isbn}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Research a book chapter-by-chapter on the public web and return per-section facts.
 *
 * STEP 1 grounds (generateText + google_search on flash, with the same retry-on-empty loop
 * the file already uses) to gather, for each chapter: a 2-3 sentence summary, key events/
 * points, characters/figures present, and 3-5 vocabulary or key terms — anchored to
 * meta.tableOfContents when present so it does not invent chapters beyond the TOC.
 * STEP 2 structures that research into the per-section array via generateObject.
 *
 * NEVER throws — resolves to [] on any failure.
 */
export async function extractBookSectionsGrounded(meta: {
  title: string;
  authors?: string[] | null;
  isbn?: string | null;
  tableOfContents?: unknown;
}): Promise<SectionFacts[]> {
  try {
    const bookDescription = describeSectionBook(meta);
    const tocBlock = describeTableOfContents(meta.tableOfContents);

    // ---- STEP 1: GROUND — research the book chapter-by-chapter on the public web. ----
    const groundingPrompt =
      `Research this specific book on the public web, CHAPTER BY CHAPTER, and report what ` +
      `you find. Use authoritative sources: the publisher's page, Wikipedia, chapter ` +
      `summaries, study guides (e.g. SparkNotes/LitCharts/CliffsNotes), library catalogs, ` +
      `and reputable reviews. Use the metadata to make sure you are looking at the correct ` +
      `book and edition (match the ISBN when possible).\n\n` +
      `${bookDescription}\n\n` +
      (tocBlock
        ? `Use EXACTLY this published table of contents as the authoritative section list. ` +
          `Report on each of these sections, keeping these section numbers and titles. Do NOT ` +
          `add, drop, renumber, or invent chapters beyond this list:\n${tocBlock}\n\n`
        : `If you can find the real, published table of contents, use it as the authoritative ` +
          `section list (keep the published chapter numbers and titles in order). Do NOT invent ` +
          `chapters; if the structure had to be inferred, say so explicitly.\n\n`) +
      `For EACH chapter/section, report, as plainly and factually as you can:\n` +
      `1. The chapter number and title (exactly as published).\n` +
      `2. A 2-3 sentence factual summary of what happens / what it covers.\n` +
      `3. The key events or key points (a short list).\n` +
      `4. The characters or real figures present in that chapter.\n` +
      `5. 3-5 vocabulary words or key terms introduced or central to that chapter.\n` +
      `Cite the specific pages you used. Ground every claim in the sources.`;

    let researchNotes = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const groundingRes = await generateText({
        model: models.flash,
        // Provider-defined Google Search grounding tool. MUST be keyed "google_search".
        tools: { google_search: google.tools.googleSearch({}) },
        prompt: groundingPrompt,
      });

      // `res.sources` carries the grounding citations on this AI SDK version; fall back to the
      // raw grounding metadata chunks if it's empty. (We only use them to detect success here —
      // sections facts come from the structured pass, not the citation list.)
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
        break;
      }
    }

    // No usable research → degrade to []. (Producer contract: never throw.)
    if (researchNotes.length === 0) return [];

    // ---- STEP 2: STRUCTURE — convert the research notes into the per-section array. ----
    const structuredRes = await generateObject({
      model: models.flash,
      schema: sectionFactsSchema,
      prompt:
        `Convert the following chapter-by-chapter research notes about a book into structured ` +
        `JSON that matches the provided schema (an array of sections).\n\n` +
        (tocBlock
          ? `Anchor the section list to EXACTLY this published table of contents — use these ` +
            `section numbers and titles, in order, and produce exactly one entry per listed ` +
            `section. Do NOT add, drop, renumber, or invent chapters beyond this list:\n${tocBlock}\n\n`
          : `Preserve the real chapter list and ordering exactly as reported in the notes — do ` +
            `not add, drop, renumber, or rephrase chapters.\n\n`) +
        `For each section set:\n` +
        `- "sectionNumber": the chapter/section number (integer).\n` +
        `- "title": the chapter/section title.\n` +
        `- "summary": a 2-3 sentence factual summary grounded in the notes.\n` +
        `- "keyPoints": the key events or points (strings).\n` +
        `- "charactersPresent": characters or real figures present in that section.\n` +
        `- "vocabulary": 3-5 vocabulary words or key terms for that section.\n` +
        `Use empty arrays when a field is genuinely unknown; do not fabricate.\n\n` +
        `Book metadata (for context only):\n${bookDescription}\n\n` +
        `Researched notes:\n${researchNotes}`,
    });

    return structuredRes.object.sections ?? [];
  } catch (error) {
    // Graceful degradation: never throw out of the producer.
    console.error(
      `[book-extraction] extractBookSectionsGrounded failed for "${meta.title}" — returning [].`,
      error,
    );
    return [];
  }
}

/** Zod schema for classifySectionsToObjectives — per-section objective-code matches. */
const sectionObjectivesSchema = z.object({
  results: z.array(
    z.object({
      sectionNumber: z.number().int(),
      matches: z.array(
        z.object({
          code: z.string(),
          confidence: z.number(),
        }),
      ),
    }),
  ),
});

/**
 * Classify which curriculum objective CODES each book section covers.
 *
 * ONE generateObject call (no grounding needed — this is a reasoning/matching task over the
 * provided lists). The model is given the section list (number/title/summary) and the candidate
 * objective list (code + text) and must, for EACH section, return the objective codes it covers
 * (each with a confidence 0..1), using ONLY codes from the provided objective list.
 *
 * NEVER throws — resolves to [] on any failure. Output is filtered to in-list codes and a
 * confidence clamped to 0..1.
 */
export async function classifySectionsToObjectives(input: {
  sections: { sectionNumber: number; title: string; summary: string | null }[];
  objectives: { code: string; text: string }[];
}): Promise<{ sectionNumber: number; matches: { code: string; confidence: number }[] }[]> {
  try {
    // Nothing to classify against → degrade to [].
    if (input.sections.length === 0 || input.objectives.length === 0) return [];

    const allowedCodes = new Set(input.objectives.map((o) => o.code));

    const sectionsBlock = input.sections
      .map(
        (s) =>
          `- Section ${s.sectionNumber}: ${s.title}` +
          (s.summary ? `\n    Summary: ${s.summary}` : ""),
      )
      .join("\n");

    const objectivesBlock = input.objectives
      .map((o) => `- ${o.code}: ${o.text}`)
      .join("\n");

    const res = await generateObject({
      model: models.flash,
      schema: sectionObjectivesSchema,
      prompt:
        `You are mapping the sections of a book to the curriculum learning objectives they ` +
        `cover. For EACH section below, decide which objectives (from the CANDIDATE OBJECTIVES ` +
        `list ONLY) that section's content covers, and assign each a confidence from 0 to 1 ` +
        `(1 = the section squarely teaches/addresses that objective; lower = a weaker or ` +
        `partial connection).\n\n` +
        `Rules:\n` +
        `- Only use objective codes that appear EXACTLY in the candidate list below. Never ` +
        `invent codes.\n` +
        `- A section may cover zero, one, or several objectives. Return an empty "matches" array ` +
        `for a section that covers none.\n` +
        `- Include every section, identified by its sectionNumber.\n\n` +
        `SECTIONS:\n${sectionsBlock}\n\n` +
        `CANDIDATE OBJECTIVES (code: description):\n${objectivesBlock}`,
    });

    const raw = res.object.results ?? [];
    // Defensive: keep only in-list codes and clamp confidence to [0,1].
    return raw.map((r) => ({
      sectionNumber: r.sectionNumber,
      matches: (r.matches ?? [])
        .filter((m) => allowedCodes.has(m.code))
        .map((m) => ({
          code: m.code,
          confidence: Math.max(0, Math.min(1, m.confidence)),
        })),
    }));
  } catch (error) {
    // Graceful degradation: never throw out of the producer.
    console.error(
      `[book-extraction] classifySectionsToObjectives failed — returning [].`,
      error,
    );
    return [];
  }
}
