import "dotenv/config";
import { PrismaClient } from "../src/generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

// Create a direct Prisma client for seeding.
// Prisma 7 requires a driver adapter (the bare `datasources` option no longer
// connects); mirror src/server/db.ts so the seed uses the same pg adapter.
const createPrismaClient = () => {
  const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL or DIRECT_DATABASE_URL environment variable is required");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({ adapter });
};

const prisma = createPrismaClient();

/**
 * Database Seeding Script
 * 
 * Seeds the Academic Spine from JSON files and ResourceKinds from YAML
 * Based on CURRICULUM_INTEGRATION_GUIDE.mdc
 */
async function main() {
  console.log("🌱 Starting database seed...");

  try {
    // 1. Load Master Standards
    console.log("📚 Loading academic standards...");
    // Try multiple possible paths
    const possiblePaths = [
      path.join(process.cwd(), "quill-standards", "academic_standards_master.json"),
      path.join(process.cwd(), "prisma", "data", "quill-standards", "academic_standards_master.json"),
    ];

    const standardsPath = possiblePaths.find((p) => fs.existsSync(p));

    if (!standardsPath) {
      console.warn("⚠️  academic_standards_master.json not found in any expected location. Skipping standards seeding.");
      console.warn("   Tried:", possiblePaths);
    } else {
      const standardsRaw = fs.readFileSync(standardsPath, "utf-8");
      const standards = JSON.parse(standardsRaw) as {
        subjects?: Array<{
          id?: string;
          code: string;
          name: string;
          description?: string;
          uuid?: string;
          sub_subjects?: Array<{
            id?: string;
            code: string;
            name: string;
            description?: string;
            short_code?: string;
            uuid?: string;
            topics?: Array<{
              id?: string;
              code: string;
              name: string;
              description?: string;
              short_code?: string;
              uuid?: string;
              sub_topics?: Array<{
                id?: string;
                code: string;
                name: string;
                description?: string;
                short_code?: string;
                uuid?: string;
                objectives?: Array<{
                  id?: string;
                  code: string;
                  text: string;
                  short_code?: string;
                  description?: string;
                  uuid?: string;
                }>;
              }>;
            }>;
          }>;
        }>;
      };

      const existingObjectiveCount = await prisma.objective.count();
      if (existingObjectiveCount > 0) {
        console.log(`  ↪ Spine already present (${existingObjectiveCount} objectives) — skipping spine reload.`);
      } else if (standards.subjects) {
        for (const subject of standards.subjects) {
          // Map JSON "id" to database "code" (e.g., "ART" -> code)
          const subjectCode = subject.id || subject.code;

          // Upsert Subject
          const dbSubject = await prisma.subject.upsert({
            where: { code: subjectCode },
            update: {
              name: subject.name,
              description: subject.description,
            },
            create: {
              code: subjectCode,
              name: subject.name,
              description: subject.description,
              uuid: subject.uuid,
              sortOrder: 0, // Will be updated from sequenced data
            },
          });

          console.log(`  ✓ Subject: ${subject.name}`);

          // Process SubSubjects (JSON calls them "sub_subjects", schema calls them "strands")
          if (subject.sub_subjects) {
            for (const strand of subject.sub_subjects) {
              const strandCode = strand.id || strand.code;

              const dbStrand = await prisma.strand.upsert({
                where: {
                  subjectId_code: {
                    subjectId: dbSubject.id,
                    code: strandCode,
                  },
                },
                update: {
                  name: strand.name,
                  description: strand.description,
                },
                create: {
                  subjectId: dbSubject.id,
                  code: strandCode,
                  shortCode: strand.short_code,
                  name: strand.name,
                  description: strand.description,
                  uuid: strand.uuid,
                  sortOrder: 0,
                },
              });

              // Process Topics
              if (strand.topics) {
                for (const topic of strand.topics) {
                  const topicCode = topic.id || topic.code;

                  const dbTopic = await prisma.topic.upsert({
                    where: {
                      strandId_code: {
                        strandId: dbStrand.id,
                        code: topicCode,
                      },
                    },
                    update: {
                      name: topic.name,
                      description: topic.description,
                    },
                    create: {
                      strandId: dbStrand.id,
                      code: topicCode,
                      shortCode: topic.short_code,
                      name: topic.name,
                      description: topic.description,
                      uuid: topic.uuid,
                      sortOrder: 0,
                    },
                  });

                  // Process Subtopics
                  if (topic.sub_topics) {
                    for (const subtopic of topic.sub_topics) {
                      const subtopicCode = subtopic.id || subtopic.code;

                      const dbSubtopic = await prisma.subtopic.upsert({
                        where: {
                          topicId_code: {
                            topicId: dbTopic.id,
                            code: subtopicCode,
                          },
                        },
                        update: {
                          name: subtopic.name,
                          description: subtopic.description,
                        },
                        create: {
                          topicId: dbTopic.id,
                          code: subtopicCode,
                          shortCode: subtopic.short_code,
                          name: subtopic.name,
                          description: subtopic.description,
                          uuid: subtopic.uuid,
                          sortOrder: 0,
                        },
                      });

                      // Process Objectives
                      if (subtopic.objectives) {
                        for (const objective of subtopic.objectives) {
                          const objectiveCode = objective.id || objective.code;

                          await prisma.objective.upsert({
                            where: { code: objectiveCode },
                            update: {
                              text: objective.text,
                            },
                            create: {
                              subtopicId: dbSubtopic.id,
                              code: objectiveCode,
                              shortCode: objective.short_code,
                              text: objective.text,
                              uuid: objective.uuid,
                              sortOrder: 0, // Will be updated from sequenced data
                            },
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // 2. Load Sequenced Standards (updates gradeLevel, complexity, sortOrder)
    console.log("📊 Loading sequenced standards...");
    const sequencedPaths = [
      path.join(process.cwd(), "prisma", "data", "quill-standards", "academic_standards_sequenced.json"),
      path.join(process.cwd(), "quill-standards", "academic_standards_sequenced.json"),
    ];
    const sequencedPath = sequencedPaths.find((p) => fs.existsSync(p));

    if (sequencedPath && fs.existsSync(sequencedPath)) {
      const sequencedRaw = fs.readFileSync(sequencedPath, "utf-8");
      const sequenced = JSON.parse(sequencedRaw) as {
        curriculum_sequence?: {
          grade_levels?: Record<string, {
            grade_number?: number;
            subjects?: Record<string, {
              objectives?: Array<{
                objective_id?: string;
                objective_uuid?: string;
                grade?: number;
                complexity?: number;
              }>;
            }>;
          }>;
        };
      };

      let updatedCount = 0;

      if (sequenced.curriculum_sequence?.grade_levels) {
        // Collect all (code, grade, complexity) tuples first, then apply them in
        // chunked bulk `UPDATE ... FROM (VALUES ...)` statements. This replaces a
        // per-objective updateMany loop (~26k transactional round-trips) that was
        // slow and dropped the pooled Supabase connection mid-run.
        const updates: Array<{ code: string; grade: number | null; complexity: number | null }> = [];
        for (const gradeLevelData of Object.values(sequenced.curriculum_sequence.grade_levels)) {
          if (gradeLevelData.subjects) {
            for (const subjectData of Object.values(gradeLevelData.subjects)) {
              if (subjectData.objectives) {
                for (const seqObj of subjectData.objectives) {
                  if (seqObj.objective_id) {
                    updates.push({
                      code: seqObj.objective_id,
                      grade: typeof seqObj.grade === "number" ? seqObj.grade : null,
                      complexity: typeof seqObj.complexity === "number" ? seqObj.complexity : null,
                    });
                  }
                }
              }
            }
          }
        }

        const CHUNK = 2000;
        for (let i = 0; i < updates.length; i += CHUNK) {
          const chunk = updates.slice(i, i + CHUNK);
          const valuesSql = chunk
            .map(
              (u) =>
                `('${u.code.replace(/'/g, "''")}', ${u.grade ?? "NULL"}::int, ${u.complexity ?? "NULL"}::int)`
            )
            .join(",");
          const affected = await prisma.$executeRawUnsafe(
            `UPDATE objectives AS o
             SET "gradeLevel" = v.grade, complexity = v.complexity
             FROM (VALUES ${valuesSql}) AS v(code, grade, complexity)
             WHERE o.code = v.code;`
          );
          updatedCount += Number(affected);
        }
        console.log(`  ✓ Updated ${updatedCount} objectives with sequencing data (bulk)`);
      } else {
        console.warn("⚠️  Sequenced data structure not recognized. Skipping sequencing.");
      }
    } else {
      console.warn("⚠️  academic_standards_sequenced.json not found. Skipping sequencing.");
      console.warn("   Tried:", sequencedPaths);
    }

    // 3. ResourceKinds are seeded separately by `npm run db:seed:generators`
    //    (prisma/seed-generator-content-types.ts) — underscore codes + hierarchical
    //    strand linking + description/requiresVision. Intentionally NOT seeded here
    //    to avoid re-introducing the old hyphen-coded duplicates.

    console.log("✅ Seed completed successfully!");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
