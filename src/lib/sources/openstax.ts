/**
 * openstax.ts — the OpenStax adapter + shared content core for OPEN TEXTBOOKS.
 *
 * OpenStax (https://openstax.org) publishes ~130 peer-reviewed, openly-licensed (CC BY) textbooks
 * with a consistent, CDN-backed JSON API — so unlike Wikisource this is regular and reliable. A book
 * is a TREE of sections served by the "archive" content API:
 *   - catalog:  /apps/cms/api/v2/pages/?type=books.Book   → title + cnx_id (+ K-12 subject tags)
 *   - release:  /rex/release.json                          → archive base + each book's pinned version
 *   - TOC:      {archive}/contents/{cnx}@{ver}.json        → a walkable chapter/section tree
 *   - section:  {archive}/contents/{cnx}@{ver}:{page}.json → { content: html } for one section
 *
 * This module is the SHARED core for both textbook paths:
 *   - BY-TITLE  (findOnOpenStax/fetchOpenStaxText): a parent adds a specific OpenStax book to their
 *     Living Library → it flows through the normal book-extract registry like the literature sources,
 *     but is tagged a TEXTBOOK source so generation grounds-don't-echoes (see registry kind).
 *   - BY-SUBJECT (listOpenStaxBooks/assembleOpenStaxSections): bulk-ingest every book keyed to its
 *     K-12 subject/category for the subject-driven textbook corpus.
 *
 * Everything NEVER throws — a miss/blip degrades to null/[] so the registry falls through.
 */

import { load } from "cheerio";

const CMS = "https://openstax.org/apps/cms/api/v2/pages";
const RELEASE = "https://openstax.org/rex/release.json";
const OS_UA = "QuillNext/1.0 (https://www.quillandcompass.app; textbook ingestion)";

// Section assembly bounds (OpenStax is CDN-backed and not throttled, so concurrency can be higher
// than Wikisource's). Books can be large (Biology 2e ≈ 495 sections); the deadline + cap keep a
// single fetch step well under the Vercel ceiling, and the chunk cap downstream bounds embedding.
const FETCH_CONCURRENCY = 8;
const MAX_SECTIONS = 600;
const ASSEMBLE_DEADLINE_MS = 40_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resilient JSON GET with light retry. NEVER throws — returns null on failure. */
async function getJson(url: string): Promise<unknown | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": OS_UA, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return await res.json();
    } catch {
      // transient — retry
    }
    if (attempt < 3) await sleep(250 * attempt);
  }
  return null;
}

/** A catalog entry: the book's archive id, title, slug, and K-12 subject tagging (when present). */
export interface OpenStaxBook {
  cnxId: string;
  title: string;
  slug: string | null;
  /** K-12 subject name, e.g. "Biology" (from k12book_subjects), else the higher-ed subject. */
  subject: string | null;
  /** Broad subject category, e.g. "Science" / "Math" / "Social Sciences". */
  category: string | null;
}

