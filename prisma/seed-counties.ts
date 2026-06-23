import "dotenv/config";
import { PrismaClient } from "../src/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withoutSslParams } from "../src/lib/db-url";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

// Prisma 7 requires a driver adapter (mirror src/server/db.ts).
const createPrismaClient = () => {
  const connectionString = withoutSslParams(process.env.DIRECT_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL);
  if (!connectionString) {
    throw new Error("DATABASE_URL or DIRECT_DATABASE_URL environment variable is required");
  }
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
};

const prisma = createPrismaClient();

interface RawCounty {
  County: string;
  State: string;
  ids?: { fips?: string };
  population?: { total?: number };
  [key: string]: unknown;
}

/**
 * Seeds the `counties` table from src/server/data/counties_list.json so the
 * "Neighbor Love" feature can query the DB instead of reading a 29MB file on
 * every request. Re-runnable: clears the table, then bulk-inserts in chunks.
 */
async function main() {
  console.log("🗺️  Seeding US counties...");

  const dataPath = path.join(process.cwd(), "src", "server", "data", "counties_list.json");
  if (!fs.existsSync(dataPath)) {
    console.error("❌ counties_list.json not found at:", dataPath);
    process.exit(1);
  }

  const counties = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as RawCounty[];
  console.log(`Found ${counties.length} counties to seed.`);

  // De-dupe on (state, county) to satisfy the @@unique constraint.
  const seen = new Set<string>();
  const rows: Array<{
    state: string;
    county: string;
    fips: string | null;
    populationTotal: number | null;
    data: unknown;
  }> = [];
  for (const c of counties) {
    if (!c.State || !c.County) continue;
    const key = `${c.State}__${c.County}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      state: c.State,
      county: c.County,
      fips: c.ids?.fips ?? null,
      populationTotal: typeof c.population?.total === "number" ? c.population.total : null,
      data: c,
    });
  }

  // Fresh load.
  await prisma.county.deleteMany({});

  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await prisma.county.createMany({ data: chunk as any, skipDuplicates: true });
    inserted += res.count;
    console.log(`Inserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
  }

  console.log(`✅ Counties seeding complete (${inserted} rows).`);
}

main()
  .catch((e) => {
    console.error("❌ Counties seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
