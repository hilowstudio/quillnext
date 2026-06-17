/**
 * registry.ts — the full-text SOURCE REGISTRY for Phase 3 grounded generation.
 *
 * A single entry point, `findFullText`, tries each registered public-domain text source best-first
 * and returns the first usable body. Today only Project Gutenberg is wired up; the registry is
 * deliberately structured so additional adapters (Standard Ebooks, Wikisource, Internet Archive…)
 * can be slotted in later by appending to the `SOURCES` list — each adapter just needs to expose a
 * `find(meta) -> body | null` shape.
 *
 * Like the adapters it orchestrates, `findFullText` NEVER throws: any source that errors is skipped
 * and we fall through to the next, returning null only when no source yields text.
 */

import { findOnGutenberg, fetchGutenbergText } from "./gutenberg";

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

/** A registered full-text adapter: given metadata, resolve a BookTextResult or null. */
interface TextSource {
  key: string;
  find: (meta: BookMeta) => Promise<BookTextResult | null>;
}

/**
 * The Project Gutenberg adapter: discover the work via Gutendex, then fetch + strip its plain text.
 */
const gutenbergSource: TextSource = {
  key: "gutenberg",
  async find(meta) {
    const hit = await findOnGutenberg(meta);
    if (!hit) return null;

    const text = await fetchGutenbergText(hit.textUrl);
    if (!text) return null;

    return { source: "gutenberg", sourceId: String(hit.gutenbergId), text };
  },
};

/**
 * Registered sources in best-first priority order. New adapters (Standard Ebooks, Wikisource,
 * Internet Archive) append here once implemented; `findFullText` will try them in order.
 */
const SOURCES: TextSource[] = [gutenbergSource];

/**
 * Locate the full public-domain text for a work by trying each registered source best-first.
 *
 * Returns the first source's { source, sourceId, text }, or null when no source has the work. A
 * source that throws is caught and skipped so one flaky provider never fails the whole lookup.
 * NEVER throws.
 */
export async function findFullText(meta: {
  title: string;
  authors?: string[] | null;
}): Promise<BookTextResult | null> {
  if (!meta || typeof meta.title !== "string" || !meta.title.trim()) return null;

  for (const source of SOURCES) {
    try {
      const result = await source.find(meta);
      if (result && result.text) return result;
    } catch (error) {
      console.error(`[sources/registry] source "${source.key}" failed`, error);
      // Skip this source and fall through to the next.
    }
  }

  return null;
}