function slugFromRexLink(rex: unknown): string | null {
  if (typeof rex !== "string") return null;
  const m = rex.match(/\/books\/([a-z0-9-]+)\//i);
  return m ? m[1] : null;
}

function readSubjects(book: Record<string, unknown>): { subject: string | null; category: string | null } {
  // Prefer the K-12 tagging (subject_name + subject_category); fall back to the higher-ed subject.
  const k12 = Array.isArray(book.k12book_subjects) ? (book.k12book_subjects as Array<Record<string, unknown>>) : [];
  if (k12.length > 0) {
    const s = k12[0];
    return {
      subject: typeof s.subject_name === "string" ? s.subject_name : null,
      category: typeof s.subject_category === "string" ? s.subject_category : null,
    };
  }
  const he = Array.isArray(book.book_subjects) ? (book.book_subjects as Array<Record<string, unknown>>) : [];
  if (he.length > 0 && typeof he[0].subject_name === "string") {
    return { subject: he[0].subject_name as string, category: he[0].subject_name as string };
  }
  return { subject: null, category: null };
}

/**
 * List the full OpenStax catalog (paginated), with each book's archive id, title, slug, and subject
 * tags. NEVER throws — returns whatever pages it could fetch (or [] on total failure).
 */
export async function listOpenStaxBooks(): Promise<OpenStaxBook[]> {
  const out: OpenStaxBook[] = [];
  const fields = "title,cnx_id,k12book_subjects,book_subjects,webview_rex_link";
  for (let offset = 0; offset < 400; offset += 20) {
    const data = (await getJson(
      `${CMS}/?type=books.Book&fields=${fields}&limit=20&offset=${offset}`,
    )) as { items?: Array<Record<string, unknown>>; meta?: { total_count?: number } } | null;
    const items = Array.isArray(data?.items) ? data!.items! : [];
    if (items.length === 0) break;
    for (const b of items) {
      const cnxId = typeof b.cnx_id === "string" ? b.cnx_id : "";
      const title = typeof b.title === "string" ? b.title : "";
      if (!cnxId || !title) continue;
      const { subject, category } = readSubjects(b);
      out.push({ cnxId, title, slug: slugFromRexLink(b.webview_rex_link), subject, category });
    }
    const total = data?.meta?.total_count ?? 0;
    if (out.length >= total || items.length < 20) break;
  }
  return out;
}

/** Normalize for fuzzy title comparison (lowercase, strip punctuation/whitespace). */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Resolve a parent-supplied book reference to a specific OpenStax catalog book. Matches the title
 * conservatively (exact normalized match, else the wanted title is a word-boundary prefix of the
 * catalog title or vice-versa — so "OpenStax Biology"/"Biology" both reach "Biology 2e"). Returns the
 * best match or null. NEVER throws.
 */
export async function resolveOpenStaxBook(meta: {
  title: string;
  authors?: string[] | null;
}): Promise<OpenStaxBook | null> {
  try {
    const want = norm((meta?.title ?? "").replace(/\bopenstax\b/gi, "")); // a parent may prefix "OpenStax"
    if (!want || want.length < 3) return null;

    const books = await listOpenStaxBooks();
    if (books.length === 0) return null;

    let best: OpenStaxBook | null = null;
    let bestScore = -Infinity;
    for (const book of books) {
      // Compare ignoring a trailing edition marker like "2e".
      const cand = norm(book.title.replace(/\b\d+e\b/gi, ""));
      const isExact = cand === want;
      const prefixMatch = cand.startsWith(`${want} `) || want.startsWith(`${cand} `);
      if (!isExact && !prefixMatch) continue;

      let score = isExact ? 3 : 1;
      score -= Math.abs(cand.length - want.length) / 100;
      if (score > bestScore) {
        bestScore = score;
        best = book;
      }
    }
    return best;
  } catch (error) {
    console.error("[openstax] resolveOpenStaxBook failed", error);
    return null;
  }
}

/** Resolve the archive base URL + a book's pinned content version from the rex release config. */
async function resolveArchive(cnxId: string): Promise<{ base: string; bookId: string } | null> {
  const rel = (await getJson(RELEASE)) as
    | { archiveUrl?: unknown; books?: Record<string, { defaultVersion?: unknown }> }
    | null;
  const archiveUrl = typeof rel?.archiveUrl === "string" ? rel.archiveUrl : null;
  const version = rel?.books?.[cnxId]?.defaultVersion;
  if (!archiveUrl || typeof version !== "string") return null;
  return { base: `https://openstax.org${archiveUrl}`, bookId: `${cnxId}@${version}` };
}

/** A content section: its display title and cleaned prose text. */
export interface OpenStaxSection {
  title: string;
  text: string;
}

/** Titles that are front/back matter or pure scaffolding, not content to ground on. */
const SKIP_SECTION =
  /^(preface|index|references|answer key|the periodic table|measurements?(\s|$)|chapter outline|about openstax|the development of|review questions?|critical thinking questions?|test prep|key equations?)/i;

/** Walk the archive TOC tree to the ordered list of content leaf pages (front/back matter removed). */
function tocLeaves(tree: unknown): Array<{ id: string; title: string }> {
  const leaves: Array<{ id: string; title: string }> = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { id?: unknown; title?: unknown; contents?: unknown };
    if (Array.isArray(n.contents)) {
      n.contents.forEach(walk);
      return;
    }
    if (typeof n.id !== "string") return;
    const title = typeof n.title === "string" ? n.title.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
    if (!title || SKIP_SECTION.test(title)) return;
    leaves.push({ id: n.id, title });
  };
  walk(tree);
  return leaves;
}

