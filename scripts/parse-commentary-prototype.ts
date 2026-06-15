/**
 * PROTOTYPE / analysis only — does NOT touch the DB or app.
 *
 * Validates that Matthew Henry's .HTM chapter files can be reliably parsed into
 * { chapter intro, sections: [{ verseStart, verseEnd, title, html }] } using the
 * `Sec{n}` + `{Book}{Chap}_{Verse}` anchors. Prints corpus-wide reliability
 * stats + detailed breakdowns for a diverse sample.
 *
 * Run: npx tsx scripts/parse-commentary-prototype.ts
 */
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const ROOT = path.join(process.cwd(), "src", "server", "data", "Matthew-Henry-Commentary-Volumes");
const VOLUMES = ["MHC-V1", "MHC-V2", "MHC-V3", "MHC-V4", "MHC-V5", "MHC-V6"];

interface Section {
  index: number;
  title: string;
  verseStart: number | null;
  verseEnd: number | null;
  htmlLength: number;
  textPreview: string;
}

interface ChapterParse {
  file: string;
  book: number;
  chapter: number;
  isFrontMatter: boolean; // ccc === 000 → book intro / table-of-contents, not a real chapter
  title: string;
  prevHref: string | null;
  nextHref: string | null;
  introTextLen: number;
  verseAnchorCount: number;
  maxVerseAnchor: number | null;
  sections: Section[];
  anomalies: string[];
}

function parseFile(filePath: string): ChapterParse {
  const fileName = path.basename(filePath);
  const m = fileName.match(/^MHC(\d{2})(\d{3})\.HTM$/i);
  const book = m ? parseInt(m[1], 10) : 0;
  const chapter = m ? parseInt(m[2], 10) : 0;
  const isFrontMatter = chapter === 0;

  const html = fs.readFileSync(filePath, "utf-8");
  const $ = cheerio.load(html);
  const title = $("title").text().trim();

  let prevHref: string | null = null;
  let nextHref: string | null = null;
  $("a").each((_, a) => {
    const txt = $(a).text().trim().toLowerCase();
    const href = $(a).attr("href") || null;
    if (txt === "previous") prevHref = href;
    if (txt === "next") nextHref = href;
  });

  // Enumerate every <A NAME="..."> with its position in the raw HTML.
  const anchorRe = /<A\s+NAME="([^"]+)"\s*>/gi;
  const anchors: Array<{ name: string; pos: number }> = [];
  let mm: RegExpExecArray | null;
  while ((mm = anchorRe.exec(html)) !== null) {
    anchors.push({ name: mm[1], pos: mm.index });
  }

  const isSec = (name: string) => /^Sec\d+$/i.test(name);
  const verseOf = (name: string): number | null => {
    if (isSec(name)) return null;
    const v = name.match(/_(\d+)$/);
    return v ? parseInt(v[1], 10) : null;
  };

  const secAnchors = anchors.filter((a) => isSec(a.name));
  const verseAnchors = anchors
    .map((a) => ({ ...a, verse: verseOf(a.name) }))
    .filter((a) => a.verse !== null) as Array<{ name: string; pos: number; verse: number }>;

  const verseAnchorCount = verseAnchors.length;
  const maxVerseAnchor = verseAnchors.length ? Math.max(...verseAnchors.map((v) => v.verse)) : null;

  const anomalies: string[] = [];
  const sections: Section[] = [];

  // Strip the leading nav table for cleaner content/preview.
  const bodyEnd = html.length;

  for (let k = 0; k < secAnchors.length; k++) {
    const secPos = secAnchors[k].pos;
    const prevSecPos = k === 0 ? 0 : secAnchors[k - 1].pos;

    // Verse anchors that sit between the previous section start and this Sec
    // anchor belong to THIS section (they're the block printed just before it).
    const versesForSection = verseAnchors.filter((v) => v.pos > prevSecPos && v.pos < secPos);
    const verseStart = versesForSection.length ? Math.min(...versesForSection.map((v) => v.verse)) : null;
    const verseEnd = versesForSection.length ? Math.max(...versesForSection.map((v) => v.verse)) : null;

    // Content runs from this Sec anchor to the next (or end of file).
    const contentEnd = k === secAnchors.length - 1 ? bodyEnd : secAnchors[k + 1].pos;
    let sectionHtml = html.slice(secPos, contentEnd);
    // Drop trailing empty verse/sec anchors that belong to the next block.
    sectionHtml = sectionHtml.replace(/(\s*<A\s+NAME="[^"]+"\s*>\s*<\/A>)+\s*$/i, "");

    const $$ = cheerio.load(sectionHtml);
    const sectionTitle = ($$("i").first().text() || $$("td").first().text() || "").trim().slice(0, 80);
    const textPreview = $$("body").text().replace(/\s+/g, " ").trim().slice(0, 160);

    if (verseStart === null) anomalies.push(`Sec${k + 1} has no preceding verse anchors`);

    sections.push({
      index: k + 1,
      title: sectionTitle,
      verseStart,
      verseEnd,
      htmlLength: sectionHtml.length,
      textPreview,
    });
  }

  // Intro text = before the first verse anchor / first section.
  const firstAnchorPos = anchors.length ? anchors[0].pos : html.length;
  const introHtml = html.slice(0, firstAnchorPos);
  const introTextLen = cheerio.load(introHtml)("body").text().replace(/\s+/g, " ").trim().length;

  if (!isFrontMatter) {
    if (secAnchors.length === 0) anomalies.push("NO Sec anchors");
    if (verseAnchorCount === 0) anomalies.push("NO verse anchors");
    // Coverage: do sections collectively start at verse 1 and reach the max anchor?
    const starts = sections.map((s) => s.verseStart).filter((v): v is number => v !== null);
    const ends = sections.map((s) => s.verseEnd).filter((v): v is number => v !== null);
    if (starts.length && Math.min(...starts) !== 1) anomalies.push(`coverage starts at v${Math.min(...starts)} (not 1)`);
    if (ends.length && maxVerseAnchor !== null && Math.max(...ends) !== maxVerseAnchor)
      anomalies.push(`coverage ends at v${Math.max(...ends)} (max anchor v${maxVerseAnchor})`);
  }

  return { file: fileName, book, chapter, isFrontMatter, title, prevHref, nextHref, introTextLen, verseAnchorCount, maxVerseAnchor, sections, anomalies };
}

