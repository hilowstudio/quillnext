/**
 * libretexts.ts — the LibreTexts adapter for OPEN TEXTBOOKS (the largest open-textbook corpus).
 *
 * LibreTexts (https://libretexts.org) is a MindTouch/Nice-CXone wiki of ~3,590 books across 14
 * discipline libraries (chem, bio, phys, math, …). It exposes a machine-readable catalog and a
 * per-book section tree + per-section content via the MindTouch "deki" API:
 *   - catalog:  commons.libretexts.org/api/v1/commons/catalog → every book (bookID "{lib}-{pageid}",
 *               library, subject, license, …). ANONYMOUS, no token.
 *   - tree:     {lib}.libretexts.org/@api/deki/pages/{pageid}/tree?dream.out.format=json → the book's
 *               nested page tree (each node: @id, path).
 *   - section:  {lib}.libretexts.org/@api/deki/pages/{id}/contents?dream.out.format=json
 *               → { @title, body: [htmlString, toc] } for one page.
 *
 * TOKEN: the deki API can 403 ("missing required token") from a non-browser client. The anonymous
 * X-Deki-Token is embedded in each library's home page HTML (`apiToken":"xhr_…`) and is PER-SUBDOMAIN.
 * We scrape + cache it per library and send it on every deki call (defensive — some libraries serve
 * the API anonymously, but the token is cheap insurance).
 *
 * LICENSE: mixed PER BOOK. We ingest the recognized OPEN licenses only (NonCommercial INCLUDED per
 * the grounding policy — we never redistribute verbatim), excluding all-rights-reserved / "mixed" /
 * blank-unknown. CONTENT is clean semantic HTML with inline \(…\) LaTeX, so .text() yields good prose.
 *
 * Corpus path only (listLibreTextsBooks/assembleLibreTextsSections). A by-title adapter is omitted on
 * purpose: it would load the 5.5 MB catalog on the hot literature-discovery path for little gain.
 *
 * Everything NEVER throws — a miss/blip degrades to null/[] so the worker falls through.
 */

import { load } from "cheerio";
import { BROWSER_UA } from "./matching";

const COMMONS_CATALOG = "https://commons.libretexts.org/api/v1/commons/catalog?limit=10000";

// Recognized OPEN licenses we will ground on (NC permitted). Anything else (arr, "mixed", caltech,
// blank/unknown) is excluded — ~2,686 of 3,590 books qualify.
const ALLOWED_LICENSES = new Set([
  "ccby", "ccbysa", "ccbync", "ccbyncsa", "ccbynd", "ccbyncnd", "publicdomain", "gnufdl", "gnu", "ck12",
]);

// library → broad category, chosen to ILIKE-match a spine Subject where possible ("Science" →
// "Science & Nature", "Mathematics" → "Mathematics") so the (b) cross-walk can resolve coverage. The
// (a) grounding additionally uses the finer per-book subject + cosine, so a non-spine category is fine.
const LIBRARY_CATEGORY: Record<string, string> = {
  chem: "Science", bio: "Science", phys: "Science", geo: "Science", med: "Science",
  math: "Mathematics", stats: "Mathematics",
  socialsci: "Social Studies", human: "Humanities", biz: "Business",
  eng: "Engineering", workforce: "Career & Technical", k12: "K12", espanol: "Spanish",
};

// Per-book section assembly bounds. Respect LibreTexts' politeness (it publishes a 5s crawl-delay):
// keep concurrency low and lean on the deadline + cap. A partial book is fine — grounding degrades
// gracefully and the downstream chunk cap bounds embedding cost.
const FETCH_CONCURRENCY = 4;
const MAX_SECTIONS = 400;
const ASSEMBLE_DEADLINE_MS = 45_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resilient JSON GET with light retry + optional deki token. NEVER throws — null on failure. */
async function getJson(url: string, token?: string | null): Promise<unknown | null> {
  const headers: Record<string, string> = { "User-Agent": BROWSER_UA, Accept: "application/json" };
  if (token) headers["X-Deki-Token"] = token;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      if (res.ok) return await res.json();
    } catch {
      // transient — retry
    }
    if (attempt < 3) await sleep(300 * attempt);
  }
  return null;
}

