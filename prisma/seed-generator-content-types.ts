import "dotenv/config";
import { PrismaClient } from "../src/generated/client";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// --- Configuration ---
const BATCH_SIZE = 10; // Number of concurrent upserts
const TIMEOUT_MS = 60000; // 60s timeout for script

// Ensure DATABASE_URL is set
// NOTE: We use DATABASE_URL (Transaction Pooler) because Direct connection (5432) is timing out.
// Seeding data (DML) works fine over the pooler.
if (!process.env.DATABASE_URL) {
  console.error("❌ Error: DATABASE_URL or DIRECT_DATABASE_URL must be set.");
  process.exit(1);
}

// Instantiate Client with Adapter
const url = new URL(process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  idleTimeoutMillis: 20000,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ['warn', 'error'],
});

async function main() {
  console.log("🚀 Starting Optimized Generator Content Types Seed...");
  const startTime = Date.now();

  try {
    // 1. Load YAML
    const yamlPaths = [
      path.join(process.cwd(), "prisma", "data", "GENERATOR_CONTENT_TYPES.YAML"),
      path.join(process.cwd(), "GENERATOR_CONTENT_TYPES.YAML"),
    ];
    const yamlPath = yamlPaths.find((p) => fs.existsSync(p));

    if (!yamlPath) {
      throw new Error(`YAML file not found. Checked: ${yamlPaths.join(", ")}`);
    }

    console.log(`📄 Loading YAML from: ${yamlPath}`);
    const yamlRaw = fs.readFileSync(yamlPath, "utf-8");
    const contentTypes = yaml.load(yamlRaw) as Record<string, Record<string, string[]>>;

    // 2. Pre-fetch Subjects and Strands (The "Smart" optimization)
    console.log("📥 Pre-fetching Subjects and Strands...");

    // Fetch all Subjects
    const subjects = await prisma.subject.findMany({ select: { id: true, name: true, code: true } });
    const subjectMap = new Map<string, string>(); // Name/Code -> ID
    subjects.forEach(s => {
      subjectMap.set(s.name.toLowerCase(), s.id);
      subjectMap.set(s.code.toLowerCase(), s.id);
    });
    console.log(`   ✓ Loaded ${subjects.length} Subjects`);

    // Fetch all Strands
    const strands = await prisma.strand.findMany({ select: { id: true, name: true, subjectId: true, code: true } });
    const strandMap = new Map<string, string>(); // "subjectId:strandName" -> ID
    strands.forEach(s => {
      // Key needs to be unique enough. We'll use subjectId + name (lowercase)
      strandMap.set(`${s.subjectId}:${s.name.toLowerCase()}`, s.id);
      // Also map by code if unique globaly, but let's stick to subject context for safety
      // actually, the YAML gives us Hierarchy: Subject -> Strand. So lookup should be hierarchical.
    });
    console.log(`   ✓ Loaded ${strands.length} Strands`);

    // 3. Prepare Payloads
    console.log("🔄 Processing YAML entries...");
    const operations: (() => Promise<any>)[] = [];

    let processedCount = 0;
    let skippedCount = 0;

    for (const [subjectKey, strandsData] of Object.entries(contentTypes)) {
      // Resolve Subject
      let subjectId: string | null = null;
      let isUniversal = false;

      if (subjectKey === "Universal Tools & Templates") {
        isUniversal = true;
      } else {
        // Try exact match then fuzzy
        const lowerKey = subjectKey.toLowerCase();
        if (subjectMap.has(lowerKey)) {
          subjectId = subjectMap.get(lowerKey)!;
        } else {
          // Simple fuzzy: check if name contains key or vice-versa
          const found = subjects.find(s => s.name.toLowerCase().includes(lowerKey.split(' ')[0]));
          if (found) subjectId = found.id;
        }

        if (!subjectId) {
          console.warn(`   ⚠️ Subj Not Found: "${subjectKey}". Skipping children.`);
          continue;
        }
      }

      if (!strandsData || typeof strandsData !== 'object') continue;

      for (const [strandKey, generators] of Object.entries(strandsData)) {
        let strandId: string | null = null;

        if (!isUniversal && subjectId) {
          // Resolve Strand
          // Cleaning the key similar to original script
          const cleanKey = strandKey.trim().toLowerCase();
          const variants = [
            cleanKey,
            cleanKey.split(':')[0].trim(),
            cleanKey.split('(')[0].trim()
          ];

          // Try to find in our loaded strands for this subject
          // We filter loaded strands by subjectId first
          const subjectStrands = strands.filter(s => s.subjectId === subjectId);

          let foundStrand = subjectStrands.find(s =>
            variants.some(v => s.name.toLowerCase() === v)
          );

          // Fuzzy fallback
          if (!foundStrand) {
            foundStrand = subjectStrands.find(s =>
              variants.some(v => s.name.toLowerCase().includes(v))
            );
          }

          if (foundStrand) {
            strandId = foundStrand.id;
          } else {
            console.warn(`     ⚠️ Strand Not Found: "${strandKey}" in Subject "${subjectKey}". items will be unlinked.`);
            // We continue, but strandId is null.
          }
        }

        if (!Array.isArray(generators)) continue;

        for (const genName of generators) {
          if (typeof genName !== 'string' || !genName.trim()) continue;

          const code = slugify(genName);
          const contentType = inferContentType(genName);

          // Queue the operation
          operations.push(() =>
            prisma.resourceKind.upsert({
              where: { code },
              update: {
                label: genName,
                contentType,
                strandId,
                subjectId,
                isSpecialized: !!(strandId || subjectId),
              },
              create: {
                code,
                label: genName,
                contentType,
                strandId,
                subjectId,
                isSpecialized: !!(strandId || subjectId),
              }
            }).then(() => {
              process.stdout.write('.'); // Progress dot
            }).catch(e => {
              console.error(`\n❌ Failed: ${genName} (${code})`, e.message);
              throw e;
            })
          );
          processedCount++;
        }
      }
    }

    console.log(`\n📋 Prepared ${operations.length} DB operations.`);
    console.log(`🚀 Executing in batches of ${BATCH_SIZE}...`);

    // 4. Batch Execution
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const batch = operations.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(op => op()));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\n✅ Seed Completed in ${duration}s!`);
    console.log(`   Items Processed: ${processedCount}`);

  } catch (error) {
    console.error("\n❌ Fatal Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Helpers
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 100);
}

function inferContentType(name: string): "WORKSHEET" | "TEMPLATE" | "PROMPT" | "GUIDE" | "QUIZ" | "RUBRIC" | "OTHER" {
  const lower = name.toLowerCase();
  if (lower.includes("worksheet") || lower.includes("practice sheet")) return "WORKSHEET";
  if (lower.includes("template") || lower.includes("outline")) return "TEMPLATE";
  if (lower.includes("prompt") || lower.includes("generator") || lower.includes("starter")) return "PROMPT";
  if (lower.includes("guide") || lower.includes("instruction") || lower.includes("how-to")) return "GUIDE";
  if (lower.includes("quiz") || lower.includes("test") || lower.includes("assessment")) return "QUIZ";
  if (lower.includes("rubric")) return "RUBRIC";
  return "OTHER";
}

main();