/** Strip the OpenStax section HTML to prose (drop the dev style block, scripts, figures, math markup). */
function cleanSectionHtml(html: string): string {
  const $ = load(html);
  $("style,script,figure,img,figcaption,.os-figure,.os-table,table,math,.os-math,[data-type='glossary']").remove();
  return $.root()
    .text()
    .replace(/\/\*[\s\S]*?\*\//g, " ") // any leftover CSS comment
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Simple global concurrency gate so total in-flight fetches never exceed `max`. */
function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((res) => queue.push(res));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

/**
 * Fetch the ordered content SECTIONS of an OpenStax book (title + cleaned text each). Bounded by a
 * wall-clock deadline, a section cap, and a global concurrency limiter. FAIL-SAFE: returns [] if the
 * TOC can't be loaded or the deadline trips before a usable amount is fetched. NEVER throws.
 *
 * Used BY-SUBJECT (per-section corpus rows) and BY-TITLE (concatenated full text, see fetchOpenStaxText).
 */
export async function assembleOpenStaxSections(cnxId: string): Promise<OpenStaxSection[]> {
  try {
    if (!cnxId) return [];
    const archive = await resolveArchive(cnxId);
    if (!archive) return [];

    const toc = (await getJson(`${archive.base}/contents/${archive.bookId}.json`)) as
      | { tree?: unknown }
      | null;
    if (!toc?.tree) return [];

    const leaves = tocLeaves(toc.tree).slice(0, MAX_SECTIONS);
    if (leaves.length === 0) return [];

    const deadline = Date.now() + ASSEMBLE_DEADLINE_MS;
    const gate = createLimiter(FETCH_CONCURRENCY);

    const results = await Promise.all(
      leaves.map((leaf) =>
        gate(async (): Promise<OpenStaxSection | null> => {
          if (Date.now() > deadline) return null;
          const pageId = leaf.id.split("@")[0];
          const page = (await getJson(
            `${archive.base}/contents/${archive.bookId}:${pageId}.json`,
          )) as { content?: unknown } | null;
          if (typeof page?.content !== "string") return null;
          const text = cleanSectionHtml(page.content);
          return text.length >= 200 ? { title: leaf.title, text } : null;
        }),
      ),
    );

    return results.filter((s): s is OpenStaxSection => s !== null);
  } catch (error) {
    console.error("[openstax] assembleOpenStaxSections failed", error);
    return [];
  }
}

// ============================================================================
// BY-TITLE registry adapter (findOnOpenStax / fetchOpenStaxText).
// ============================================================================

/**
 * Discover an OpenStax textbook matching the metadata. Returns the cnx id as sourceId and a textUrl
 * that carries the cnx id (so fetch can re-resolve the current version). NEVER throws.
 */
export async function findOnOpenStax(meta: {
  title: string;
  authors?: string[] | null;
}): Promise<{ sourceId: string; textUrl: string } | null> {
  try {
    const book = await resolveOpenStaxBook(meta);
    if (!book) return null;
    const slug = book.slug ?? "book";
    return {
      sourceId: book.cnxId,
      textUrl: `https://openstax.org/books/${slug}#cnx=${book.cnxId}`,
    };
  } catch (error) {
    console.error("[openstax] findOnOpenStax failed", error);
    return null;
  }
}

/**
 * Fetch + assemble the full text of an OpenStax book from a textUrl carrying its cnx id. Concatenates
 * the cleaned content sections (each prefixed with its title for chapter segmentation). Returns null
 * on a missing cnx id, an empty assembly, or any error. NEVER throws.
 */
export async function fetchOpenStaxText(textUrl: string): Promise<string | null> {
  try {
    if (!textUrl || typeof textUrl !== "string") return null;
    const m = textUrl.match(/#cnx=([0-9a-f-]+)/i);
    if (!m) return null;
    const sections = await assembleOpenStaxSections(m[1]);
    if (sections.length === 0) return null;
    const text = sections.map((s) => `${s.title}\n\n${s.text}`).join("\n\n").trim();
    return text.length > 200 ? text : null;
  } catch (error) {
    console.error("[openstax] fetchOpenStaxText failed", error);
    return null;
  }
}
