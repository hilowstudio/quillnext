# 02 — Data Model

> Source of truth: `prisma/schema.prisma` (1,656 lines), read end-to-end.
> Written against commit `b585c1e`. Status legend + `Q-NNN` findings format: see `00-INDEX.md`.
> Live-DB cross-check (row counts, drift): see `24-status-roadmap-findings.md` (Phase C).

## 1. Scope

- `prisma/schema.prisma` — the entire Prisma data model: 1 datasource, 1 generator, **68 models**, **23 enums**. *(+`PendingSafetyScan` — migration 0018 / Q-12-010, 2026-06-23.)*

Generator: `prisma-client` (new TS generator), output to `src/generated/client` (the generated
client is documented by shape in `23-…`, not read line-by-line). Datasource: `postgresql` (URL via
`DATABASE_URL`, see `01-…`). No `previewFeatures` enabled (the `postgresqlExtensions` line is
commented out — `pgvector` is installed via raw SQL migration instead; see `03-…`).

## 2. Purpose / intent

quillnext is a multi-tenant homeschool/micro-school platform. The schema models, in one Postgres DB:
a **tenant tree** (Organization → Users/Profiles/Learners/Classrooms), a **global academic spine**
(Subject→Strand→Topic→Subtopic→Objective), **courses & activities** built on that spine,
**assessment & grading**, a **"Living Library"** of books/videos/articles/documents with
**cross-org-shared AI extractions** and **pgvector RAG corpora**, AI-**generated resources**, a
**family-discipleship suite** (catechism, commentary, prayer, Bible memory, devotionals, missions),
**scheduling**, **transcripts**, and **child-safety flags**.

The single most important structural fact: **rows are partitioned into three ownership classes**,
and that partition drives both tenancy and the `CONTEXT_FREE_MODELS` allow-list in
`src/server/db.ts` (see `04-security…`):

1. **Org-scoped** — belongs to one tenant; carries an `organizationId` (DB column **`account_id`**,
   occasionally `organization_id`). Must be filtered by org in every query (RLS is OFF — `04-…`).
2. **User-owned / student-scoped** — personal rows keyed by `userId` or `studentId` (the discipleship
   journals, progress rows). Reached through the org tree, not a direct `account_id`.
3. **Global reference / cross-org shared** — the academic spine, content extractions, RAG corpora,
   catechisms, commentary, counties, devotionals. Readable by every org by design; listed in
   `CONTEXT_FREE_MODELS`.

### Naming conventions (verified)
- Table names: `@@map("snake_case_plural")`. Column names: `@map("snake_case")`.
- **The Organization FK is `account_id` on almost every org-scoped model** (historical: "account" =
  org). Two models instead use `organization_id`: `Transcript`, `CurriculumSpec`. → **Q-011**.
- The student entity is **`Learner`** (table `learners`); migration 13 renamed it from `students`.
  Many FKs and relations are still spelled `student`/`studentId` → it points at `Learner`.
- PKs are `String @id @default(uuid())` everywhere (app-generated UUID text, not DB `gen_random_uuid`).

## 3. Model inventory by domain

Legend for the **Scope** column: `ORG` = org-scoped (`account_id`/`organization_id`),
`ORG*` = org-scoped indirectly (through a parent row), `USER` = keyed by `userId`,
`STU` = keyed by `studentId` (Learner), `GLOBAL` = global/shared reference (in `CONTEXT_FREE_MODELS`),
`AUTH` = NextAuth table (permissive), `JOIN` = composite-key link table.

### A. Auth & tenant core
| Model | Table | Scope | Purpose / key fields |
|---|---|---|---|
| `Organization` | `organizations` | root | Tenant root. `type` (OrganizationType). Owns users, classrooms, courses, resources, learners, library, schedule, transcripts, profiles. `onDelete: Cascade` from many children → deleting an org wipes the family (see `account-actions.deleteAccount`). |
| `User` | `users` | AUTH | Parent/teacher login. `role` (UserRole, default PARENT). `organizationId` **nullable** (`account_id`) — a user exists pre-onboarding. `deactivatedAt` soft-delete. Owns personal discipleship rows. |
| `Account` | `accounts` | AUTH | NextAuth OAuth link (Google). `@@unique([provider, providerAccountId])`. |
| `Session` | `sessions` | AUTH | NextAuth session row (note: app uses **JWT** strategy, so DB sessions are written by the adapter but not the live session source — see `04-…`). |
| `VerificationToken` | `verification_tokens` | AUTH | NextAuth email-verification tokens. |
| `Profile` | `profiles` | ORG | Display profile for the picker. `type` (PARENT/STUDENT), `displayName`, `avatarConfig`, `pinHash`+`pinFailedCount`+`pinWindowStart` (PIN gate + throttle), `viewMode` (STANDARD/KID), `isOwner`. Links `user` (optional) and `learner` (1:1 via `Learner.profileId`). |