function main() {
  const files: string[] = [];
  for (const vol of VOLUMES) {
    const dir = path.join(ROOT, vol);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/\.HTM$/i.test(f)) files.push(path.join(dir, f));
    }
  }

  const results = files.map(parseFile);
  const chapters = results.filter((r) => !r.isFrontMatter);
  const frontMatter = results.filter((r) => r.isFrontMatter);

  const noSec = chapters.filter((r) => r.sections.length === 0);
  const noVerses = chapters.filter((r) => r.verseAnchorCount === 0);
  const withAnomalies = chapters.filter((r) => r.anomalies.length > 0);
  const sectionCountDist: Record<number, number> = {};
  for (const r of chapters) sectionCountDist[r.sections.length] = (sectionCountDist[r.sections.length] || 0) + 1;

  console.log("================ CORPUS RELIABILITY ================");
  console.log(`Total .HTM files:        ${results.length}`);
  console.log(`Front-matter (ccc=000):  ${frontMatter.length}`);
  console.log(`Real chapter files:      ${chapters.length}`);
  console.log(`Chapters w/ 0 sections:  ${noSec.length}`);
  console.log(`Chapters w/ 0 verses:    ${noVerses.length}`);
  console.log(`Chapters w/ anomalies:   ${withAnomalies.length}`);
  console.log(`Section-count distribution (sections -> #chapters):`);
  Object.keys(sectionCountDist)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((k) => console.log(`   ${k} sections: ${sectionCountDist[k]}`));

  console.log(`\n--- chapters with 0 sections (first 20) ---`);
  noSec.slice(0, 20).forEach((r) => console.log(`   ${r.file}  (book ${r.book} ch ${r.chapter})  verses=${r.verseAnchorCount}`));

  console.log(`\n--- anomaly samples (first 25) ---`);
  withAnomalies.slice(0, 25).forEach((r) => console.log(`   ${r.file}: ${r.anomalies.join("; ")}`));

  // Detailed dumps for a diverse, named sample.
  const sampleNames = [
    "MHC01001.HTM", // Genesis 1 (OT narrative)
    "MHC01003.HTM", // Genesis 3
    "MHC19023.HTM", // Psalm 23 (poetry, single psalm)
    "MHC19119.HTM", // Psalm 119 (longest chapter)
    "MHC23053.HTM", // Isaiah 53 (prophecy)
    "MHC43003.HTM", // John 3 (known-good)
    "MHC46013.HTM", // 1 Corinthians 13 (epistle)
    "MHC57001.HTM", // Philemon (one-chapter book)
    "MHC65001.HTM", // Jude (one-chapter book)
    "MHC66022.HTM", // Revelation 22 (last chapter)
  ];
  console.log(`\n================ DETAILED SAMPLES ================`);
  for (const name of sampleNames) {
    const r = results.find((x) => x.file.toUpperCase() === name);
    if (!r) {
      console.log(`\n### ${name} — NOT FOUND`);
      continue;
    }
    console.log(`\n### ${r.file} — ${r.title}`);
    console.log(`   book=${r.book} chapter=${r.chapter} introTextLen=${r.introTextLen} maxVerseAnchor=${r.maxVerseAnchor} prev=${r.prevHref} next=${r.nextHref}`);
    if (r.anomalies.length) console.log(`   ⚠️ anomalies: ${r.anomalies.join("; ")}`);
    r.sections.forEach((s) =>
      console.log(`   • Sec${s.index} [vv ${s.verseStart}-${s.verseEnd}] "${s.title}" (${s.htmlLength} bytes) — ${s.textPreview.slice(0, 90)}…`)
    );
  }
}

main();
