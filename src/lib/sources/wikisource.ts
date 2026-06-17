/**
 * wikisource.ts — the Wikisource adapter for the full-text RAG source layer.
 *
 * Wikisource (https://en.wikisource.org) hosts community-transcribed, frequently proofread/validated
 * public-domain texts. Unlike the single-file sources, a work is a TREE: a root page (sometimes a
 * "Versions" disambiguation page) → an edition page that is really a table of contents → chapter
 * SUBPAGES (and occasionally volume → chapter, two levels deep). So:
 *   findOnWikisource    — resolve the readable EDITION page (skip "Versions"/disambiguation pages,
 *                         prefer validated/ready-for-export, conservative title match + author check).
 *   fetchWikisourceText — ASSEMBLE the work: walk the edition's subpage links in reading order via
 *                         the MediaWiki action=parse API, clean each page, and concatenate.
 *
 * Quality sits between Gutenberg and the Internet Archive, but Wikisource is by far the most
 * STRUCTURALLY IRREGULAR source (every work's editors lay it out differently). Rather than try to
 * parse every layout perfectly, the adapter is deliberately FAIL-SAFE: it returns the full clean text
 * ONLY when it is confident it assembled the complete, correct work, and returns null on ANY doubt —
 * a missing page, an ambiguous structure, an unverifiable author, a slow/throttled run. The registry's
 * fetch-fallback then drops to the next source (e.g. the Internet Archive's OCR), so Wikisource's
 * irregularity/flakiness costs availability, never correctness (a WRONG full text is worse than none).
 *
 * Both entry points NEVER throw. We use the rock-solid MediaWiki API (NOT the ws-export service, which
 * 504s under load); the assembly is bounded by a wall-clock deadline + page cap + global concurrency.
 */

import { load } from "cheerio";
import { normalize, authorLastName } from "./matching";

const API = "https://en.wikisource.org/w/api.php";
const WIKI = "https://en.wikisource.org/wiki/";

// Wikimedia API policy wants a descriptive User-Agent with contact info.
const WS_UA = "QuillNext/1.0 (https://www.quillandcompass.app; full-text ingestion)";

// Assembly bounds. The deadline keeps the fetch comfortably under the registry's fetch-fallback
// budget so a slow Wikisource run still leaves time to fall through to the next source.
const MAX_PAGES = 300;
const MAX_DEPTH = 2; // root TOC → (volume TOC) → chapter leaf
const FETCH_CONCURRENCY = 3; // modest — the Wikimedia API throttles bursty clients
const ASSEMBLE_DEADLINE_MS = 30_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Resilient JSON GET against the MediaWiki API. The Wikimedia API intermittently throttles/times out
 * a bursty client, so we retry a few times with backoff. Returns the parsed JSON or null. NEVER throws.
 */
async function wsGetJson(url: string): Promise<unknown | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": WS_UA, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return await res.json();
    } catch {
      // transient — fall through to retry
    }
    if (attempt < 3) await sleep(300 * attempt);
  }
  return null;
}

/** Fetch the rendered HTML of a Wikisource page (action=parse). Returns null on failure. */
async function parsePageHtml(title: string): Promise<string | null> {
  const url =
    `${API}?action=parse&page=${encodeURIComponent(title)}` +
    `&prop=text&format=json&formatversion=2&redirects=1`;
  const json = (await wsGetJson(url)) as { parse?: { text?: unknown } } | null;
  const html = json?.parse?.text;
  return typeof html === "string" ? html : null;
}

/** A subpage title that is clearly front/back matter or a stub, not a content chapter. */
function isStubPage(title: string): boolean {
  return /\/(?:footnotes?|endnotes?|notes|illustrations?|images?|cover|title\s*page|frontispiece|half[-\s]?title|advertisements?|errata|colophon|index|contents)$/i.test(
    title,
  );
}

/**
 * ALL descendant subpage titles linked from a page's content (any depth under it), in document
 * (reading) order, deduped, with obvious stub/front-matter subpages removed. We keep grandchildren:
 * many Wikisource TOCs link straight to "<Work>/Volume 1/Chapter 1" rather than to intermediate
 * volume pages, so direct-children-only would find nothing and return just the TOC.
 */
