/**
 * internet-archive.ts — the Internet Archive adapter for the full-text RAG source layer.
 *
 * The Internet Archive (https://archive.org) holds millions of scanned texts — by far the broadest
 * coverage of our sources, but its full text is OCR'd (noisier than Gutenberg / Standard Ebooks),
 * so the registry tries it LAST, as a long-tail fallback for works the curated sources lack.
 *
 *   findOnInternetArchive   — search advancedsearch.php for a DOWNLOADABLE, public-domain text
 *                             (mediatype:texts, NOT access-restricted, exposes OCR "DjVuTXT") that
 *                             matches the metadata; return its identifier + _djvu.txt URL, or null.
 *   fetchInternetArchiveText — fetch that _djvu.txt (following the storage-node redirect), reject an
 *                             access-restricted HTML page, normalize page-break artifacts.
 *
 * Both NEVER throw — a miss/blip degrades to null. Matching is conservative (a wrong text is worse
 * than none); the access-restriction filter + the fetch-time HTML guard keep borrow-only/in-copyright
 * scans out (their OCR text is not openly downloadable).
 */

import { normalize, authorLastName, scoreTitleAuthor, BROWSER_UA } from "./matching";

const ADVANCED_SEARCH = "https://archive.org/advancedsearch.php";

/** Shape of the subset of the advancedsearch.php response we rely on. */
interface IADoc {
  identifier?: unknown;
  title?: unknown;
  creator?: unknown;
  format?: unknown; // array of available formats; we require "DjVuTXT"
  downloads?: unknown; // popularity — used to pick the canonical scan
}

/**
 * Strip Lucene/IA query special characters from user-supplied text so it can be safely interpolated
 * into a `field:(...)` clause. We drop (rather than backslash-escape) the risky characters and
 * collapse whitespace — title/author words survive, operators don't leak.
 */
function sanitizeQueryTerm(s: string): string {
  return s
    .replace(/[+\-&|!(){}\[\]^"~*?:\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Search the Internet Archive for a downloadable public-domain text matching the metadata.
 *
 * Query: mediatype:texts, NOT access-restricted (excludes borrow-only/in-copyright scans), filtered
 * to a title (+ author) match and sorted by download count. We then keep only genuine title/author
 * matches that expose OCR text ("DjVuTXT") and rank them by popularity + match score. Returns the
 * best identifier + its `_djvu.txt` URL, or null when nothing matches well enough. NEVER throws.
 */
export async function findOnInternetArchive(meta: {
  title: string;
  authors?: string[] | null;
}): Promise<{ sourceId: string; textUrl: string } | null> {
  try {
    const title = typeof meta?.title === "string" ? meta.title.trim() : "";
    if (!title) return null;

    const firstAuthor =
      Array.isArray(meta.authors) && meta.authors.length > 0 && typeof meta.authors[0] === "string"
        ? meta.authors[0].trim()
        : "";

    const wantTitle = normalize(title);
    const wantAuthorLast = firstAuthor ? authorLastName(firstAuthor) : null;

    const clauses = [`title:(${sanitizeQueryTerm(title)})`];
    if (firstAuthor) clauses.push(`creator:(${sanitizeQueryTerm(firstAuthor)})`);
    clauses.push("mediatype:texts");
    clauses.push("NOT access-restricted-item:true");

    const params = new URLSearchParams();
    params.set("q", clauses.join(" AND "));
    for (const f of ["identifier", "title", "creator", "format", "downloads"]) {
      params.append("fl[]", f);
    }
    params.append("sort[]", "downloads desc");
    params.set("rows", "12");
    params.set("output", "json");

    const res = await fetch(`${ADVANCED_SEARCH}?${params.toString()}`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { response?: { docs?: unknown } };
    const docs = Array.isArray(data?.response?.docs) ? (data.response!.docs as IADoc[]) : [];
    if (docs.length === 0) return null;

    let best: { id: string; rank: number } | null = null;
    for (const doc of docs) {
      const id = typeof doc.identifier === "string" ? doc.identifier : null;
      if (!id) continue;

      // Must expose OCR plain text, or there is nothing for us to ingest.
      const formats = Array.isArray(doc.format) ? doc.format.map((f) => String(f)) : [];
      if (!formats.includes("DjVuTXT")) continue;

      const titleStr =
        typeof doc.title === "string"
          ? doc.title
          : Array.isArray(doc.title) && typeof doc.title[0] === "string"
            ? doc.title[0]
            : "";
      const authors = Array.isArray(doc.creator)
        ? doc.creator.map((c) => String(c))
        : typeof doc.creator === "string"
          ? [doc.creator]
          : [];

      const score = scoreTitleAuthor(titleStr, authors, wantTitle, wantAuthorLast);
      if (score === null) continue;

      const downloads = Number(doc.downloads) || 0;
      const rank = downloads + score;
      if (!best || rank > best.rank) best = { id, rank };
    }

    if (!best) return null;
    return {
      sourceId: best.id,
      textUrl: `https://archive.org/download/${best.id}/${best.id}_djvu.txt`,
    };
  } catch (error) {
    console.error("[internet-archive] findOnInternetArchive failed", error);
    return null;
  }
}

/**
 * Fetch an Internet Archive `_djvu.txt` URL and return the OCR plain text.
 *
 * `fetch` follows the 302 to a storage node automatically. We reject a response that is actually an
 * HTML page (access-restricted items return one instead of text) and normalize the form-feed page
 * breaks djvu.txt inserts between scanned pages. Returns null on a non-ok response, an HTML/empty/
 * too-short body, or any error. NEVER throws.
 */
export async function fetchInternetArchiveText(textUrl: string): Promise<string | null> {
  try {
    if (!textUrl || typeof textUrl !== "string") return null;

    const res = await fetch(textUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/plain,*/*" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    const body = await res.text();
    if (!body) return null;

    // Access-restricted/in-copyright items hand back an HTML error page rather than the OCR text.
    if (/text\/html/i.test(contentType) || /^\s*<(?:!doctype|html)/i.test(body)) return null;

    // djvu.txt separates scanned pages with form-feeds; normalize them to blank lines.
    const cleaned = body
      .replace(/\f/g, "\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Guard against a near-empty OCR result (a cover-only scan, etc.).
    return cleaned.length > 200 ? cleaned : null;
  } catch (error) {
    console.error("[internet-archive] fetchInternetArchiveText failed", error);
    return null;
  }
}
