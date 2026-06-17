/**
 * text-processing.ts — pure, dependency-free text utilities for the full-text RAG source layer
 * (Phase 3 of grounded generation).
 *
 * These functions take a raw public-domain book body (typically a Project Gutenberg plain-text
 * file) and turn it into the shapes the embedding pipeline consumes:
 *
 *   stripGutenbergBoilerplate — peel off the "*** START … ***" / "*** END … ***" wrapper plus the
 *                               license preamble/tail so only the work's own text remains.
 *   chunkText                  — overlapping 300-word / 50-overlap windows for embedding (mirrors
 *                               youtube/transcript.ts chunkTranscript exactly).
 *   segmentIntoChapters        — detect chapter boundaries (CHAPTER / Roman / numbered headings),
 *                               optionally aligned to a provided table-of-contents, so chunks can be
 *                               attributed to a section_number.
 *
 * All three are PURE: no I/O, no DB, no throwing on ordinary input. They degrade to sensible
 * defaults (empty string / [] / a single "Full text" section) rather than blowing up the worker.
 */

/**
 * Remove the Project Gutenberg boilerplate wrapper from a plain-text ebook body.
 *
 * Gutenberg files bracket the actual work between two marker lines whose exact wording varies
 * slightly across decades of releases, e.g.:
 *   *** START OF THE PROJECT GUTENBERG EBOOK MOBY DICK ***
 *   *** START OF THIS PROJECT GUTENBERG EBOOK … ***
 *   *** START OF THE PROJECT GUTENBERG EBOOK, … ***
 *   ***START OF THE PROJECT GUTENBERG EBOOK …***   (no spaces)
 * and a matching "*** END OF …" at the tail, after which a long license/legal section follows.
 *
 * Strategy (robust to the variants):
 *  - Find the START marker and keep everything AFTER it.
 *  - Find the END marker and keep everything BEFORE it.
 *  - As a belt-and-braces fallback for files that only carry a "Produced by …" / license preamble
 *    without the canonical markers, trim a leading licensing block when detectable.
 *  - Always trim surrounding whitespace.
 *
 * Never throws; returns the original (trimmed) text when no markers are present.
 */
export function stripGutenbergBoilerplate(text: string): string {
  if (!text || typeof text !== "string") return "";

  let body = text;

  // The markers are case-insensitive in practice and may omit spaces around the asterisks, carry
  // a comma, and use "THE"/"THIS". Match the whole marker line generously and capture nothing —
  // we only need its position. We deliberately match up to the trailing asterisks on the SAME line.
  const startMarker =
    /\*{2,}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*{2,}/is;
  const endMarker =
    /\*{2,}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*{2,}/is;

  const startMatch = body.match(startMarker);
  if (startMatch && startMatch.index !== undefined) {
    body = body.slice(startMatch.index + startMatch[0].length);
  }

  const endMatch = body.match(endMarker);
  if (endMatch && endMatch.index !== undefined) {
    body = body.slice(0, endMatch.index);
  }

  // Fallback: older/edge files use "*** END OF THE PROJECT GUTENBERG …" variants without "EBOOK",
  // or a bare "End of the Project Gutenberg EBook" sentence. Cut at the first such line if present
  // and we didn't already find the canonical end marker.
  if (!endMatch) {
    const looseEnd = body.match(/\n\s*End of (?:the )?Project Gutenberg.*$/is);
    if (looseEnd && looseEnd.index !== undefined) {
      body = body.slice(0, looseEnd.index);
    }
  }

  return body.trim();
}

/**
 * Split arbitrary text into overlapping word-window chunks for embedding.
 *
 * Window: 300 words, 50-word overlap (step 250) — IDENTICAL to youtube/transcript.ts chunkTranscript
 * so the book and video pipelines produce comparable chunk granularity. Chunks shorter than 50
 * characters (after trimming) are dropped so trailing fragments don't pollute the index.
 * Returns [] for empty/whitespace input. Never throws.
 */
export function chunkText(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const WINDOW = 300;
  const OVERLAP = 50;
  const STEP = WINDOW - OVERLAP; // 250

  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += STEP) {
    const chunk = words.slice(start, start + WINDOW).join(" ").trim();
    if (chunk.length >= 50) chunks.push(chunk);
    if (start + WINDOW >= words.length) break; // last window covered the tail
  }

  return chunks;
}

/** A detected heading: where it starts in the source, its raw line, and a normalized title. */
interface HeadingHit {
  index: number; // byte offset of the line start within `text`
  rawTitle: string; // the heading line, trimmed
}

/** Normalize a title for fuzzy comparison: lowercase, strip punctuation, collapse whitespace. */
function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect chapter-style heading lines and return their positions.
 *
 * Recognizes, as a STANDALONE line (optionally surrounded by blank lines):
 *  - "CHAPTER I", "CHAPTER 1", "CHAPTER ONE", "Chapter 12." (optionally followed by ". Title" or
 *    a title on the same line)
 *  - bare Roman numerals: "I.", "XIV", "XVIII."
 *  - bare arabic numbers used as headings: "1.", "12"
 *  - "BOOK I", "PART II", "SECTION 3", "LETTER IV"
 *  - "PROLOGUE" / "EPILOGUE" / "INTRODUCTION" used as standalone headings
 */