// ---- catalog (memoized per warm process) ----

let _catalogCache: { at: number; books: LibreTextsBook[] } | null = null;
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

interface LibreTextsBook {
  externalId: string; // the bookID "{lib}-{pageid}"
  title: string;
  subject: string | null;
  category: string | null;
}

/**
 * List the ingestable LibreTexts catalog (open-licensed books only), each as { externalId, title,
 * subject, category }. One anonymous catalog call (≈5.5 MB) → filtered + mapped. Memoized per process
 * (TTL); a failed fetch is NOT cached. NEVER throws.
 */
export async function listLibreTextsBooks(): Promise<LibreTextsBook[]> {
  if (_catalogCache && Date.now() - _catalogCache.at < CATALOG_TTL_MS) return _catalogCache.books;

  const data = (await getJson(COMMONS_CATALOG)) as { books?: unknown } | null;
  const raw = Array.isArray(data?.books) ? (data!.books as Array<Record<string, unknown>>) : [];
  if (raw.length === 0) return [];

  const books: LibreTextsBook[] = [];
  for (const b of raw) {
    const license = typeof b.license === "string" ? b.license.toLowerCase() : "";
    if (!ALLOWED_LICENSES.has(license)) continue;
    const bookID = typeof b.bookID === "string" ? b.bookID : "";
    const m = bookID.match(/^([a-z]+)-(\d+)$/);
    if (!m) continue;
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!title) continue;
    const lib = m[1];
    const category = LIBRARY_CATEGORY[lib] ?? null;
    const fine = typeof b.subject === "string" ? b.subject.trim() : "";
    books.push({ externalId: bookID, title, subject: fine || category, category });
  }

  _catalogCache = { at: Date.now(), books };
  return books;
}

// ---- per-library deki token (scraped + cached) ----

const _tokenCache = new Map<string, { token: string; at: number }>();
const TOKEN_TTL_MS = 30 * 60 * 1000;