function extractDescendants(html: string, parentTitle: string): string[] {
  const $ = load(html);
  const prefix = `${parentTitle}/`;
  const out: string[] = [];
  const seen = new Set<string>();
  $(".mw-parser-output a[href^='/wiki/']").each((_, el) => {
    const raw = $(el).attr("href");
    if (!raw) return;
    let path: string;
    try {
      path = decodeURIComponent(raw.split("#")[0].split("?")[0]);
    } catch {
      return;
    }
    if (!path.startsWith("/wiki/")) return;
    const title = path.slice("/wiki/".length).replace(/_/g, " ");
    if (!title.startsWith(prefix) || title.length <= prefix.length) return; // self or non-descendant
    if (isStubPage(title)) return; // footnotes / title page / index etc. are not content chapters
    if (seen.has(title)) return;
    seen.add(title);
    out.push(title);
  });
  return out;
}

/** True if `a` is a path-segment ancestor of `b` (e.g. "W/Volume 1" of "W/Volume 1/Chapter 2"). */
function isAncestorPath(a: string, b: string): boolean {
  const as = a.split("/");
  const bs = b.split("/");
  if (as.length >= bs.length) return false;
  return as.every((seg, i) => seg === bs[i]);
}

/**
 * Keep only the LEAF-MOST titles: drop any that is a path-ancestor of another in the list (it's a
 * sub-TOC whose chapters are already listed directly). So a root that lists both "Vol 1" and
 * "Vol 1/Chapter 1" collapses to the chapters; a root that lists only the chapters keeps them all;
 * a root that lists only volume pages keeps those (we then recurse into each). A root that MIXES a
 * front-matter subpage with grandchild chapters keeps both. Preserves order.
 */
function leafmost(titles: string[]): string[] {
  return titles.filter((a) => !titles.some((b) => b !== a && isAncestorPath(a, b)));
}

/** Lowercased alphanumeric form (folding "&"→"and") for matching a running-header line to the title. */
function headerKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ") // drop "(1817)" / "(Austen)" qualifiers
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Strip MediaWiki/Wikisource chrome from a parsed page and return its prose text. When `workTitle`
 * is given, also drop the per-chapter running-header line (the work title repeated atop each page).
 */
function cleanContent(html: string, workTitle?: string): string {
  const $ = load(html);
  const root = $(".mw-parser-output");
  root
    .find(
      // scripts/styles
      "style,script," +
        // footnotes + edit links
        "sup.reference,.reference,.mw-editsection,.mw-references-wrap,ol.references,.references," +
        // page running-header / navigation templates (note: ws-header ≠ wst-header — match both)
        ".ws-noexport,.noprint,.dynlayout-exempt,.headertemplate,.licenseContainer," +
        "[class*='ws-header'],[class*='wst-header']," +
        // images / figures (their alt text + captions otherwise bleed into the prose)
        "img,figure,figcaption,.thumb,.thumbcaption,.gallery,audio,video,.mediaContainer",
    )
    .remove();
  let text = root
    .text()
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (workTitle) {
    const wt = headerKey(workTitle);
    if (wt) {
      text = text
        .split("\n")
        .filter((line) => line.trim() === "" || headerKey(line) !== wt)
        .join("\n");
    }
  }
  return text.trim();
}

/** Heuristic: a short, link-dense page is a table of contents, not the work's prose. */
function looksLikeToc(html: string, prose: string): boolean {
  const $ = load(html);
  const links = $(".mw-parser-output a[href^='/wiki/']").length;
  return links > 15 && prose.length < 4000;
}

/** A simple global concurrency gate so total in-flight fetches never exceed `max` (not per-level). */
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
 * Assemble a work's full text from its page tree. FAIL-SAFE: any page-fetch failure (after retries),
 * any structural ambiguity, the page cap, or the wall-clock deadline ABORTS the whole assembly and
 * returns "" → the caller reports null and the registry falls through to the next source. We never
 * return a partially-assembled book as if it were complete.
 *
 * A page with content subpages is a table of contents (recurse into its children in reading order,
 * never using its own text); a page with no subpages — or one at MAX_DEPTH — is a leaf whose cleaned
 * text we keep. `workTitle` is threaded through to strip the per-chapter running header.
 */
