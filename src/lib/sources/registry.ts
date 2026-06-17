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
 * Sources are tried best-first (the registry returns the first that has the work):
 *   0. OpenStax         — open (CC BY) TEXTBOOKS via a regular content API; authoritative for
 *                         textbooks, a fast null for literature (grounds-don't-echoes at generation).
 *   1. Siyavula         — open (CC BY[-ND]) SA CAPS maths & science TEXTBOOKS; matches only its fixed
 *                         catalog titles, else a fast null (grounds-don't-echoes at generation).
 *   2. Standard Ebooks  — meticulously hand-produced, proofread literature (highest quality).
 *   3. Project Gutenberg — clean transcriptions of ~70k classics.
 *   4. Wikisource        — community-transcribed (often validated); assembled from its page tree.
 *   5. Internet Archive  — OCR'd scans; noisier but the broadest coverage (long-tail fallback).
 *
 * Every entry point NEVER throws: a source that errors is skipped and we fall through to the next,
 * returning null only when no source yields text.
 */

import { findOnGutenberg, fetchGutenbergText } from "./gutenberg";
import { findOnStandardEbooks, fetchStandardEbooksText } from "./standard-ebooks";
import { findOnWikisource, fetchWikisourceText } from "./wikisource";
import { findOnInternetArchive, fetchInternetArchiveText } from "./internet-archive";
import { findOnOpenStax, fetchOpenStaxText } from "./openstax";
import { findOnSiyavula, fetchSiyavulaText } from "./siyavula";

/**
 * Source keys that are OPEN TEXTBOOKS rather than literature. The generation layer grounds-don't-
 * echoes these (uses the excerpts for factual accuracy but teaches in its own words) instead of
 * allowing verbatim quotes the way it does for public-domain literature.
 */
export const TEXTBOOK_SOURCES = new Set<string>(["openstax", "siyavula"]);

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

/** OpenStax: open (CC BY) textbooks via a regular JSON content API. Authoritative for textbooks; a
 *  fast null for literature. A TEXTBOOK source → generation grounds-don't-echoes (see TEXTBOOK_SOURCES). */
const openstaxSource: TextSource = {
  key: "openstax",
  discover: (meta) => findOnOpenStax(meta),
  fetch: (textUrl) => fetchOpenStaxText(textUrl),
};

/** Siyavula: open CC BY(-ND) SA CAPS maths & science textbooks. A TEXTBOOK source (grounds-don't-
 *  echoes). discover only matches its fixed catalog titles, so it's a fast null for everything else. */
const siyavulaSource: TextSource = {
  key: "siyavula",
  discover: (meta) => findOnSiyavula(meta),
  fetch: (textUrl) => fetchSiyavulaText(textUrl),
};

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

/** Wikisource: community-transcribed; the work is ASSEMBLED from its page tree. Mid-priority. */
const wikisourceSource: TextSource = {
  key: "wikisource",
  discover: (meta) => findOnWikisource(meta),
  fetch: (textUrl) => fetchWikisourceText(textUrl),
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
 * on Standard Ebooks uses that over the others, and the OCR'd Internet Archive only catches what the
 * curated/transcribed sources lack.
 */
const SOURCES: TextSource[] = [
  openstaxSource,
  siyavulaSource,
  standardEbooksSource,
  gutenbergSource,
  wikisourceSource,
  internetArchiveSource,
];

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
 * DISCOVER the work across ALL registered sources, returning EVERY source that has it, in best-first
 * priority order. Unlike discoverFullText (which stops at the first hit), this collects the full
 * ranked list so the caller can FETCH-fall-through: if the best source's heavy fetch fails (e.g. a
 * throttled Wikisource assembly), the next source's text is tried instead. Discovery is the light
 * step, so probing every source here is cheap. NEVER throws.
 */
export async function discoverAllFullText(meta: {
  title: string;
  authors?: string[] | null;
}): Promise<BookTextLocation[]> {
  if (!meta || typeof meta.title !== "string" || !meta.title.trim()) return [];

  const hits: BookTextLocation[] = [];
  for (const source of SOURCES) {
    try {
      const hit = await source.discover(meta);
      if (hit && hit.textUrl) {
        hits.push({ source: source.key, sourceId: hit.sourceId, textUrl: hit.textUrl });
      }
    } catch (error) {
      console.error(`[sources/registry] source "${source.key}" discover failed`, error);
    }
  }
  return hits;
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
 * Try to FETCH each discovered location in priority order and return the FIRST that yields usable
 * text, along with which source it came from. This is the fetch-fallback: a source whose fetch
 * throttles/fails (notably Wikisource's multi-page assembly) is skipped in favour of the next
 * source's text (e.g. the Internet Archive's OCR), so one flaky source never blocks ingestion.
 *
 * Bounded by a wall-clock budget so the calling Inngest step stays under the Vercel ceiling: we do
 * NOT start a new source's fetch once the budget is spent (each source's fetch already has its own
 * internal timeout). NEVER throws; returns null when no source delivered text within budget.
 */
export async function fetchFirstAvailable(
  candidates: BookTextLocation[],
  opts?: { budgetMs?: number; now?: () => number },
): Promise<{ source: string; sourceId: string; text: string } | null> {
  const budgetMs = opts?.budgetMs ?? 45_000;
  const now = opts?.now ?? Date.now;
  const start = now();
  for (const c of candidates) {
    if (now() - start >= budgetMs) break; // out of budget → don't start another fetch
    const text = await fetchFullText(c.source, c.textUrl);
    if (text && text.length > 0) return { source: c.source, sourceId: c.sourceId, text };
  }
  return null;
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
