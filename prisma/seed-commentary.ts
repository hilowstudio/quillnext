import "dotenv/config";
import { PrismaClient } from "../src/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import fs from "fs";
import path from "path";
import { parseChapterHtml } from "../src/lib/commentary-parser";

const ROOT = path.join(process.cwd(), "src", "server", "data", "Matthew-Henry-Commentary-Volumes");
const VOLUMES = ["MHC-V1", "MHC-V2", "MHC-V3", "MHC-V4", "MHC-V5", "MHC-V6"];
const SOURCE = "matthew-henry";

const createPrismaClient = () => {
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL or DIRECT_DATABASE_URL environment variable is required");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } }) });
};
const prisma = createPrismaClient();

/**
 * Seeds Matthew Henry commentary into CommentaryChapter + CommentarySection.
 * Parsing (sectioning + per-verse anchor injection) lives in the shared, pure
 * src/lib/commentary-parser.ts so the seeder and the prototype agree.
 */
async function main() {
  console.log("📖 Seeding Matthew Henry commentary...");

  const files: string[] = [];
  for (const vol of VOLUMES) {
    const dir = path.join(ROOT, vol);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (/^MHC\d{5}\.HTM$/i.test(f)) files.push(path.join(dir, f));
  }

  let chapters = 0, sectionRows = 0, skipped = 0;
  for (const filePath of files) {
    const mm = path.basename(filePath).toUpperCase().match(/^MHC(\d{2})(\d{3})\.HTM$/);
    if (!mm) { skipped++; continue; }
    const book = parseInt(mm[1], 10);
    const chapter = parseInt(mm[2], 10);
    if (book < 1 || book > 66 || chapter < 1) { skipped++; continue; }

    const parsed = parseChapterHtml(fs.readFileSync(filePath, "utf-8"), book, chapter);
    if (parsed.sections.length === 0) { skipped++; continue; }

    const ch = await prisma.commentaryChapter.upsert({
      where: { source_book_chapter: { source: SOURCE, book, chapter } },
      update: { title: parsed.title, intro: parsed.intro },
      create: { source: SOURCE, book, chapter, title: parsed.title, intro: parsed.intro },
    });
    await prisma.commentarySection.deleteMany({ where: { chapterId: ch.id } });
    await prisma.commentarySection.createMany({
      data: parsed.sections.map((s) => ({
        chapterId: ch.id,
        sectionIndex: s.sectionIndex,
        verseStart: s.verseStart,
        verseEnd: s.verseEnd,
        title: s.title,
        html: s.html,
      })),
    });

    chapters++;
    sectionRows += parsed.sections.length;
    if (chapters % 150 === 0) console.log(`  …${chapters} chapters / ${sectionRows} sections`);
  }

  console.log(`✅ Commentary seeding complete: ${chapters} chapters, ${sectionRows} sections (${skipped} non-chapter files skipped).`);
}

main()
  .catch((e) => { console.error("❌ Commentary seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