async function assembleWork(rootTitle: string, workTitle: string): Promise<string> {
  const deadline = Date.now() + ASSEMBLE_DEADLINE_MS;
  const gate = createLimiter(FETCH_CONCURRENCY);
  let count = 0;
  let aborted = false;

  const fetchPage = (title: string) =>
    gate(async () => {
      if (aborted) return null;
      if (Date.now() > deadline) {
        aborted = true;
        return null;
      }
      return parsePageHtml(title);
    });

  async function walk(title: string, depth: number): Promise<string> {
    if (aborted) return "";
    if (count >= MAX_PAGES) {
      aborted = true; // a work bigger than the cap can't be assembled completely → bail
      return "";
    }
    count++;

    const html = await fetchPage(title);
    if (!html) {
      aborted = true; // ANY needed page we can't fetch ⇒ incomplete ⇒ fail safe (→ null → next source)
      return "";
    }

    const subs = depth < MAX_DEPTH ? leafmost(extractDescendants(html, title)) : [];
    if (subs.length === 0) {
      const prose = cleanContent(html, workTitle);
      // A depth-0 page with no content subpages that nonetheless looks like a TOC isn't structured
      // the way we assume (chapters linked as siblings/absolute titles) — don't ship the TOC as text.
      if (depth === 0 && looksLikeToc(html, prose)) {
        aborted = true;
        return "";
      }
      return prose;
    }

    const parts = await Promise.all(subs.map((s) => walk(s, depth + 1)));
    if (aborted) return "";
    return parts.filter((p) => p && p.length > 0).join("\n\n");
  }

  const text = await walk(rootTitle, 0);
  return aborted ? "" : text;
}

/** Verify the requested author appears on a candidate's page (its header carries an Author: link). */
async function authorMatchesOnPage(pageTitle: string, wantSurname: string): Promise<boolean> {
  const html = await parsePageHtml(pageTitle);
  if (!html) return false; // can't verify ⇒ fail closed
  const hay = normalize(html.replace(/<[^>]+>/g, " "));
  return hay.includes(wantSurname);
}

/**
 * Resolve a work to its readable Wikisource EDITION page.
 *
 * Searches the main namespace (author-biased), drops subpage results, fetches the candidates'
 * categories, picks the best conservative TITLE match that is NOT a "Versions"/disambiguation page
 * (preferring validated/ready-for-export editions), and — when an author was supplied — VERIFIES the
 * author appears on the chosen page. Fails CLOSED (returns null) when category or author data can't be
 * obtained, so a wrong-author same-title work or a disambiguation page is never accepted. NEVER throws.
 */
