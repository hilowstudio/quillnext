/**
 * registry.ts — the full-text SOURCE REGISTRY for Phase 3 grounded generation.
 *
 * Locating a public-domain full text is a TWO-PHASE operation, exposed as two entry points so the
 * caller can run each as its own bounded unit of work:
 *   - discoverFullText(meta)         — a light catalog lookup → { source, sourceId, textUrl }.
 *   - fetchFullText(source, textUrl) — the heavy download + de-boilerplating → text.
 * The Inngest worker runs them as SEPARATE steps so the multi-MB download never shares a timeout
 * budget with the lookup; `findFullText` composes both in one call as a convenience for
 * scripts/smoke tests.
 *
 * Sources are tried best-first by TEXT QUALITY (the registry returns the first that has the work):
 *   1. Standard Ebooks  — meticulously hand-produced, proofread (highest quality).
 *   2. Project Gutenberg — clean transcriptions of ~70k classics.
 *   3. Internet Archive  — OCR'd scans; noisier but the broadest coverage (long-tail fallback).
 * Further adapters (Wikisource, open-textbook sources…) slot in by appending to the `SOURCES` list.
 *
 * Every entry point NEVER throws: a source that errors is skipped and we fall through to the next,
 * returning null only when no source yields text.
 */

import { findOnGutenberg, fetchGutenbergText } from "./gutenberg";
import { findOnStandardEbooks, fetchStandardEbooksText } from "./standard-ebooks";
import { findOnInternetArchive, fetchInternetArchiveText } from "./internet-archive";

/** The normalized result of locating a full public-domain text. */
export interface BookTextResult {
  /** Provenance source key, e.g. "gutenberg". Stored on book_extractions.full_text_source. */
  source: string;
  /** The source's native id (stringified), e.g. the Gutenberg book id. */
  sourceId: string;
  /** The de-boilerplated full text of the work. */
  text: string;
}

/** Metadata the caller knows about the target work. */
interface BookMeta {
  title: string;
  authors?: string[] | null;
}

/** A located-but-not-yet-fetched full text: which source has it + the URL of its body. */
export interface BookTextLocation {
  /** Provenance source key, e.g. "gutenberg". */
  source: string;
  /** The source's native id (stringified), e.g. the Gutenberg book id. */
  sourceId: string;
  /** URL of the de-boilerplated-able plain-text body, fetched in a separate (heavier) step. */
  textUrl: string;
}

/**
 * A registered full-text adapter, split into a light DISCOVER phase (catalog lookup → a body URL)
 * and a heavy FETCH phase (download + strip the body). Keeping them separate lets the caller run
 * each as its own bounded unit of work — the multi-MB download never shares an invocation/timeout
 * budget with the catalog lookup.
 */
interface TextSource {
  key: string;
  discover: (meta: BookMeta) => Promise<{ sourceId: string; textUrl: string } | null>;
  fetch: (textUrl: string) => Promise<string | null>;
}

/** Standard Ebooks: highest-quality curated texts (single-page HTML → cheerio). Tried first. */
const standardEbooksSource: TextSource = {
  key: "standard-ebooks",
  discover: (meta) => findOnStandardEbooks(meta),
  fetch: (textUrl) => fetchStandardEbooksText(textUrl),
};

/** The Project Gutenberg adapter: discover via Gutendex, then fetch + strip the plain text. */
const gutenbergSource: TextSource = {
  key: "gutenberg",
  async discover(meta) {
    const hit = await findOnGutenberg(meta);
    if (!hit) return null;
    return { sourceId: String(hit.gutenbergId), textUrl: hit.textUrl };
  },
  fetch(textUrl) {
    return fetchGutenbergText(textUrl);
  },
};

/** Internet Archive: OCR'd scans, broadest coverage. Tried LAST (noisiest text — long-tail fallback). */
const internetArchiveSource: TextSource = {
  key: "internet-archive",
  discover: (meta) => findOnInternetArchive(meta),
  fetch: (textUrl) => fetchInternetArchiveText(textUrl),
};

/**
 * Registered sources in best-first priority order (highest text quality first; see the file header).
 * discoverFullText tries them in order and returns the FIRST that has the work, so a title available
 * on Standard Ebooks uses that over Gutenberg/IA, and IA only catches what the curated sources lack.
 */
const SOURCES: TextSource[] = [standardEbooksSource, gutenbergSource, internetArchiveSource];

/**
 * DISCOVER the full public-domain text for a work by trying each registered source best-first.
 * Returns WHERE the text is ({ source, sourceId, textUrl }) — a light catalog lookup, no large
 * download — or null when no source has the work. A source that throws is skipped. NEVER throws.
 */
export async function discoverFullText(meta: {
  title: string;
  authors?: string[] | null;
}): Promise<BookTextLocation | null> {
  if (!meta || typeof meta.title !== "string" || !meta.title.trim()) return null;

  for (const source of SOURCES) {
    try {
      const hit = await source.discover(meta);
      if (hit && hit.textUrl) {
        return { source: source.key, sourceId: hit.sourceId, textUrl: hit.textUrl };
      }
    } catch (error) {
      console.error(`[sources/registry] source "${source.key}" discover failed`, error);
      // Skip this source and fall through to the next.
    }
  }

  return null;
}

/**
 * FETCH the body for a previously-discovered location (the heavy step: a potentially multi-MB
 * download + de-boilerplating). Returns the de-boilerplated text, or null on miss/failure. NEVER
 * throws. Kept separate from discoverFullText so the download is its own bounded unit of work.
 */
export async function fetchFullText(source: string, textUrl: string): Promise<string | null> {
  const src = SOURCES.find((s) => s.key === source);
  if (!src) return null;
  try {
    const text = await src.fetch(textUrl);
    return text && text.length > 0 ? text : null;
  } catch (error) {
    console.error(`[sources/registry] source "${source}" fetch failed`, error);
    return null;
  }
}

/**
 * Convenience: discover + fetch in one call, returning the first source's { source, sourceId, text }
 * or null. NEVER throws. The Inngest worker deliberately does NOT use this — it runs discover and
 * fetch as separate steps so each fits the per-invocation ceiling (see extract-book.ts) — but it's
 * handy for scripts/smoke tests that just want the text.
 */
export async function findFullText(meta: {
  title: string;
  authors?: string[] | null;
}): Promise<BookTextResult | null> {
  const hit = await discoverFullText(meta);
  if (!hit) return null;
  const text = await fetchFullText(hit.source, hit.textUrl);
  if (!text) return null;
  return { source: hit.source, sourceId: hit.sourceId, text };
}