### B. Classroom & learners
| Model | Table | Scope | Purpose |
|---|---|---|---|
| `Classroom` | `classrooms` | ORG | School-year config: `educationalPhilosophy`, `faithBackground` (+`*Other`), term dates, `schoolDaysOfWeek` (Json), daily times, `daysPerWeek`/`hoursPerDay`, `isYearRound`, `academicGoals[]`, `environmentPreferences` (Json). |
| `ClassroomInstructor` | `classroom_instructors` | ORG* | Instructor membership; `role` (InstructorRole). `@@unique([classroomId, userId])`. |
| `ClassroomHoliday` | `classroom_holidays` | ORG* | Break/holiday dates; `@@unique([classroomId, holidayDate, name])`. |
| `Learner` | `learners` | ORG | The student. `firstName/lastName/preferredName`, `birthdate`, `currentGrade`, `learningDifficulties`, adult/support fields (`support_intensity`, `support_labels[]`, `support_profile` Json — migration 15), `avatarConfig`, optional 1:1 `profileId`. Hub for progress, attempts, schedule, discipleship. |
| `ClassroomStudent` | `classroom_students` | JOIN | Learner↔Classroom enrollment; PK `([classroomId, studentId])`. |
| `LearnerProfile` | `learner_profiles` | STU | Personality/learning-style questionnaire results (Json blobs + `rawQuestionnaireResponses`, `questionnaireVersion`, `completedAt`). 1:1 with Learner. |
| `SafetyFlag` | `safety_flags` | STU | AI-detected concern from chat/journals. `severity` (CONCERN/DANGER/SAFE/TIER_1/TIER_2/TIER_3 — **String, not enum**), `category` (BULLYING/SELF_HARM/GROOMING/VIOLENCE/SEXUAL_CONTENT/INCEST/BYPASS_ATTEMPT/OTHER/NONE — String), `message`, `reasoning`, `implicatedCaregiver`, `alertSent`, `isResolved`, `resolution`. |

### C. Academic spine (GLOBAL reference)
| Model | Table | Purpose |
|---|---|---|
| `Subject` | `subjects` | Top discipline. `code` unique; also a nullable `uuid` unique (dual identity — see Q-012). |
| `Strand` | `strands` | Under Subject. `@@unique([subjectId, code])`. |
| `Topic` | `topics` | Under Strand. `@@unique([strandId, code])`. Linked to CourseBlock. |
| `Subtopic` | `subtopics` | Under Topic. `@@unique([topicId, code])`. Linked to CourseBlock + Objective. |
| `Objective` | `objectives` | Terminal learning outcome. `code` globally unique, `complexity`, `gradeLevel`. Cross-walked from book sections + activities. |
| `GradeBand` | `grade_bands` | K–12 band (`minGrade`/`maxGrade`). Linked to Course. |

### D. Courses, blocks, activities
| Model | Table | Scope | Purpose |
|---|---|---|---|
| `Course` | `courses` | ORG | Course; FKs Subject (req), Strand?, GradeBand?. `createdByUser`. |
| `CourseStudent` | `course_students` | JOIN | Enrollment + `status` (CourseStudentStatus). PK `([courseId, studentId])`. |
| `CourseBlock` | `course_blocks` | ORG* | Hierarchical unit (`kind`: UNIT/MODULE/SECTION/CHAPTER/LESSON), self-ref `parentBlockId` (`BlockHierarchy`), `position`. **Polymorphic content**: optional FKs to `book`, `video`, `article`, `document`, `resource` + spine `topic`/`subtopic`. `sourceBundleId` links to the generation bundle. |
| `Activity` | `activities` | ORG* | Task in a block (`activityType`: ActivityType), `estimatedMinutes`, `position`. |
| `ActivityObjective` | `activity_objectives` | JOIN | Activity↔Objective (`isPrimary`). |
| `CourseProgress` | `course_progress` | STU | Per student↔course: `overallCompletionPercentage` (Decimal), `currentBlockId`, `lastActivityAt`. `@@unique([courseId, studentId])`. |
| `ActivityProgress` | `activity_progress` | STU | Per student↔activity status (ActivityStatus), time spent. `@@unique([activityId, studentId])`. |

