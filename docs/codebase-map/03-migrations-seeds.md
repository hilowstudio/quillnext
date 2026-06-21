# 03 — Migrations & Seeds
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

### Migrations (`prisma/migrations/*/migration.sql`, applied in directory order)
| File | Role |
|---|---|
| `00000000000000_extensions_rls/migration.sql` | Baseline: `vector` extension + `rls_auto_enable()` event trigger that auto-ENABLEs RLS on every new `public` table (created BEFORE init so init's tables inherit it). 51 lines. |
| `00000000000001_init/migration.sql` | The full Prisma datamodel: 21 enums (`CREATE TYPE`, lines 5–65), 56 tables (`CREATE TABLE`), all indexes + FKs. 1516 lines. |
| `00000000000002_rls_policies/migration.sql` | Real RLS: `app` schema + GUC accessors, NOLOGIN `app_user` role, per-table tenant policies. 145 lines. |
| `00000000000003_fix_bible_memory_rls/migration.sql` | Re-classifies `bible_memory` from user-owned to student/default-scoped command-specific policies. 56 lines. |
| `00000000000004_book_extractions/migration.sql` | Global shared `book_extractions` catalog + `books.book_extraction_id` link; global RLS recipe. 63 lines. |
| `00000000000005_video_extractions/migration.sql` | Global shared `video_extractions` + `video_extraction_chunks`; drops global-unique on `youtube_video_id`, adds per-org unique. 89 lines. |
| `00000000000006_book_sections/migration.sql` | `book_extraction_sections`, `book_section_objectives`, `spine_gaps` (grounded-gen phase 2). 83 lines. |
| `00000000000007_book_text_chunks/migration.sql` | `book_text_chunks` full-text RAG + 4 provenance cols on `book_extractions`. 36 lines. |
| `00000000000008_textbook_corpus/migration.sql` | `textbook_documents` + `textbook_chunks` (OpenStax corpus). 65 lines. |
| `00000000000009_textbook_topic_coverage/migration.sql` | `textbook_topic_coverage` (textbook↔spine-Topic crosswalk, FK-less topic_id). 32 lines. |
| `00000000000010_book_full_text_raw/migration.sql` | Adds transient `book_extractions.full_text_raw` holding column. 8 lines. |
| `00000000000011_book_sections_status/migration.sql` | Adds `book_extractions.sections_status`. 7 lines. |
| `00000000000012_add_profiles/migration.sql` | `profiles` table + enums + `students.profile_id` link; profile RLS. 27 lines. |
| `00000000000013_rename_students_to_learners/migration.sql` | `ALTER TABLE students RENAME TO learners` (metadata-only). 6 lines. |
| `00000000000014_pin_management/migration.sql` | Drops `classroom_instructors.instructor_pin`; adds `profiles.pin_failed_count` + `pin_window_start`. 10 lines. |
| `00000000000015_learner_adult_fields/migration.sql` | Drops NOT NULL on `learners.birthdate` + `current_grade`. 6 lines. |
| `prisma/migrations/migration_lock.toml` | `provider = "postgresql"`. SUPPORT. |

### Seeders (`prisma/seed*.ts`)
| File | Role | Wired? |
|---|---|---|
| `seed.ts` | Academic spine (Subject→Strand→Topic→Subtopic→Objective) + sequencing + GradeBands. | `db:seed` (package.json:17) |
| `seed-generator-content-types.ts` | ResourceKinds from YAML. | `db:seed:generators` (:18) |
| `seed-discipleship.ts` | Devotionals. | `db:seed:discipleship` (:19) |
| `seed-counties.ts` | counties. | `db:seed:counties` (:20) |
| `seed-catechisms.ts` | Catechism + CatechismQuestion. | `db:seed:catechisms` (:21) |
| `seed-commentary.ts` | CommentaryChapter + CommentarySection. | `db:seed:commentary` (:22) |

### Static data sources (EXCLUDED from line-by-line; shape documented in §4)
`prisma/data/quill-standards/academic_standards_master.json` + `academic_standards_sequenced.json`; `prisma/data/GENERATOR_CONTENT_TYPES.YAML`; `prisma/data/devotionals.json` (1.6 MB); `src/data/catechisms/{wsc,wlc,baptist,heidelberg,puritan,young_children,matthew_henry}.ts`; `src/server/data/Matthew-Henry-Commentary-Volumes/MHC-V1..V6/*.HTM`; `src/server/data/counties_list.json` (29.8 MB). All present on disk (verified).

## 2. Purpose / intent
This area builds the database from scratch (`prisma migrate deploy`) and loads its reference/global data. Two distinct responsibilities: (a) **migrations** define schema + the *real* tenant boundary (RLS via `app_user`, since DB-level enforcement is the only thing standing between orgs when the app connects as the non-bypass role); (b) **seeders** populate global, cross-tenant reference tables — the academic spine, grade bands, generator catalog, US counties, devotionals, catechisms, and Matthew Henry commentary — none of which are org-scoped. The migration sequence narrates the product's evolution: core LMS → real RLS → cross-org shared AI extraction catalogs → grounded-generation corpora → the "profiles / learners" identity refactor.

## 3. Architecture & key files

### Migration ordering trick (00..15)
Prisma normally orders migrations by their timestamp prefix; here they are hand-numbered `00000000000000`–`00000000000015`. Migration `0000` runs FIRST and installs the `rls_auto_enable` event trigger BEFORE `0001` creates tables, so every table created by init auto-gets `ENABLE ROW LEVEL SECURITY` (00:9-50). Both the trigger creation (00:40-50) and the `app_user` role creation (02:32-36) are wrapped in `DO $do$ ... EXCEPTION` / privilege guards so a restricted-role `migrate deploy` degrades gracefully.

### RLS machinery (migration 0002) — cross-ref 04-security-auth-tenancy.md
- **GUC accessors** (`app.current_org()`, `app.current_user_id()`, 02:23-30): `STABLE`, `SET search_path = ''`, return `NULLIF(current_setting(..., true), '')` so a missing GUC **fails closed** (org-scoped queries see nothing). Return `text` because Prisma ids are text.
- **`app_user` role** (02:32-36): `NOLOGIN NOBYPASSRLS`. Comment (02:13-16) says login + password are granted OUT OF BAND. Gets table/sequence grants + default privileges (02:38-45).
- **Policy classes** (all `FOR ALL TO app_user`, `USING` + `WITH CHECK`):
  - Direct `account_id = current_org` (02:48-52): articles, books, classrooms, courses, custom_events, document_resources, resources, students, student_schedule_items, video_resources.
  - Direct `organization_id = current_org` (02:55-59): curriculum_specs, transcripts.
  - `organizations` (02:61-64): `USING id=current_org`, but `WITH CHECK (... OR current_org IS NULL)` to permit first-run onboarding INSERT before any context exists.
  - User-owned `user_id = current_user` (02:67-71): gratitude_entries, devotional_reflections, local_church_notes, prayer_entries, bible_memory (later REPLACED by 0003).
  - Student→org subquery (02:74-78): activity_progress, bible_memory_folder, classroom_students, course_progress, course_students, learner_profiles, safety_flags, student_catechism_progress.
  - Deeper join chains for assessments/items/attempts/responses/activities/activity_objectives (02:82-110), classroom_holidays/instructors (02:113-117), book_generated_materials/resource_assignments via resource (02:120-124), curriculum_bundles via spec `"specId"` (02:127-130).
  - Auth tables `USING true` (02:133-137): users, accounts, sessions, verification_tokens — sign-in precedes org context.
  - Read-only global reference `app_user_read FOR SELECT USING true` (02:140-144): subjects, strands, topics, subtopics, objectives, grade_bands, resource_kinds, catechisms, catechism_questions, commentary_chapters, commentary_sections, devotionals, counties, prayer_categories.

### Global/shared catalog RLS (migrations 0004–0009)
A repeated recipe: `ENABLE ROW LEVEL SECURITY` + `GRANT SELECT/INSERT/UPDATE[/DELETE]` + separate `app_user_read/write/update[/delete]` policies all `USING/WITH CHECK (true)`. These tables have **no `account_id`** (deliberately cross-org). The migration comments state they are added to `CONTEXT_FREE_MODELS` in `src/server/db.ts` so the per-request org GUC is skipped. DELETE is granted only where the worker re-ingests idempotently (chunks/sections/coverage, not the parent catalog rows in 0004).

### Seeder shape
All seeders instantiate Prisma 7 with a `PrismaPg` adapter and prefer `DIRECT_DATABASE_URL` over `DATABASE_URL` (e.g. seed.ts:11-25, seed-catechisms.ts:15-23) — deliberately connecting directly (likely as `postgres`/superuser, bypassing RLS) so they can write global reference + `is_default` library data. They use SSL `rejectUnauthorized:false` — the Supabase-standard posture, which is repo-wide (the runtime client `src/server/db.ts:16` uses the identical setting); Q-03-003 accepted by-design (Session 5).

## 4. Data flow

### `prisma migrate deploy` (build)
`00 extensions_rls` → installs vector + RLS auto-enable trigger → `01 init` (tables inherit RLS) → `02` real policies → `03`..`15` incremental. `package.json` build runs `prisma generate` then `next build` (package.json:9); migrations are applied by `prisma migrate deploy` (not in build script — run separately/CI).

### Seed: academic spine (`seed.ts`)
1. Locates `academic_standards_master.json` by trying `cwd/quill-standards/...` then `cwd/prisma/data/quill-standards/...` (seed.ts:42-47); warns + skips if absent.
2. **Idempotency guard**: if `prisma.objective.count() > 0`, the whole spine reload is skipped (seed.ts:96-98). Otherwise walks `subjects[].sub_subjects[].topics[].sub_topics[].objectives[]` and `upsert`s Subject/Strand/Topic/Subtopic/Objective keyed on natural codes (`subject.id || subject.code`, etc.) (seed.ts:100-231). JSON `sub_subjects` map to schema `Strand` (seed.ts:126-128). Each unit's `sortOrder` is set from its master-JSON array index in both create and update (seed.ts:110/120, 141/150, …; Session 4 / Q-03-004 — previously hard-coded `0`).
3. Loads `academic_standards_sequenced.json` (seed.ts:236-240) and applies `gradeLevel`/`complexity` via chunked raw `UPDATE objectives ... FROM (VALUES ...)` in 2000-row batches (seed.ts:286-302) — replacing a ~26k-roundtrip loop that dropped the pooled connection.
4. Upserts 4 GradeBands keyed on `code` (seed.ts:316-333). ResourceKinds intentionally NOT seeded here (seed.ts:336-339).
- **JSON shape**: `{ subjects: [{ id?, code, name, description?, uuid?, sub_subjects:[{...topics:[{...sub_topics:[{...objectives:[{id?,code,text,...}]}]}]}] }] }`; sequenced = `{ curriculum_sequence: { grade_levels: { <name>: { subjects: { <name>: { objectives:[{objective_id, grade?, complexity?}] }}}}}}`.

### Seed: generators (`seed-generator-content-types.ts`)
**Destructive (guarded)**: a preflight counts referencing `Resource` + `BookGeneratedMaterial` rows (both `resource_kind_id` is NOT NULL + RESTRICT) and aborts with a clear message if any exist (lines 45-56; Session 4 / Q-03-005), then `resourceKind.deleteMany({})` (line 58), then loads `GENERATOR_CONTENT_TYPES.YAML` (a `Record<subject, Record<strand, string[]>>`), fuzzy-resolves subject/strand by name/code against pre-fetched maps (lines 64-150), and `upsert`s a ResourceKind per generator name keyed on slug `code` (lines 163-191). `inferContentType`/`needsVision` keyword-classify each (lines 227-245). Batches of 10 (line 201-204). "Universal Tools & Templates" subjects are left unlinked (lines 95-96).

### Seed: counties (`seed-counties.ts`)
Reads `src/server/data/counties_list.json` (RawCounty[]), de-dupes on `State__County`, `county.deleteMany({})` (line 69), then chunked `createMany({ skipDuplicates:true })` of 500 (lines 71-79). Maps `ids.fips`, `population.total`, raw object → `data` JSONB.

### Seed: devotionals (`seed-discipleship.ts`)
Reads `prisma/data/devotionals.json`, upserts each on unique `(month, day, time)` in chunks of 50 (lines 47-69).

### Seed: catechisms (`seed-catechisms.ts`)
Imports 7 bundled TS datasets from `src/data/catechisms/*` (lines 7-13). For each: `catechism.upsert` keyed on `code` (slugs MUST match CatechismManager ids, lines 32-34), then `catechismQuestion.deleteMany` + chunked `createMany` of 500 (lines 63-76). Stores each raw question object in `data` JSONB and `number` as string.

### Seed: commentary (`seed-commentary.ts`)
Walks `src/server/data/Matthew-Henry-Commentary-Volumes/MHC-V1..V6`, matches `MHC<book2><chap3>.HTM`, parses via shared pure `src/lib/commentary-parser.ts`, `commentaryChapter.upsert` on `(source, book, chapter)` + `commentarySection.deleteMany` then `createMany` (lines 35-65). Books 1–66, chapter ≥1 (lines 40); others skipped.

## 5. Status table
| Unit | Status | Evidence |
|---|---|---|
| migration 0000 (extensions/RLS trigger) | DONE | `00:7,12-50`; trigger live for all subsequent tables |
| migration 0001 (init) | DONE | `01:1-1516` full datamodel; 21 enums (`01:5-65`), 56 tables |
| migration 0002 (RLS policies) | DONE | `02:1-145`; canonical tenant boundary |
| migration 0003 (bible_memory RLS fix) | DONE | `03:15-55` replaces 0002's single policy |
| migrations 0004–0009 (shared catalogs) | DONE | each enables RLS + policies + grants; referenced by CONTEXT_FREE_MODELS per comments |
| migrations 0010, 0011 (column adds) | DONE | `10:7`, `11:6` |
| migration 0012 (profiles) | DONE | `12:1-27` |
| migration 0013 (rename to learners) | DONE | `13:5`; schema `Learner @@map("learners")` (schema:317) |
| migration 0014 (pin mgmt) | DONE | `14:4,8-9` |
| migration 0015 (learner adult fields) | DONE | `15:4-5`; schema birthdate/currentGrade nullable (schema:286,288) |
| `seed.ts` | DONE | `db:seed` (package.json:17); idempotent (seed.ts:96-98, upserts); `sortOrder` now from array index (Session 4 / Q-03-004) |
| `seed-generator-content-types.ts` | DONE | `db:seed:generators` (:18); idempotent via delete+upsert (line 58,164); FK-preflight guard before the destructive delete (Session 4 / Q-03-005) |
| `seed-counties.ts` | DONE | `db:seed:counties` (:20); idempotent via delete+createMany (line 69) |
| `seed-discipleship.ts` | DONE | `db:seed:discipleship` (:19); idempotent upsert (line 47) |
| `seed-catechisms.ts` | DONE | `db:seed:catechisms` (:21); idempotent upsert+delete (line 56,63) |
| `seed-commentary.ts` | DONE | `db:seed:commentary` (:22); idempotent upsert+delete (line 45,50) |
| ~~`seed-book.ts`~~ | ✅ REMOVED | deleted 2026-06-19 (Session 5, Q-03-001) — was DEAD + broken (no adapter under Prisma 7) |

## 6. Integration points
- **Imports in**: `@prisma/adapter-pg` (PrismaPg), `pg` (Pool), `js-yaml`, `dotenv/config`, generated client `../src/generated/client`. `seed-catechisms.ts` imports 7 datasets from `src/data/catechisms/*`. `seed-commentary.ts` imports `src/lib/commentary-parser.ts` (`parseChapterHtml`).
- **Env vars**: `DIRECT_DATABASE_URL` (preferred) / `DATABASE_URL` across all seeders (seed.ts:12, etc.). Migrations rely on the connection role's privileges (event-trigger/role creation guarded).
- **Prisma models written**: Subject, Strand, Topic, Subtopic, Objective, GradeBand (seed.ts); ResourceKind (generators); County (counties); Devotional (discipleship); Catechism, CatechismQuestion (catechisms); CommentaryChapter, CommentarySection (commentary). *(`seed-book.ts` / Book — REMOVED Session 5, Q-03-001.)*
- **External APIs/Inngest**: none invoked here. Migration comments reference an Inngest worker running as `app_user` for the shared extraction catalogs (consumer lives elsewhere — see chapters on book/video extraction).
- **Importers out**: `package.json` scripts invoke the six live seeders via `tsx`. `prisma migrate deploy` consumes the migration SQL.
- **Static data**: see §1 list — all present on disk; seeders read them at runtime by path (or TS import for catechisms).

## 7. Findings

Q-03-001  [MED]  ✅ REMOVED 2026-06-19 (Session 5, 03-MED) — `prisma/seed-book.ts` deleted (`git rm`): dead (zero importers/scripts; no `db:seed:book` in package.json) and broken under Prisma 7 (no driver adapter). Same disposition as Session 1's `verify-seed.ts`. See CHANGELOG.md. — `seed-book.ts` is broken under Prisma 7 and dead-wired  — prisma/seed-book.ts:13
  Evidence: `return new PrismaClient();` (line 13) with NO driver adapter. Prisma 7.8 (PrismaPg) requires an adapter (every other seeder passes `adapter: new PrismaPg(...)`, e.g. seed.ts:22-24). No `db:seed:book` script exists in package.json (only the six live seeders at package.json:17-22) and grep finds zero references to `seed-book`/`db:seed:book` anywhere except this chapter md. Also EXCLUDED from typechecking (`tsconfig.json:40` excludes `prisma/seed*.ts`), so `tsc` never flags the missing adapter. It builds a `Book` (organizationId/addedByUserId) directly with no RLS context set (lines 32-44), confirming the direct/bypass connection.
  Impact: Running it would throw at client construction; it is effectively dead code. Low blast radius (test-fixture only) but a maintenance trap, and silently un-typechecked.
  Status: ✅ REMOVED (file deleted in working tree; not pushed)

Q-03-002  [LOW]  ✅ REMOVED 2026-06-19 (Session 1, 01-LOW) — `verify-seed.ts` deleted (git rm) alongside Q-01-005; its `tsconfig.json` exclude removed. See CHANGELOG.md. — `verify-seed.ts` lives at repo root, not under `prisma/`, and lacks an adapter  — verify-seed.ts:2,4
  Evidence: imported `./src/generated/client` (root-relative, line 2) and `new PrismaClient()` with no adapter (line 4); no package.json script referenced it (only the chapter md, `01-platform-build-config.md`, and `tsconfig.json:43` mentioned it). It was also EXCLUDED from typechecking (`tsconfig.json:43`).
  Impact: Diagnostic-only script that will also fail to connect under Prisma 7; stale clutter that implies it is runnable when it is not, and is not typechecked.
  Status: ✅ REMOVED (file deleted in working tree; not pushed)

Q-03-003  [MED]  ✅ ACCEPTED (by-design) 2026-06-19 (Session 5, 03-MED) — re-verified across all 7 seeders. Two parts: (a) **bypass-RLS is required** — seeders write global reference tables that are read-only for `app_user` (02:140-144), so they must connect as a non-`app_user`/superuser role (correct by design); (b) `rejectUnauthorized:false` disables TLS cert validation, but this is the **Supabase-standard posture and is repo-wide, not seeder-specific** — the production runtime client `src/server/db.ts:16` uses the identical setting on every request. Owner accepted the posture; the proper hardening (pin the Supabase CA cert / `sslmode=verify-full`) is a deliberate infra task spanning runtime + seeders, out of scope for a seed session. See CHANGELOG.md. — Seeders connect directly (likely bypass-RLS role) and write global tables with SSL verification disabled  — prisma/seed.ts:18-21, seed-catechisms.ts:21, seed-counties.ts:14
  Evidence: every seeder prefers `DIRECT_DATABASE_URL` and sets `ssl: { rejectUnauthorized: false }`. The global reference RLS policies (02:140-144) are read-only for `app_user`, so writes must come from a bypass/superuser connection — meaning seed runs sidestep the tenant boundary by design.
  Impact: Expected for global reference data, but `rejectUnauthorized:false` disables TLS cert validation (MITM exposure during seeding) and the direct role has broad write power; worth noting as a posture risk. (Re-verify, Session 5: the same `rejectUnauthorized:false` is used by the runtime client `src/server/db.ts:16`, so the exposure is repo-wide.)
  Status: ✅ ACCEPTED (by-design; not fixed — TLS hardening deferred to a dedicated infra task)

Q-03-004  [LOW]  ✅ RESOLVED 2026-06-19 (Session 4, 03-LOW) — `seed.ts` now derives `sortOrder` from each unit's master-JSON array index at every spine level (Subject/Strand/Topic/Subtopic/Objective), in both `create` and `update`; the two false "Will be updated from sequenced data" comments were corrected. Seed-only change (no schema). NOTE: the already-seeded DB keeps physical-row ordering until a re-seed/backfill — the spine block is skipped on a populated DB by the objective-count guard (seed.ts:96-98). See CHANGELOG.md. — `seed.ts` spine upsert silently de-dupes on `objective.code` but updates only `text`, not grade/complexity/sortOrder  — prisma/seed.ts:208-221
  Evidence: the Objective upsert `update` block set only `text`; gradeLevel/complexity are applied later by the sequenced pass (seed.ts:295-300), and `sortOrder` was hard-coded `0` on create with a comment "Will be updated from sequenced data" — but no code ever updated `sortOrder`. (Session 4 re-verify: `sortOrder` is consumed by ~10 `orderBy:{sortOrder:"asc"}` sites — curriculum API routes, spine-actions, course-pacing, master-context, smart-defaults — and the sequenced JSON carries no order field, so master-JSON array position was the only ordering signal, and it was being discarded.)
  Impact: All spine `sortOrder` values stayed 0 (master-JSON ordering lost); any UI relying on `sortOrder` got undefined ordering. Subject/Strand/Topic/Subtopic were also created with `sortOrder: 0`.
  Status: ✅ RESOLVED (seeder fix; not pushed)

Q-03-005  [LOW]  ✅ RESOLVED 2026-06-19 (Session 4, 03-LOW) — added a preflight (seed-generator-content-types.ts:45-56) that counts referencing `Resource` + `BookGeneratedMaterial` rows and aborts with a clear message before the `deleteMany` (now line 58), instead of relying on the raw RESTRICT FK violation. The destructive re-seed now proceeds only on a DB without generated content. See CHANGELOG.md. — `seed-generator-content-types.ts` does an unconditional destructive `deleteMany` of all ResourceKinds  — prisma/seed-generator-content-types.ts:42
  Evidence: `await prisma.resourceKind.deleteMany({})` ran every invocation before re-seeding; comment (then lines 39-41) admitted it is unsafe once Resource/BookGeneratedMaterial rows reference ResourceKinds.
  Impact: FK `resource_kinds` references (resources.resource_kind_id init:1386 + book_generated_materials.resource_kind_id init:1350, both ON DELETE RESTRICT and NOT NULL) would block the delete on a populated DB (loud crash — no silent wipe), OR (if it succeeds early, i.e. no referencing rows) wipe+rebuild the generator catalog. Idempotent only on a pristine DB.
  Status: ✅ RESOLVED (preflight guard; not pushed)

