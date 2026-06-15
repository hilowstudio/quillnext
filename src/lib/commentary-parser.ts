import * as cheerio from "cheerio";
import { bookName } from "./bible-books";

/**
 * Pure parser for Matthew Henry .HTM chapter files. Shared by the seeder
 * (prisma/seed-commentary.ts) and the verse-anchor prototype so there is one
 * implementation of record. No side effects.
 *
 * Anchors in the source:
 *   - `Sec{n}`            → section (verse-group) boundaries
 *   - `{Book}{Ch}_{Verse}`→ per-verse link targets (grouped before each section)
 * Section verse range: verseStart = min verse anchor before the Sec anchor;
 * verseEnd = (next section's start − 1), last section → max verse anchor.
 */

export interface ParsedSection {
  sectionIndex: number;
  verseStart: number;
  verseEnd: number;
  title: string | null;
  html: string;
  /** Diagnostics: scripture verses that received an inline anchor. */
  anchoredVerses: number[];
  /** Diagnostics: verses MH references inline ("v. 16") in the prose. */
  refVerses: number[];
}

export interface ParsedChapter {
  title: string;
  intro: string | null;
  sections: ParsedSection[];
}

/** Modernize 1990s markup into render-safe HTML. */
export function cleanHtml(h: string): string {
  return h
    .replace(/<\/?font[^>]*>/gi, (m) => (m[1] === "/" ? "</span>" : "<span>"))
    .replace(/<b>/gi, "<strong>").replace(/<\/b>/gi, "</strong>")
    .replace(/<i>/gi, "<em>").replace(/<\/i>/gi, "</em>")
    .replace(/\sbgcolor="[^"]*"/gi, "")
    .replace(/\salign="[^"]*"/gi, "")
    .replace(/\sbackground="[^"]*"/gi, "")
    .trim();
}

function bodyHtml(fragment: string): string {
  const $ = cheerio.load(fragment);
  return $("body").html() || fragment;
}

/**
 * Inject per-verse hooks into a section's HTML:
 *  - an empty `<span id="v{n}" data-verse="{n}">` immediately before each
 *    sequential scripture verse number (deterministic; validated by sequence), and
 *  - wrap MH's inline "v. {n}" / "ver. {n}" references with
 *    `<span class="mh-vref" data-verse="{n}">` (best-effort; where he expounds it).
 * Returns enriched html + which verses got each kind of hook (diagnostics).
 */
export function enrichSection(
  html: string,
  verseStart: number,
  verseEnd: number,
): { html: string; anchoredVerses: number[]; refVerses: number[] } {
  // 1. Scripture anchors — walk verses in order, only accepting the next expected
  //    integer that looks like a verse-number token (num + 1-2 spaces + text start).
  let result = "";
  let cursor = 0;
  const anchoredVerses: number[] = [];
  for (let v = verseStart; v <= verseEnd; v++) {
    const re = new RegExp(`([>\\s\\u00a0]|&nbsp;)(${v})(\\s{1,2}(?=[A-Za-z"'(\\u2018\\u201c]))`);
    const slice = html.slice(cursor);
    const idx = slice.search(re);
    if (idx === -1) continue;
    const m = slice.match(re)!;
    const numAbs = cursor + idx + m[1].length; // position of the digits
    result += html.slice(cursor, numAbs);
    result += `<span class="mh-verse" id="v${v}" data-verse="${v}">${v}</span>`;
    cursor = numAbs + String(v).length;
    anchoredVerses.push(v);
  }
  result += html.slice(cursor);

  // 2. Inline reference highlighting.
  const refVerses = new Set<number>();
  result = result.replace(/\b(v|ver)\.\s?(\d+)/gi, (full, _kw, num) => {
    refVerses.add(parseInt(num, 10));
    return `<span class="mh-vref" data-verse="${num}">${full}</span>`;
  });

  return { html: result, anchoredVerses, refVerses: [...refVerses].sort((a, b) => a - b) };
}

export function parseChapterHtml(html: string, book: number, chapter: number): ParsedChapter {
  const anchorRe = /<A\s+NAME="([^"]+)"\s*>/gi;
  const anchors: Array<{ name: string; pos: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) anchors.push({ name: m[1], pos: m.index });

  const isSec = (n: string) => /^Sec\d+$/i.test(n);
  const verseOf = (n: string): number | null => {
    if (isSec(n)) return null;
    const v = n.match(/_(\d+)$/);
    return v ? parseInt(v[1], 10) : null;
  };

  const secAnchors = anchors.filter((a) => isSec(a.name));
  const verseAnchors = anchors
    .map((a) => ({ ...a, verse: verseOf(a.name) }))
    .filter((a) => a.verse !== null) as Array<{ name: string; pos: number; verse: number }>;
  const maxVerse = verseAnchors.length ? Math.max(...verseAnchors.map((v) => v.verse)) : 0;

  const firstAnchorPos = anchors.length ? anchors[0].pos : html.length;
  const centerEnd = html.toUpperCase().indexOf("</CENTER>");
  const introStart = centerEnd >= 0 && centerEnd < firstAnchorPos ? centerEnd + "</CENTER>".length : 0;
  const introText = introStart < firstAnchorPos ? cheerio.load(html.slice(introStart, firstAnchorPos))("body").text().trim() : "";
  const intro = introText.length > 20 ? cleanHtml(bodyHtml(html.slice(introStart, firstAnchorPos))) : null;

  const rawStarts: (number | null)[] = secAnchors.map((sec, k) => {
    const prevPos = k === 0 ? 0 : secAnchors[k - 1].pos;
    const vs = verseAnchors.filter((v) => v.pos > prevPos && v.pos < sec.pos).map((v) => v.verse);
    return vs.length ? Math.min(...vs) : null;
  });
  let last = 1;
  const starts = rawStarts.map((s, i) => {
    if (s !== null) { last = s; return s; }
    return i === 0 ? 1 : last;
  });
  const ends = starts.map((s, k) => {
    for (let j = k + 1; j < starts.length; j++) if (starts[j] > s) return starts[j] - 1;
    return Math.max(maxVerse, s);
  });

  const sections: ParsedSection[] = secAnchors.map((sec, k) => {
    const contentEnd = k === secAnchors.length - 1 ? html.length : secAnchors[k + 1].pos;
    const $$ = cheerio.load(html.slice(sec.pos, contentEnd));
    const rawTitle = ($$("i").first().text() || "").replace(/\s+/g, " ").trim().slice(0, 140);
    const verseStart = starts[k];
    const verseEnd = ends[k];
    const title = rawTitle && !/^\d/.test(rawTitle) && rawTitle.length > 2
      ? rawTitle
      : `${bookName(book)} ${chapter}:${verseStart}-${verseEnd}`;
    $$("table").first().remove();
    $$("a[name]").each((_, el) => { if (!$$(el).text().trim()) $$(el).remove(); });
    const cleaned = cleanHtml($$("body").html() || "");
    const enriched = enrichSection(cleaned, verseStart, verseEnd);
    return {
      sectionIndex: k + 1,
      verseStart,
      verseEnd,
      title,
      html: enriched.html,
      anchoredVerses: enriched.anchoredVerses,
      refVerses: enriched.refVerses,
    };
  });

  return { title: `${bookName(book)} ${chapter}`, intro, sections };
}