### E. Assessment & grading
| Model | Table | Scope | Purpose |
|---|---|---|---|
| `Assessment` | `assessments` | ORG* | Quiz/test/final (`assessmentType`), `scopeKind` (AssessmentScopeKind) + optional `courseBlockId`. `totalPoints` (Decimal), `timeLimitMinutes`. FK Course (req). |
| `AssessmentItem` | `assessment_items` | ORG* | Question (`itemType`), `questionData`/`correctAnswer` (Json), `points` (Decimal), `position`. |
| `AssessmentAttempt` | `assessment_attempts` | STU | Student attempt (`status`: AttemptStatus), `scorePoints`/`maxPoints` (Decimal), `letterGrade`, `graderUserId`, `gradingMethod` (GradingMethod), `feedback`. |
| `AssessmentItemResponse` | `assessment_item_responses` | ORG* | Per-item response: `responseData` (Json), `pointsEarned`/`pointsPossible`, `isCorrect`, `feedback`. `@@unique([attemptId, itemId])`. |

### F. Living Library — org catalog + generated materials
| Model | Table | Scope | Purpose |
|---|---|---|---|
| `Book` | `books` | ORG | Org book catalog. `externalSource` (ExternalSource), `isbn`, `authors` (Json), `extractionStatus`, `tableOfContents` (Json), `summary`, `embedding` (`Unsupported("vector")`), link to global `bookExtraction`. |
| `VideoResource` | `video_resources` | ORG | Org YouTube catalog. `youtubeVideoId` **unique per-org** (`@@unique([organizationId, youtubeVideoId])`), extracted transcript/summary/keyPoints, `embedding`, link to global `videoExtraction`. |
| `Article` | `articles` | ORG | Web article; `content` (extracted markdown), `extractionStatus`. |
| `DocumentResource` | `document_resources` | ORG | Uploaded file (pdf/txt/md); `extractedText`. |
| `Resource` | `resources` | ORG | The generated/assigned content unit. `storageType` (ResourceStorageType), `content`/`metadata` (Json), `generatedForStudentId`, `generatedFrom{Book,Video,Article,Document}Id`, `generationContext` (Json), `curriculumBundleId`. |
| `ResourceKind` | `resource_kinds` | GLOBAL | Taxonomy (`code` unique, `contentType` ResourceContentType, `isSpecialized`, `requiresVision`); optional Subject/Strand scoping. Seeded (`03-…`). |
| `BookGeneratedMaterial` | `book_generated_materials` | ORG* | Book→ResourceKind→Resource link with optional `generatedForStudentId`. |
| `ResourceAssignment` | `resource_assignments` | ORG* | Assigns a Resource to a student/course/block/activity/assessment. `status` (AssignmentStatus), `dueDate`. |
| `CurriculumSpec` | `curriculum_specs` | ORG (`organization_id`) | Spec for AI curriculum compile: `subject`/`topic` (free text), `durationDays`, `readingLevel`, `constraints` (Json). |
| `CurriculumBundle` | `curriculum_bundles` | ORG* | Compile output. `status` (COMPILING/COMPLETED/FAILED — **String**), `parentBundleId`/`feedback` lineage, `failureReason`. |

