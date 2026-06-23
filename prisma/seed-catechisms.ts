import "dotenv/config";
import { PrismaClient } from "../src/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withoutSslParams } from "../src/lib/db-url";

// Reuse the exact bundled datasets so the DB content is identical to what the
// component shipped (preserves question `number` keys used by progress tracking).
import wsc from "../src/data/catechisms/wsc";
import wlc from "../src/data/catechisms/wlc";
import baptist from "../src/data/catechisms/baptist";
import heidelberg from "../src/data/catechisms/heidelberg";
import puritan from "../src/data/catechisms/puritan";
import youngChildren from "../src/data/catechisms/young_children";
import matthewHenry from "../src/data/catechisms/matthew_henry";

const createPrismaClient = () => {
  const connectionString = withoutSslParams(process.env.DIRECT_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL);
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_DATABASE_URL environment variable is required");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } }),
  });
};

const prisma = createPrismaClient();

interface RawQ {
  number?: string | number;
  [k: string]: unknown;
}

// `code` slugs MUST match the ids used by CatechismManager (and thus the
// catechismId stored in StudentCatechismProgress). Metadata mirrors the
// component's former inline config.
const CATECHISMS: Array<{
  code: string;
  title: string;
  description: string;
  difficulty: string;
  data: RawQ[];
}> = [
  { code: "wsc", title: "Westminster Shorter Catechism", description: "Classic Reformed catechism with 107 questions", difficulty: "Intermediate", data: wsc as RawQ[] },
  { code: "wlc", title: "Westminster Larger Catechism", description: "Comprehensive Reformed catechism", difficulty: "Advanced", data: wlc as RawQ[] },
  { code: "baptist-1695", title: "Baptist Catechism (1695)", description: "Baptist adaptation of Westminster Shorter Catechism", difficulty: "Intermediate", data: baptist as RawQ[] },
  { code: "heidelberg", title: "Heidelberg Catechism", description: "Warm, pastoral guide to Reformed doctrine", difficulty: "Intermediate", data: heidelberg as RawQ[] },
  { code: "puritan", title: "Puritan Catechism", description: "Practical Puritan teaching on Christian doctrine", difficulty: "Intermediate", data: puritan as RawQ[] },
  { code: "young-children", title: "Catechism for Young Children", description: "Simplified catechism designed for children", difficulty: "Beginner", data: youngChildren as RawQ[] },
  { code: "matthew-henry", title: "Matthew Henry's Scripture Catechism", description: "Unique format with scripture proofs", difficulty: "Advanced", data: matthewHenry as RawQ[] },
];

async function main() {
  console.log("📜 Seeding catechisms...");

  let order = 0;
  for (const c of CATECHISMS) {
    const cat = await prisma.catechism.upsert({
      where: { code: c.code },
      update: { title: c.title, description: c.description, difficulty: c.difficulty, questionCount: c.data.length, sortOrder: order },
      create: { code: c.code, title: c.title, description: c.description, difficulty: c.difficulty, questionCount: c.data.length, sortOrder: order },
    });

    // Replace questions for this catechism (idempotent re-seed).
    await prisma.catechismQuestion.deleteMany({ where: { catechismId: cat.id } });

    const rows = c.data.map((q, i) => ({
      catechismId: cat.id,
      number: q.number != null ? String(q.number) : null,
      sortOrder: i,
      data: q,
    }));

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.catechismQuestion.createMany({ data: rows.slice(i, i + CHUNK) as any });
    }

    console.log(`  ✓ ${c.code}: ${c.data.length} questions`);
    order++;
  }

  console.log("✅ Catechisms seeding complete.");
}

main()
  .catch((e) => {
    console.error("❌ Catechisms seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