function detectHeadings(text: string): HeadingHit[] {
  const hits: HeadingHit[] = [];
  const lineRe = /^[ \t]*(.+?)[ \t]*$/gm;

  // A line counts as a heading if, trimmed, it matches one of these and is reasonably short.
  const headingLine =
    /^(?:(?:chapter|book|part|section|letter|canto|act|scene)\b[ \t]*(?:[ivxlcdm]+|\d+|[a-z]+)?\.?(?:[ \t]*[-—:.][ \t]*.+)?|[ivxlcdm]{1,7}\.?|\d{1,3}\.?|(?:prologue|epilogue|introduction|preface|foreword)\b.*)$/i;

  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(text)) !== null) {
    const line = m[1].trim();
    if (!line) continue;
    // Headings are short; skip long paragraph lines that happen to start with "I ..." etc.
    if (line.length > 80) continue;
    if (!headingLine.test(line)) continue;

    // Guard against false positives like a lone "I" pronoun starting a sentence: require either a
    // keyword (chapter/book/…), a trailing period after a numeral, or an uppercase-dominant line.
    const hasKeyword =
      /^(?:chapter|book|part|section|letter|canto|act|scene|prologue|epilogue|introduction|preface|foreword)\b/i.test(
        line,
      );
    const isNumeralHeading = /^(?:[ivxlcdm]{1,7}|\d{1,3})\.?$/i.test(line);
    if (!hasKeyword && !isNumeralHeading) continue;

    hits.push({ index: m.index, rawTitle: line });
  }

  return hits;
}

/**
 * Segment a book body into chapters/sections.
 *
 * - Detects CHAPTER / Roman-numeral / numbered / BOOK·PART·SECTION headings as section boundaries.
 * - When a `toc` is supplied (ordered { sectionNumber, title }), the detected boundaries are aligned
 *   to it: the i-th detected section is given the toc entry's sectionNumber + title (preferring a
 *   fuzzy title match, else positional order). Detected headings beyond the toc length keep their
 *   own raw title and a continuing sectionNumber.
 * - If NO boundaries are found, returns a single section { sectionNumber: 1, title: "Full text", text }.
 *
 * Never throws. Section `text` is the slice from its heading (inclusive of the heading line) up to
 * the next heading.
 */
export function segmentIntoChapters(
  text: string,
  toc?: { sectionNumber: number; title: string }[],
): { sectionNumber: number; title: string; text: string }[] {
  const fallback = (body: string) => [
    { sectionNumber: 1, title: "Full text", text: (body ?? "").trim() },
  ];

  if (!text || typeof text !== "string") return fallback("");

  const headings = detectHeadings(text);
  if (headings.length === 0) {
    return fallback(text);
  }

  // Build raw sections from boundary positions. (Text before the first heading — front matter — is
  // dropped from the chapter sections; it's typically the title page / preface noise.)
  const rawSections: { rawTitle: string; text: string }[] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : text.length;
    const slice = text.slice(start, end).trim();
    if (!slice) continue;
    rawSections.push({ rawTitle: headings[i].rawTitle, text: slice });
  }

  if (rawSections.length === 0) return fallback(text);

  const cleanToc = (toc ?? []).filter(
    (t) => t && typeof t.title === "string" && Number.isFinite(t.sectionNumber),
  );

  // No usable toc → number sequentially using the detected raw titles.
  if (cleanToc.length === 0) {
    return rawSections.map((s, i) => ({
      sectionNumber: i + 1,
      title: s.rawTitle,
      text: s.text,
    }));
  }

  // Align to the toc. Greedy, order-preserving: walk detected sections; for each, try to match the
  // next-unconsumed toc entry by normalized-title containment, else fall back to positional pairing.
  const out: { sectionNumber: number; title: string; text: string }[] = [];
  let tocCursor = 0;
  for (let i = 0; i < rawSections.length; i++) {
    const raw = rawSections[i];
    const normRaw = normalizeTitle(raw.rawTitle);

    let matched: { sectionNumber: number; title: string } | null = null;

    // Prefer a fuzzy match against the upcoming toc entries (small look-ahead window).
    for (let j = tocCursor; j < Math.min(cleanToc.length, tocCursor + 4); j++) {
      const normToc = normalizeTitle(cleanToc[j].title);
      if (
        normToc.length > 0 &&
        (normRaw.includes(normToc) || normToc.includes(normRaw))
      ) {
        matched = cleanToc[j];
        tocCursor = j + 1;
        break;
      }
    }

    // Else positional pairing with the cursor's toc entry, if any remain.
    if (!matched && tocCursor < cleanToc.length) {
      matched = cleanToc[tocCursor];
      tocCursor += 1;
    }

    if (matched) {
      out.push({
        sectionNumber: matched.sectionNumber,
        title: matched.title,
        text: raw.text,
      });
    } else {
      // More detected sections than toc entries → continue numbering after the last toc number.
      const lastNumber = out.length > 0 ? out[out.length - 1].sectionNumber : 0;
      out.push({
        sectionNumber: lastNumber + 1,
        title: raw.rawTitle,
        text: raw.text,
      });
    }
  }

  return out;
}