/** Scrape (and cache) a library's anonymous X-Deki-Token from its home page. NEVER throws → null. */
async function libraryToken(lib: string): Promise<string | null> {
  const cached = _tokenCache.get(lib);
  if (cached && Date.now() - cached.at < TOKEN_TTL_MS) return cached.token;
  try {
    const res = await fetch(`https://${lib}.libretexts.org/`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/apiToken":"(xhr_[^"]+)/);
    if (!m) return null;
    _tokenCache.set(lib, { token: m[1], at: Date.now() });
    return m[1];
  } catch {
    return null;
  }
}

// ---- tree → content leaves ----

/** MindTouch's XML→JSON renders a repeated element as an array, a single one as an object. */
const asArray = (x: unknown): unknown[] => (Array.isArray(x) ? x : x ? [x] : []);

/** Walk the deki page tree to its content LEAVES (pages with no subpages), with id + path. */
function collectLeaves(root: unknown): Array<{ id: string; path: string }> {
  const leaves: Array<{ id: string; path: string }> = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { "@id"?: unknown; path?: { "#text"?: unknown }; subpages?: { page?: unknown } };
    const kids = asArray(n.subpages?.page);
    const id = typeof n["@id"] === "string" ? n["@id"] : "";
    const path = typeof n.path?.["#text"] === "string" ? (n.path["#text"] as string) : "";
    if (kids.length === 0) {
      if (id) leaves.push({ id, path });
      return;
    }
    kids.forEach(walk);
  };
  walk(root);
  return leaves;
}

/** Front/back matter and admin pages — not content to ground on. */
const SKIP_PATH = /_(Front|Back)_Matter\/|\/(InfoPage|TitlePage|Table_of_Contents|Licensing)\b/i;

/** Pull the HTML body string out of a deki contents response (body is [html, toc] | string | {#text}). */
function extractBodyHtml(body: unknown): string {
  if (Array.isArray(body)) {
    const first = body.find((x) => typeof x === "string");
    return typeof first === "string" ? first : "";
  }
  if (typeof body === "string") return body;
  if (body && typeof body === "object" && typeof (body as { "#text"?: unknown })["#text"] === "string") {
    return (body as { "#text": string })["#text"];
  }
  return "";
}

/** Strip a LibreTexts section's HTML to prose. Preserves inline \(…\) LaTeX; drops scripts, the
 *  auto-generated subpage listings, figures/images, and any rendered MathJax glyph spans. */
function cleanLibreTextsHtml(html: string): string {
  const $ = load(html);
  $(".MathJax, .MathJax_Preview, .MathJax_Display, mjx-container, nobr").remove();
  $(
    "script, style, noscript, figure, img, .mt-sortable-listings, .mt-listings, .comment, [data-mt-template]",
  ).remove();
  return $.root()
    .text()
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A title for a section, from the deki @title or, failing that, the page path's last segment. */
function sectionTitle(json: Record<string, unknown>, path: string): string | null {
  const t = json["@title"] ?? json["title"];
  if (typeof t === "string" && t.trim()) return t.trim();
  const seg = path.split("/").pop() ?? "";
  const cleaned = seg.replace(/_/g, " ").trim();
  return cleaned || null;
}

/** One assembled section. */
export interface LibreTextsSection {
  title: string | null;
  text: string;
}

/**
 * Assemble a LibreTexts book's content sections (title + cleaned prose each). Resolves bookID →
 * {library, pageid}, scrapes the library token, fetches the page tree, walks it to the content leaves
 * (front/back matter skipped), then fetches each leaf's contents — bounded by a wall-clock deadline, a
 * section cap, and a low concurrency gate. FAIL-SAFE: returns [] on a bad id, an unreachable tree, or
 * no usable prose. NEVER throws.
 */
export async function assembleLibreTextsSections(bookID: string): Promise<LibreTextsSection[]> {
  try {
    const m = (bookID ?? "").match(/^([a-z]+)-(\d+)$/);
    if (!m) return [];
    const [, lib, pageid] = m;
    const base = `https://${lib}.libretexts.org`;
    const token = await libraryToken(lib);

    const tree = (await getJson(`${base}/@api/deki/pages/${pageid}/tree?dream.out.format=json`, token)) as
      | { page?: unknown }
      | null;
    if (!tree?.page) return [];

    const leaves = collectLeaves(tree.page)
      .filter((l) => !SKIP_PATH.test(l.path))
      .slice(0, MAX_SECTIONS);
    if (leaves.length === 0) return [];

    const deadline = Date.now() + ASSEMBLE_DEADLINE_MS;

    // Inline concurrency gate (keeps in-flight fetches ≤ max).
    let active = 0;
    const queue: Array<() => void> = [];
    const gate = async <T>(fn: () => Promise<T>): Promise<T> => {
      if (active >= FETCH_CONCURRENCY) await new Promise<void>((res) => queue.push(res));
      active++;
      try {
        return await fn();
      } finally {
        active--;
        queue.shift()?.();
      }
    };

    const results = await Promise.all(
      leaves.map((leaf) =>
        gate(async (): Promise<LibreTextsSection | null> => {
          if (Date.now() > deadline) return null;
          const page = (await getJson(
            `${base}/@api/deki/pages/${leaf.id}/contents?dream.out.format=json`,
            token,
          )) as Record<string, unknown> | null;
          if (!page) return null;
          const text = cleanLibreTextsHtml(extractBodyHtml(page.body));
          return text.length >= 200 ? { title: sectionTitle(page, leaf.path), text } : null;
        }),
      ),
    );

    return results.filter((s): s is LibreTextsSection => s !== null);
  } catch (error) {
    console.error("[libretexts] assembleLibreTextsSections failed", error);
    return [];
  }
}