### G. Global cross-org content extractions & RAG corpora (all in `CONTEXT_FREE_MODELS`)
| Model | Table | Purpose |
|---|---|---|
| `BookExtraction` | `book_extractions` | One row per real-world book, deduped on `dedupKey` (ISBN-13 or title\|author slug). AI summary/TOC/themes, `stage`, `publicDomain`, `fullTextSource`+`fullTextStatus`+`fullTextRaw` (transient), `sectionsStatus`. First org pays; all link for free. |
| `BookExtractionSection` | `book_extraction_sections` | Chapter/section facts sheet (`keyPoints`, `vocabulary`, `quotes` Json). `@@unique([bookExtractionId, sectionNumber])`. |
| `BookSectionObjective` | `book_section_objectives` | Section↔spine Objective with `confidence`. |
| `SpineGap` | `spine_gaps` | Sections that didn't map to any objective → spine-expansion backlog. |
| `BookTextChunk` | `book_text_chunks` | Public-domain full-text chunks + `embedding` (pgvector RAG). |
| `VideoExtraction` | `video_extractions` | Global YouTube extraction deduped on `youtubeVideoId`. transcript/summary/chapters/topics, `stage`, `captionsAvailable`. |
| `VideoExtractionChunk` | `video_extraction_chunks` | Transcript chunks + `embedding`. |
| `TextbookDocument` | `textbook_documents` | Open-textbook (OpenStax/Siyavula/LibreTexts…). `externalId` (column `cnx_id`) unique, `subject`/`category`, `status`. |
| `TextbookChunk` | `textbook_chunks` | Textbook section chunk + `embedding`; denormalized `subject`/`category` for filtered cosine search. |
| `TextbookTopicCoverage` | `textbook_topic_coverage` | Textbook↔spine `topicId` (**no FK by design**) with `similarity`. |

### H. Discipleship & personal tools
| Model | Table | Scope | Purpose |
|---|---|---|---|
| `Catechism` / `CatechismQuestion` | `catechisms` / `catechism_questions` | GLOBAL | Catechism content; `code` slug stable as `catechismId`. Question `data` (Json) holds the full original object. Seeded from `src/data/catechisms/*`. |
| `CommentaryChapter` / `CommentarySection` | `commentary_chapters` / `commentary_sections` | GLOBAL | Matthew Henry commentary by `book`/`chapter`, sliced into verse-range sections (HTML). Seeded from HTM volumes. |
| `Devotional` | `devotionals` | GLOBAL | Daily devotional keyed `([month, day, time])`. |
| `PrayerCategory` | `prayer_categories` | GLOBAL | Prayer-journal category taxonomy (`isDefault`). |
| `StudentCatechismProgress` | `student_catechism_progress` | STU | `currentQuestionIndex`, `masteredQuestions` (Json). `@@unique([studentId, catechismId])`. |
| `BibleMemory` | `bible_memory` | USER **or** STU | Verse memorization. `userId?` **and** `studentId?` (either owner), `currentStep` 0–8, `folderId`. |
| `BibleMemoryFolder` | `bible_memory_folder` | STU | Folder for a learner's verses. |
| `PrayerJournalEntry` | `prayer_entries` | USER (+STU?) | `userId` owner, optional `studentId`, `status` (ongoing/answered), `category`, `isPrivate`, tags. |
| `GratitudeJournal` | `gratitude_entries` | USER | `@@unique([userId, date])`. |
| `DevotionalReflection` | `devotional_reflections` | USER | `@@unique([userId, date, timeOfDay])`; SOAP-style fields. |
| `LocalChurchNotes` | `local_church_notes` | USER | Sermon notes; `@@unique([userId, date])`. |

### I. Scheduling & records
| Model | Table | Scope | Purpose |
|---|---|---|---|
| `StudentScheduleItem` | `student_schedule_items` | ORG | A learner's lesson/activity on a date. Polymorphic-ish (`courseBlockId?`/`activityId?`), `status` (ScheduleItemStatus), `isLocked`, `sequenceOrder`. |
| `CustomEvent` | `custom_events` | ORG | Calendar event; `recurrenceRule` (iCal RRULE), `parentEventId`. |
| `Transcript` | `transcripts` | ORG (`organization_id`) | Academic record; full `TranscriptData` stored as `data` (Json); `isOfficial`. |

### J. Reference (non-spine, non-discipleship)
| Model | Table | Scope | Purpose |
|---|---|---|---|
| `County` | `counties` | GLOBAL | US county demographics for the "Neighbor Love" feature. Structured columns + full `data` (Json). Seeded from `counties_list.json` (the comment notes this replaced a 29 MB per-request file read). |

## 4. Enums (23)

