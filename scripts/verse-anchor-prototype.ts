/**
 * PROTOTYPE / analysis only. Validates per-verse anchor coverage produced by
 * src/lib/commentary-parser.ts before baking it into the seeder + UI.
 * Run: npx tsx scripts/verse-anchor-prototype.ts
 */
import fs from "fs";
import path from "path";
import { parseChapterHtml } from "../src/lib/commentary-parser";

const ROOT = path.join(process.cwd(), "src", "server", "data", "Matthew-Henry-Commentary-Volumes");
const VOLUMES = ["MHC-V1", "MHC-V2", "MHC-V3", "MHC-V4", "MHC-V5", "MHC-V6"];
const SAMPLES = ["01001", "01003", "19023", "19119", "23053", "43003", "46013", "57001", "65001", "66022"];

function main() {
  const files: Array<{ file: string; book: number; chapter: number }> = [];
  for (const vol of VOLUMES) {
    const dir = path.join(ROOT, vol);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      const mm = f.toUpperCase().match(/^MHC(\d{2})(\d{3})\.HTM$/);
      if (!mm) continue;
      const book = parseInt(mm[1], 10);
      const chapter = parseInt(mm[2], 10);
      if (book < 1 || book > 66 || chapter < 1) continue;
      files.push({ file: path.join(dir, f), book, chapter });
    }
  }

  let totalSections = 0, fullCov = 0, partialCov = 0, zeroCov = 0;
  let sumRange = 0, sumAnchored = 0, sumWithRef = 0;
  const examples: string[] = [];

  for (const { file, book, chapter } of files) {
    const parsed = parseChapterHtml(fs.readFileSync(file, "utf-8"), book, chapter);
    for (const s of parsed.sections) {
      const range = s.verseEnd - s.verseStart + 1;
      totalSections++;
      sumRange += range;
      sumAnchored += s.anchoredVerses.length;
      sumWithRef += s.refVerses.filter((v) => v >= s.verseStart && v <= s.verseEnd).length;
      if (s.anchoredVerses.length >= range) fullCov++;
      else if (s.anchoredVerses.length === 0) {
        zeroCov++;
        if (examples.length < 20) examples.push(`${path.basename(file)} Sec${s.sectionIndex} vv${s.verseStart}-${s.verseEnd}: 0/${range}`);
      } else {
        partialCov++;
        if (examples.length < 20) examples.push(`${path.basename(file)} Sec${s.sectionIndex} vv${s.verseStart}-${s.verseEnd}: ${s.anchoredVerses.length}/${range}`);
      }
    }
  }

  console.log("===== VERSE-ANCHOR COVERAGE (corpus) =====");
  console.log(`sections:                       ${totalSections}`);
  console.log(`scripture-anchor coverage:      ${sumAnchored}/${sumRange} verses (${((100 * sumAnchored) / sumRange).toFixed(1)}%)`);
  console.log(`sections fully anchored:        ${fullCov} (${((100 * fullCov) / totalSections).toFixed(1)}%)`);
  console.log(`sections partially anchored:    ${partialCov}`);
  console.log(`sections with ZERO anchors:     ${zeroCov}`);
  console.log(`verses with an inline MH ref:   ${sumWithRef}/${sumRange} (${((100 * sumWithRef) / sumRange).toFixed(1)}%)`);
  console.log(`\n--- partial/zero examples (first 20) ---`);
  examples.forEach((e) => console.log("  " + e));

  console.log(`\n===== SAMPLES =====`);
  for (const { file, book, chapter } of files) {
    const code = path.basename(file).toUpperCase().replace(/^MHC|\.HTM$/g, "");
    if (!SAMPLES.includes(code)) continue;
    const parsed = parseChapterHtml(fs.readFileSync(file, "utf-8"), book, chapter);
    console.log(`\n### ${parsed.title}`);
    for (const s of parsed.sections) {
      const range = s.verseEnd - s.verseStart + 1;
      const missing: number[] = [];
      for (let v = s.verseStart; v <= s.verseEnd; v++) if (!s.anchoredVerses.includes(v)) missing.push(v);
      console.log(
        `  Sec${s.sectionIndex} [${s.verseStart}-${s.verseEnd}] anchored ${s.anchoredVerses.length}/${range}` +
          (missing.length ? ` (missing ${missing.slice(0, 12).join(",")}${missing.length > 12 ? "…" : ""})` : "") +
          ` | inline refs [${s.refVerses.join(",")}]`,
      );
    }
  }
}

main();
