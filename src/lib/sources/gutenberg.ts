/**
 * gutenberg.ts — the Project Gutenberg adapter for the full-text RAG source layer
 * (Phase 3 of grounded generation).
 *
 * Project Gutenberg hosts ~70k public-domain works. We discover them via Gutendex
 * (https://gutendex.com), a JSON API over the Gutenberg catalog, then fetch the plain-text body.
 *
 *   findOnGutenberg    — fuzzy-search Gutendex by title + first author and return the best-matching
 *                        work's id + a plain-text format URL, or null when nothing matches well.
 *   fetchGutenbergText — download a plain-text URL and return the de-boilerplated body, or null.
 *
 * Both functions NEVER throw — a missing match, a network blip, or malformed JSON degrades to null
 * so the ingestion worker keeps running (a WRONG full text is worse than none, so matching is
 * deliberately conservative).
 */

import { stripGutenbergBoilerplate } from "./text-processing";

/** Shape of the subset of the Gutendex response we rely on. */
interface GutendexAuthor {
  name?: unknown; // typically "Last, First"
}
interface GutendexBook {
  id?: unknown;
  title?: unknown;
  authors?: unknown;
  formats?: unknown; // map of mime-type -> url
  download_count?: unknown; // Gutenberg popularity — used to pick the canonical edition
}
interface GutendexResponse {
  results?: unknown;
}

const GUTENDEX_URL = "https://gutendex.com/books";

// A real desktop UA: gutenberg.org / mirrors sometimes 403 a default fetch/node UA.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Normalize a string for fuzzy comparison: lowercase, strip punctuation, collapse whitespace. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract a comparable "last name" token set from an author string. Gutendex returns "Last, First"
 * (e.g. "Melville, Herman"), while metadata authors are usually "Herman Melville". We compare the
 * surname (the part before the first comma, or the last whitespace token) which is the most stable
 * across orderings.
 */