`ProfileType`, `ProfileViewMode`, `OrganizationType`, `UserRole`, `EducationalPhilosophy` (17
values), `FaithBackground` (19 values), `Sex`, `InstructorRole`, `CourseStudentStatus`,
`CourseBlockKind`, `ActivityType`, `AssessmentScopeKind`, `AssessmentType`, `AssessmentItemType`,
`ResourceContentType`, `ExternalSource`, `ExtractionStatus`, `ResourceStorageType`, `ActivityStatus`,
`AttemptStatus`, `GradingMethod`, `AssignmentStatus`, `ScheduleItemStatus`.

**Note — "stringly-typed" status fields that bypass the enum system** (intentional flexibility, but
no DB-level constraint): `SafetyFlag.severity`/`category`/`resolution`, `BookExtraction.stage`/
`fullTextStatus`/`sectionsStatus`/`confidence`, `VideoExtraction.stage`, `TextbookDocument.status`,
`CurriculumBundle.status`, `PrayerJournalEntry.status`/`type`. → **Q-013** (consistency/validation).

## 5. Cross-cutting structural patterns

- **Polymorphic `CourseBlock`** — one block points at exactly one of book/video/article/document/
  resource (all optional FKs). The builder/compiler assemble lessons from mixed sources.
- **Global-dedup extraction** — `Book`/`VideoResource` (org) link to `BookExtraction`/
  `VideoExtraction` (global). First org to extract pays; others reuse. `VideoResource.youtubeVideoId`
  was deliberately changed from a global unique to per-org unique (schema comment, `:914`).
- **Spine cross-walks & flywheel** — `BookSectionObjective` (section→objective),
  `TextbookTopicCoverage` (textbook→topic), and `SpineGap` (unmapped sections) feed a
  "spine-expansion" loop. See `15-…` (vector/RAG) and `13-…`/`23-…`.
- **pgvector** — `embedding Unsupported("vector")?` on `Book`, `VideoResource`, `BookTextChunk`,
  `VideoExtractionChunk`, `TextbookChunk`. Prisma cannot read/write these; all vector ops are raw SQL
  (`src/lib/utils/vector.ts`, Inngest workers). See `15-…`.
- **Cascade topology** — most child rows `onDelete: Cascade` from their org/parent; deleting an
  `Organization` cascades to users and their personal discipleship data. `account-actions.deleteAccount`
  (`04-…`) still hand-deletes resource/assignment rows first because those FKs are `RESTRICT`.

## 6. Integration points

- **Consumed by:** `src/generated/client` (generated), then `src/server/db.ts` (the tenant-aware
  client + `CONTEXT_FREE_MODELS`, `04-…`), and essentially every server action/query/route/job.
- **Migrations:** `prisma/migrations/*` materialize this schema (16 migrations) + RLS policies +
  pgvector + raw triggers. Drift analysis in `03-…`.
- **Seeds:** spine, catechisms, commentary, counties, devotionals/prayer categories, resource kinds —
  `03-…`.
- **Env:** `DATABASE_URL` (runtime + `prisma.config.ts`). `RLS_ENABLED` toggles whether the schema's
  RLS policies are actually consulted (`04-…`).

## 7. Findings (seed; consolidated in `24-…`)