export async function findOnWikisource(meta: {
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
    const wantSurname = firstAuthor ? authorLastName(firstAuthor) : "";

    // 1) Search (author-biased), main namespace only.
    const srsearch = encodeURIComponent([title, firstAuthor].filter(Boolean).join(" "));
    const searchJson = (await wsGetJson(
      `${API}?action=query&list=search&srsearch=${srsearch}` +
        `&srnamespace=0&srlimit=8&format=json&formatversion=2`,
    )) as { query?: { search?: Array<{ title?: unknown }> } } | null;
    if (!searchJson) return null;
    const hits = Array.isArray(searchJson?.query?.search) ? searchJson.query!.search! : [];

    // Candidate work roots: real titles, not chapter SUBPAGES.
    const candidates = hits
      .map((h) => (typeof h?.title === "string" ? h.title : ""))
      .filter((t) => t && !t.includes("/"));
    if (candidates.length === 0) return null;

    // 2) Fetch candidate categories to exclude "Versions"/disambiguation pages and prefer real works.
    //    Fail CLOSED: if the category data can't be obtained we can't rule out a disambiguation page.
    const catJson = (await wsGetJson(
      `${API}?action=query&titles=${encodeURIComponent(candidates.join("|"))}` +
        `&prop=categories&cllimit=max&format=json&formatversion=2`,
    )) as {
      query?: { pages?: Array<{ title?: unknown; categories?: Array<{ title?: unknown }> }> };
    } | null;
    if (!catJson) return null;
    const catByTitle = new Map<string, string[]>();
    for (const p of catJson?.query?.pages ?? []) {
      if (typeof p?.title !== "string") continue;
      catByTitle.set(
        p.title,
        (p.categories ?? [])
          .map((c) => (typeof c?.title === "string" ? c.title : ""))
          .filter(Boolean),
      );
    }

    // 3) Pick the best conservative title match that isn't a disambiguation page.
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      // Compare without a trailing "(YEAR)" edition qualifier.
      const candNorm = normalize(candidate.replace(/\(\d{4}\)/g, ""));
      const isExact = candNorm === wantTitle;

      // WORD-BOUNDARY match in EITHER direction: the candidate is the title, or it is the title plus
      // a subtitle, or the supplied title is the candidate plus a subtitle. Requiring a trailing
      // space keeps matches on a word boundary (so "Emma" can't match "Emmanuel"); min length 3.
      const oneWayLonger = candNorm.startsWith(`${wantTitle} `);
      const otherWayLonger = wantTitle.startsWith(`${candNorm} `);
      if (!isExact && !(oneWayLonger || otherWayLonger)) continue;
      if (Math.min(candNorm.length, wantTitle.length) < 3) continue;

      // Reject derivative/commentary/abridged editions — their text is polluted with non-work content
      // or is not the full work. A classic alternate-title subtitle ("…; or, The Modern Prometheus")
      // is fine; commentary/criticism/annotation/abridgement is not.
      if (
        !isExact &&
        /\b(commentar|annotat|criticis|critical|companion|casebook|sourcebook|study guide|abridg|adapted)\b/i.test(
          candidate,
        )
      ) {
        continue;
      }

      const cats = catByTitle.get(candidate) ?? [];
      if (cats.some((c) => /Versions pages|Disambiguation/i.test(c))) continue; // not a readable work

      let score = 0;
      if (isExact) score += 3; // strongly prefer the clean, exact title over a subtitled edition
      if (cats.some((c) => /Ready for export|Validated texts|Proofread texts/i.test(c))) score += 2;
      if (cats.some((c) => /\b\d{4} works\b/i.test(c) || /\bPD-/i.test(c))) score += 1;
      score -= Math.abs(candNorm.length - wantTitle.length) / 100; // tie-break toward the closest title
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (!best) return null;

    // 4) Author verification (fail closed). Wikisource titles carry no author, so without this a
    //    same-title wrong-author work could be grounded. We require the surname to appear on the page.
    if (wantSurname && !(await authorMatchesOnPage(best, wantSurname))) return null;

    return {
      sourceId: best,
      textUrl: `${WIKI}${encodeURIComponent(best.replace(/ /g, "_"))}`,
    };
  } catch (error) {
    console.error("[wikisource] findOnWikisource failed", error);
    return null;
  }
}

/**
 * Fetch + assemble the full text of a Wikisource work from its /wiki/<title> URL. Walks the edition's
 * subpage tree via the MediaWiki API and concatenates the cleaned chapter text in reading order.
 * Returns null on a non-resolvable URL, an aborted/incomplete assembly, or any error. NEVER throws.
 */
export async function fetchWikisourceText(textUrl: string): Promise<string | null> {
  try {
    if (!textUrl || typeof textUrl !== "string") return null;
    const m = textUrl.match(/\/wiki\/(.+)$/);
    if (!m) return null;
    const title = decodeURIComponent(m[1]).replace(/_/g, " ").trim();
    if (!title) return null;

    const text = (await assembleWork(title, title)).trim();
    return text.length > 200 ? text : null;
  } catch (error) {
    console.error("[wikisource] fetchWikisourceText failed", error);
    return null;
  }
}