function authorLastName(name: string): string {
  const n = name.trim();
  if (!n) return "";
  if (n.includes(",")) {
    return normalize(n.split(",")[0]);
  }
  const parts = normalize(n).split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

/** Pull the best plain-text URL out of a Gutendex `formats` map. */
function pickPlainTextUrl(formats: unknown): string | null {
  if (!formats || typeof formats !== "object") return null;
  const map = formats as Record<string, unknown>;

  // Prefer the canonical UTF-8 plain text (the actual book body).
  const utf8 = map["text/plain; charset=utf-8"];
  if (typeof utf8 === "string" && utf8 && !/readme/i.test(utf8)) return utf8;

  // Else any "text/plain..." variant (charset=us-ascii / iso-8859-1 / bare), but NOT a
  // "*-readme.txt" (audio/special editions expose only a readme) and not a .zip bundle.
  for (const [mime, url] of Object.entries(map)) {
    if (typeof url !== "string" || !url) continue;
    if (!mime.toLowerCase().startsWith("text/plain")) continue;
    if (url.toLowerCase().endsWith(".zip")) continue;
    if (/readme/i.test(url)) continue;
    return url;
  }
  return null;
}

/** True if this result exposes a real UTF-8 plain-text body (the strongest "real text edition" signal). */
function hasUtf8Text(formats: unknown): boolean {
  if (!formats || typeof formats !== "object") return false;
  const utf8 = (formats as Record<string, unknown>)["text/plain; charset=utf-8"];
  return typeof utf8 === "string" && !!utf8 && !/readme/i.test(utf8);
}

/**
 * Decide whether a Gutendex result is a genuine match for the requested book.
 *
 * Title: require normalized-title CONTAINMENT in either direction (the catalog title often carries
 * a subtitle, e.g. "Moby Dick; Or, The Whale"), with a minimum length so a 1-2 char overlap can't
 * pass. Author (when we have one): require the surname to appear among the result's authors.
 *
 * Returns a numeric score (higher = better) or null when it's not a real match.
 */
function scoreMatch(
  book: GutendexBook,
  wantTitle: string,
  wantAuthorLast: string | null,
): number | null {
  const titleRaw = typeof book.title === "string" ? book.title : "";
  const normResultTitle = normalize(titleRaw);
  if (!normResultTitle) return null;

  const titleContained =
    (normResultTitle.includes(wantTitle) || wantTitle.includes(normResultTitle)) &&
    Math.min(normResultTitle.length, wantTitle.length) >= 3;
  if (!titleContained) return null;

  // Author check (only when the caller supplied an author).
  let authorScore = 0;
  if (wantAuthorLast) {
    const authors = Array.isArray(book.authors) ? (book.authors as GutendexAuthor[]) : [];
    const lastNames = authors
      .map((a) => (a && typeof a.name === "string" ? authorLastName(a.name) : ""))
      .filter(Boolean);
    const authorMatches = lastNames.some(
      (ln) => ln === wantAuthorLast || ln.includes(wantAuthorLast) || wantAuthorLast.includes(ln),
    );
    if (!authorMatches) {
      // Author was requested but none matched → reject to avoid a wrong-author same-title work.
      return null;
    }
    authorScore = 1;
  }

  // Score: exact normalized-title equality beats a subtitle-containment; author match adds a point.
  const exactTitle = normResultTitle === wantTitle ? 2 : 0;
  // Shorter catalog titles (closer to the bare title) rank above sprawling collection titles.
  const lengthPenalty = -Math.abs(normResultTitle.length - wantTitle.length) / 100;

  return exactTitle + authorScore + lengthPenalty;
}

/**
 * Search Gutendex for a public-domain work matching the given metadata.
 *
 * Queries `GET https://gutendex.com/books?search=<title + first author>`, then fuzzy-matches the
 * results against the requested title/author. Returns the best genuine match's id, catalog title,
 * and a plain-text URL — or null when nothing matches well enough (a wrong full text is worse than
 * none). NEVER throws.
 */
export async function findOnGutenberg(meta: {
  title: string;
  authors?: string[] | null;
}): Promise<{ gutenbergId: number; title: string; textUrl: string } | null> {
  try {
    const title = typeof meta?.title === "string" ? meta.title.trim() : "";
    if (!title) return null;

    const firstAuthor =
      Array.isArray(meta.authors) && meta.authors.length > 0 && typeof meta.authors[0] === "string"
        ? meta.authors[0].trim()
        : "";

    const wantTitle = normalize(title);
    const wantAuthorLast = firstAuthor ? authorLastName(firstAuthor) : null;

    const searchTerm = [title, firstAuthor].filter(Boolean).join(" ");
    const url = `${GUTENDEX_URL}?search=${encodeURIComponent(searchTerm)}`;

    const res = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as GutendexResponse;
    const results = Array.isArray(data?.results) ? (data.results as GutendexBook[]) : [];
    if (results.length === 0) return null;

    // Score every result; keep only genuine matches that also expose a plain-text URL. The
    // composite RANK makes a real UTF-8 full text dominate (skips audio/readme editions like
    // Tom Sawyer #26203), then popularity (download_count picks the canonical edition, e.g. #74),
    // then the title/author closeness score.
    let best: { gutenbergId: number; title: string; textUrl: string; rank: number } | null = null;
    for (const book of results) {
      const score = scoreMatch(book, wantTitle, wantAuthorLast);
      if (score === null) continue;

      const id = typeof book.id === "number" ? book.id : Number(book.id);
      if (!Number.isFinite(id)) continue;

      const textUrl = pickPlainTextUrl(book.formats);
      if (!textUrl) continue;

      const downloadCount =
        typeof book.download_count === "number"
          ? book.download_count
          : Number(book.download_count) || 0;
      const rank = (hasUtf8Text(book.formats) ? 1_000_000 : 0) + downloadCount + score;

      if (!best || rank > best.rank) {
        best = {
          gutenbergId: id,
          title: typeof book.title === "string" ? book.title : title,
          textUrl,
          rank,
        };
      }
    }

    if (!best) return null;
    return { gutenbergId: best.gutenbergId, title: best.title, textUrl: best.textUrl };
  } catch (error) {
    console.error("[gutenberg] findOnGutenberg failed", error);
    return null;
  }
}

/**
 * Fetch a Gutenberg plain-text URL and return the de-boilerplated body.
 *
 * Uses a browser User-Agent (mirrors/gutenberg.org may 403 a default node UA). Returns null on a
 * non-ok response or any error. The body is passed through stripGutenbergBoilerplate so callers get
 * the work's own text without the START/END wrapper + license tail. NEVER throws.
 */
export async function fetchGutenbergText(textUrl: string): Promise<string | null> {
  try {
    if (!textUrl || typeof textUrl !== "string") return null;

    const res = await fetch(textUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/plain,*/*" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;

    const body = await res.text();
    if (!body) return null;

    const stripped = stripGutenbergBoilerplate(body);
    return stripped || null;
  } catch (error) {
    console.error("[gutenberg] fetchGutenbergText failed", error);
    return null;
  }
}