```
Q-001  [HIGH]   DB Row-Level Security is gated OFF by default — the schema's RLS policies are inert.
   Evidence: RLS_ENABLED defaults false (src/server/db.ts:9); createClient returns the bare client
             (db.ts:114) so no org GUC is stamped. Migration 00000000000002 defines policies that
             are never consulted while off.
   Impact:   the app layer (explicit `where: { organizationId }` + getCurrentUserOrg) is the ONLY
             live tenant boundary. Any org-scoped query missing an org predicate = cross-tenant
             read/write. Full per-query audit consolidated in 24-…. (Cross-ref 04-…)
   Status:   ⏳ OPEN [HIGH] — Q-001 is owned by ch.04 §7 (same finding, data-model angle). Re-verified
             2026-06-19 (Session 8): reproduces at db.ts:9 + db.ts:114. There is NO code fix (the RLS
             path is already written/dormant); cutover prep done — `app_user` cutover-readiness verified
             read-only (0 GRANT gaps), and the ordered RLS-cutover runbook lives in 24-… §5/§8. Execution
             deferred to a gated infra task; stays tracked-OPEN at HIGH. See ch.04 §7 + CHANGELOG.md round 11.

Q-011  [LOW]    Inconsistent Organization-FK column naming.
   Evidence: org FK is `account_id` on ~all models, but `organization_id` on Transcript
             (schema.prisma:128) and CurriculumSpec (:1004).
   Impact:   cognitive overhead / easy to mis-write raw SQL. No functional bug.
   Status:   ✅ RESOLVED 2026-06-23 (migration 0016 — column rename + RLS-policy recreation; no app code change since the Prisma layer was already uniform). Orig deferred 2026-06-19 Session 3; re-verify then found it reproduces at
             schema.prisma:128 (Transcript `organization_id`) + :1004 (CurriculumSpec `organization_id`);
             every other org model uses `account_id`. The app/Prisma layer is ALREADY uniform — the field
             is `organizationId` everywhere; only the @map'd DB column differs — and a grep of src/ shows
             only vector.ts + api/library/videos/route.ts touch these raw column names, both on `account_id`
             tables, NOT the two exceptions. So a "fix" changes only the DB column name + the RLS-policy
             migration SQL (ch.03 §3, lines 53-54): a column-rename migration — **executed 2026-06-23** in
             migration 0016 (renamed the column + recreated the 3 coupled RLS policies). No app code change.
             (see CHANGELOG.md 2026-06-23 round)

Q-012  [INFO]   Dual identity on spine models (`code` unique AND nullable `uuid` unique).
   Evidence: Subject/Strand/Topic/Subtopic/Objective each have `code` (used as the key) plus an
             optional `uuid` (schema.prisma:374 etc.). Two unique identifiers per row.
   Impact:   ambiguity about the canonical key; orphaned/empty `uuid`s possible. Verify which the
             seed populates (03-…) and which the API/UI keys on (19-…).
   Status:   documented

Q-013  [LOW]    Stringly-typed status/category fields bypass Prisma enums (no DB constraint).
   Evidence: SafetyFlag.severity/category/resolution, BookExtraction.stage/fullTextStatus/
             sectionsStatus, VideoExtraction.stage, TextbookDocument.status, CurriculumBundle.status,
             PrayerJournalEntry.status (schema.prisma:323-329, 703-721, 763, 1026, 1487).
   Impact:   typos/invalid values are accepted; harder to reason about valid states.
   Status:   ✅ RESOLVED 2026-06-23 — migrations 0016 (10 cols) + 0017 (the 2 `stage` cols) converted ALL listed columns to DB enums (in-place `ALTER COLUMN … USING`, data preserved). Orig deferred 2026-06-19 Session 3; re-verify then found all fields reproduce —
             SafetyFlag.severity:323/category:324/resolution:329, BookExtraction.stage:703/
             fullTextStatus:713/sectionsStatus:721/confidence:709, VideoExtraction.stage:929,
             TextbookDocument.status:763, CurriculumBundle.status:1026, PrayerJournalEntry.status:1487/
             type:1485. Impact confirmed REAL (not theoretical): CurriculumBundle.status is written as
             bare string literals with no shared union/enum in compile-curriculum-action.ts:42,91 and
             compile-curriculum.ts:61,420,421 (a typo there gets no compile-time OR DB catch); same for
             PrayerJournalEntry.status:'ongoing' (prayer-journal.ts:97). A proper fix = an enum migration
             (CREATE TYPE + column conversion + backfill) on the seeded DB. Owner deferred the whole finding
             into the batched stringly-typed→enum migration that already holds Q-23-003; Q-011's column
             rename rides along too. The SafetyFlag.severity/category subset's safety-downgrade hazard was
             tracked separately at MED as Q-12-003 (ch.12 §7) — **✅ RESOLVED 2026-06-20 (Session 24)** at the
             app layer (policy urgency no longer reads the severity label), so the *safety* risk is closed;
             and Q-013's core concern — the `String`→enum DB typing — was **✅ RESOLVED 2026-06-23** (migrations
             0016 + 0017). Session 24 had corrected the stale plain-`//` comments on schema.prisma:323/324/329 to
             list the real vocabularies; the 2026-06-23 migrations then promoted every column to a real DB enum.
             Q-013 is now fully closed. (see CHANGELOG.md 2026-06-23 round)

Q-014  [INFO]   TextbookTopicCoverage.topicId has no FK to Topic (intentional, per schema comment).
   Evidence: schema.prisma:797-803.
   Impact:   coverage rows can orphan if a Topic is deleted; no referential integrity there.
   Status:   documented
```
