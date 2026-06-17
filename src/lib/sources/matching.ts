/**
 * matching.ts — shared fuzzy title/author matching for the full-text SOURCE adapters
 * (registry.ts / gutenberg.ts / standard-ebooks.ts / internet-archive.ts).
 *
 * A WRONG full text is worse than none (it would ground generation in the wrong book), so matching
 * is deliberately conservative: a candidate must clear a title-containment bar and, when an author
 * was supplied, expose that author's surname. All functions are PURE and never throw.
 */

/** Lowercase, strip punctuation, collapse whitespace — for fuzzy comparison. */
export function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract a comparable "last name" token from an author string. Catalogs return "Last, First"
 * (e.g. "Austen, Jane"); metadata authors are usually "Jane Austen". We compare the surname (before
 * the first comma, else the last whitespace token) which is the most stable across orderings.
 */
export function authorLastName(name: string): string {
  const n = (name ?? "").trim();
  if (!n) return "";
  if (n.includes(",")) return normalize(n.split(",")[0]);
  const parts = normalize(n).split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

/**
 * Score a candidate work against the requested title/author. Returns a number (higher = better) or
 * null when it is NOT a genuine match.
 *
 * - Title: require normalized-title CONTAINMENT in either direction (catalog titles often carry a
 *   subtitle, e.g. "Pride and Prejudice; or, First Impressions"), with a 3-char minimum so a 1-2
 *   char overlap can't pass.
 * - Author (only when the caller supplied one): the requested surname must appear among the
 *   candidate's authors, else reject — this is what blocks a wrong-author same-title work.
 *
 * Score: exact normalized-title equality (2) + author match (1) − a small length-distance penalty
 * so the bare title outranks a sprawling collection title.
 */
export function scoreTitleAuthor(
  candidateTitle: string,
  candidateAuthors: string[],
  wantTitleNorm: string,
  wantAuthorLast: string | null,
): number | null {
  const t = normalize(candidateTitle);
  if (!t || !wantTitleNorm) return null;

  const titleOk =
    (t.includes(wantTitleNorm) || wantTitleNorm.includes(t)) &&
    Math.min(t.length, wantTitleNorm.length) >= 3;
  if (!titleOk) return null;

  let authorScore = 0;
  if (wantAuthorLast) {
    const lastNames = (candidateAuthors ?? []).map((a) => authorLastName(a)).filter(Boolean);
    const authorOk = lastNames.some(
      (ln) => ln === wantAuthorLast || ln.includes(wantAuthorLast) || wantAuthorLast.includes(ln),
    );
    if (!authorOk) return null; // author requested but none matched → reject
    authorScore = 1;
  }

  const exact = t === wantTitleNorm ? 2 : 0;
  const lengthPenalty = -Math.abs(t.length - wantTitleNorm.length) / 100;
  return exact + authorScore + lengthPenalty;
}

/** A real desktop UA: some catalogs/mirrors 403 a default fetch/node UA. Shared by the adapters. */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
