/**
 * corpus-registry.ts — the BY-SUBJECT open-textbook CORPUS source registry.
 *
 * Sibling of registry.ts (the by-title full-text registry). Where that one resolves ONE named work
 * to concatenated full text, this one enumerates a WHOLE catalog and returns per-section rows for
 * bulk subject-keyed RAG ingestion. A corpus source is the minimal surface the ingestion worker
 * actually consumes — exactly two methods — so adding a new textbook source is "write one adapter,
 * push it onto CORPUS_SOURCES", the same lightweight pattern as the by-title TextSource registry.
 *
 * Both methods are FAIL-SAFE (return [] on any error, never throw) — the worker treats an empty
 * result as "nothing to ingest" and marks the doc UNAVAILABLE, so a flaky source degrades cleanly.
 */

import { listOpenStaxBooks, assembleOpenStaxSections } from "./openstax";
import { listSiyavulaBooks, assembleSiyavulaSections } from "./siyavula";
import { listLibreTextsBooks, assembleLibreTextsSections } from "./libretexts";

/** One book in a source's catalog (what `listBooks` yields). */
export interface CorpusBook {
  /** The source's own stable book id, stored opaquely in TextbookDocument.externalId (column cnx_id).
   *  openstax → cnxId; siyavula → reader slug; libretexts → "{library}-{pageid}". */
  externalId: string;
  title: string;
  /** Fine subject, e.g. "Biology" — drives the subject-filtered cosine in retrieveTextbookChunks. */
  subject: string | null;
  /** Broad category, e.g. "Science" — drives the spine cross-walk (category → spine Subject). */
  category: string | null;
}

/** One assembled section of a book (what `assembleSections` yields), ready to chunk + embed. */
export interface CorpusSection {
  title: string | null;
  /** Cleaned prose. The source drops boilerplate/short sections (as assembleOpenStaxSections does). */
  text: string;
}

/**
 * A registered corpus source. `key` === TextbookDocument.source, so the per-book worker can dispatch
 * `assembleSections` by the stored source. Mirror the openstax adapter when adding a new source.
 */
export interface CorpusSource {
  key: string;
  /** Enumerate the source's catalog (ideally memoized w/ TTL, like listOpenStaxBooks). Fail-safe. */
  listBooks: () => Promise<CorpusBook[]>;
  /** Assemble one book's sections (deadline + section-cap bounded). Fail-safe → []. */
  assembleSections: (externalId: string) => Promise<CorpusSection[]>;
}

/** OpenStax — open (CC BY) textbooks via a regular JSON content API. A thin wrapper over the existing
 *  functions (openstax.ts unchanged); its catalog rows already carry subject/category. */
const openstaxCorpus: CorpusSource = {
  key: "openstax",
  listBooks: async () =>
    (await listOpenStaxBooks()).map((b) => ({
      externalId: b.cnxId,
      title: b.title,
      subject: b.subject,
      category: b.category,
    })),
  assembleSections: (externalId) => assembleOpenStaxSections(externalId),
};

/** Siyavula — CC BY(-ND) South-African CAPS maths & science textbooks (grades 7–12). Small, finite
 *  catalog; subject + grade are encoded in the reader-root slug, so spine mapping is direct. */
const siyavulaCorpus: CorpusSource = {
  key: "siyavula",
  listBooks: () => listSiyavulaBooks(),
  assembleSections: (externalId) => assembleSiyavulaSections(externalId),
};

/** LibreTexts — the largest open corpus (~2,686 open-licensed books across 14 disciplines) via the
 *  MindTouch deki API. Catalog enumerated from commons; sections assembled per book (token-gated). */
const libretextsCorpus: CorpusSource = {
  key: "libretexts",
  listBooks: () => listLibreTextsBooks(),
  assembleSections: (externalId) => assembleLibreTextsSections(externalId),
};

/**
 * Registered corpus sources. `ingestTextbookCorpus` enumerates ALL of them (each book upserted with
 * its source key); `ingestTextbook` dispatches the per-book section assembly by the stored source.
 */
export const CORPUS_SOURCES: CorpusSource[] = [openstaxCorpus, siyavulaCorpus, libretextsCorpus];

/** Look up a registered corpus source by key (=== TextbookDocument.source). */
export function getCorpusSource(key: string): CorpusSource | undefined {
  return CORPUS_SOURCES.find((s) => s.key === key);
}
