/**
 * standard-ebooks.ts — the Standard Ebooks adapter for the full-text RAG source layer.
 *
 * Standard Ebooks (https://standardebooks.org) publishes meticulously hand-produced, proofread
 * public-domain ebooks — the HIGHEST text quality of our sources, so the registry tries it FIRST.
 *
 *   findOnStandardEbooks   — search the public catalog and resolve the best-matching work's
 *                            /ebooks/<author>/<title> path + its single-page reader URL, or null.
 *   fetchStandardEbooksText — fetch that single-page HTML and extract clean prose via cheerio.
 *
 * Both NEVER throw — a miss, network blip, or markup change degrades to null so the worker keeps
 * running (and the registry falls through to the next source). Matching is conservative: a wrong
 * full text is worse than none.
 *
 * Why scrape the search page instead of the OPDS feed: Standard Ebooks' OPDS catalog now requires
 * authentication (401), but the public /ebooks?query= search page exposes the canonical
 * /ebooks/<author>/<title> URLs, and every book offers a /text/single-page view (the whole work as
 * one clean semantic-HTML document) — no EPUB/zip parsing needed.
 */

import { load } from "cheerio";
import { normalize, authorLastName, BROWSER_UA } from "./matching";

const BASE = "https://standardebooks.org";

/**
 * Search Standard Ebooks for a work matching the given metadata.
 *
 * GETs the search results page, collects the canonical /ebooks/<author>/<title> links (exactly two
 * path segments — excludes author/collection pages), and picks the first relevance-ranked candidate
 * whose title slug shares a title word AND (when an author was supplied) whose author slug carries
 * the requested surname. Returns { sourceId: "<author>/<title>", textUrl } or null. NEVER throws.
 */
export async function findOnStandardEbooks(meta: {
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

    const query = encodeURIComponent([title, firstAuthor].filter(Boolean).join(" "));
    const res = await fetch(`${BASE}/ebooks?query=${query}`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = load(html);

    // Canonical book URLs are exactly /ebooks/<author>/<title>; dedupe, preserving page order
    // (the search results are relevance-ranked, so earlier = better).
    const seen = new Set<string>();
    const candidates: { author: string; slug: string; path: string }[] = [];
    $('a[href^="/ebooks/"]').each((_, el) => {
      const href = ($(el).attr("href") || "").split(/[?#]/)[0];
      const m = href.match(/^\/ebooks\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);
      if (!m) return;
      const key = `${m[1]}/${m[2]}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ author: m[1], slug: m[2], path: `/ebooks/${m[1]}/${m[2]}` });
    });
    if (candidates.length === 0) return null;

    const wantTitleTokens = normalize(title)
      .split(" ")
      .filter((w) => w.length >= 3);
    const wantAuthorLast = firstAuthor ? authorLastName(firstAuthor) : null;

    const best =
      candidates.find((c) => {
        const slugWords = c.slug.replace(/-/g, " ");
        const titleOk =
          wantTitleTokens.length === 0 || wantTitleTokens.some((t) => slugWords.includes(t));
        const authorOk = !wantAuthorLast || c.author.replace(/-/g, " ").includes(wantAuthorLast);
        return titleOk && authorOk;
      }) ?? null;
    if (!best) return null;

    return {
      sourceId: `${best.author}/${best.slug}`,
      textUrl: `${BASE}${best.path}/text/single-page`,
    };
  } catch (error) {
    console.error("[standard-ebooks] findOnStandardEbooks failed", error);
    return null;
  }
}

/**
 * Fetch a Standard Ebooks single-page reader URL and return its de-marked-up full text.
 *
 * The single-page view is one semantic-HTML document; cheerio strips script/style/nav/footer and we
 * take the main/body text. We then trim the trailing Standard Ebooks back-matter (the "Colophon" and
 * "Uncopyright" dedication), which sits after the last chapter. Leading front-matter (title page /
 * imprint) is left for the worker's chapter segmentation to drop before the first chapter. Returns
 * null on a non-ok response, empty body, or any error. NEVER throws.
 */
export async function fetchStandardEbooksText(textUrl: string): Promise<string | null> {
  try {
    if (!textUrl || typeof textUrl !== "string") return null;

    const res = await fetch(textUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    if (!html) return null;

    const $ = load(html);
    $("script,style,head,nav,footer").remove();
    const root = $("main").length ? $("main") : $("body");
    let text = root
      .text()
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Trim trailing Standard Ebooks back-matter (only when it appears late in the document, so a
    // chapter that legitimately mentions the words isn't truncated).
    const back = text.search(/\n\s*(?:Colophon|Uncopyright)\s*\n/);
    if (back > text.length * 0.5) text = text.slice(0, back).trim();

    return text.length > 0 ? text : null;
  } catch (error) {
    console.error("[standard-ebooks] fetchStandardEbooksText failed", error);
    return null;
  }
}
