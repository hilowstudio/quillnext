# 00 — MASTER INDEX: The QuillNext Codebase Map

> **Start here.** This is the canonical top-level overview of the QuillNext
> ("Quill & Compass") codebase. It ties together 21 per-subsystem reference docs
> (`01`–`21`) plus a coverage-gap addendum (`90`). Every claim in this map was
> verified against source on branch `main` (HEAD `38fec0d`), 2026-06-15.
>
> **Trust the code, not the prose.** The repo's `.cursor/*`, `README.md`, and QSF
> artifacts are stale planning/audit documents. Where they disagree with the code,
> the code wins — and the disagreement is logged under each doc's "Risks / drift".

---

## What QuillNext is

QuillNext (user-facing brand: **Quill & Compass**) is a faith-based homeschool &
family-discipleship platform for Christian families. One parent/teacher account runs
a household ("Organization"), enrolls their children as Students, and uses AI (Google
Gemini) to generate personalized curriculum, learning resources, and assessments
grounded in a ~26,000-objective academic taxonomy — then schedules, grades, and
produces official transcripts. A parallel **Family Discipleship Suite** adds scripture
study, catechism drills, devotionals, prayer journaling, and missions/mercy tools.

**Core user surfaces** (the live primary nav, from `Sidebar.tsx`):

- **`/`** — Parent/Student **Dashboards** (active student chosen via `?studentId`).
- **`/students`** — Student roster, personality/learning-style **assessment wizard**, avatars.
- **`/courses`** — **Course Builder**: blocks, activities, enrollment, distribution.
- **`/living-library`** — Books / Videos / Articles / Documents + AI media pipeline.
- **`/creation-station`** — **Inkling Toolkit** (single-resource generation) + **Studio 26** (bulk compiler).
- **`/thinkling`** — Student AI chat ("Thinkling") with a background child-safety pipeline.
- **`/family-discipleship`** — Bible study, catechism, devotionals, prayer, missions, neighbor-love.
- **`/blueprint`** + **`/onboarding`** — **Family Blueprint** first-run setup & review.
- **`/planner`** — Weekly scheduling grid. **`/transcripts`** — GPA + PDF export. **`/grading`** — assessment grading (URL-only, not in nav).

---

## Tech stack & architecture

Verified from `package.json`, configs, and source (see `01-build-config-infra.md`):

| Layer | Choice (code-verified) | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router), installed **16.2.9** | `package.json` declares `^16.1.1` |
| UI runtime | **React 19** (`^19.2.1`) | shadcn/ui (new-york) on Radix; custom non-Radix `tabs.tsx` |
| Language | **TypeScript 5.9**, `strict`, `noEmit`, `@/* → src/*` | ESLint 9 **flat config** downgrades `no-explicit-any`/`ban-ts-comment` to warn |
| Build | `prisma generate && postgenerate && next build --webpack` | **Webpack, NOT Turbopack** (README is wrong); Node ≥24 |
| ORM | **Prisma 7** (`prisma-client` generator → `src/generated/client`, git-ignored) | client = `src/server/db.ts` singleton |
| DB | **Postgres** (Supabase-hosted) via **`@prisma/adapter-pg`** (pg driver adapter) + **pgvector** | NOT Accelerate (despite `/api/health` saying `provider:"accelerate"`) |
| Auth | **Auth.js / NextAuth v5**, **Google OAuth only**, JWT strategy, PrismaAdapter | `allowDangerousEmailAccountLinking:true` |
| AI | **Google Gemini** via **Vercel AI SDK v5** (`ai`, `@ai-sdk/google`, `@ai-sdk/rsc`, `@ai-sdk/react`) | default `flash` = **`gemini-3.5-flash`**; `pro`/`pro3` = **`gemini-3.1-pro-preview`** (preview → **auto-falls-back to stable `gemini-2.5-pro`** on a retirement 404, via `withRetirementFallback`); `flashLite` = **`gemini-3.1-flash-lite`** (stable). All set 2026-06-16, live-verified. |
| Background jobs | **Inngest** (served at `/api/inngest`) | compileCurriculum, processDocument, scanMessage |
| Storage | **Firebase Storage** (firebase-admin) for documents; **Supabase** JS SDK provisioned but **dead** | |
| Email | **Resend** (safety alerts only) | |
| Styling | **Tailwind CSS v4** (CSS-first, `@theme` tokens in `globals.css`; no `tailwind.config.js`) | qc-* design tokens |

**Data layer = Server Actions + REST route handlers.** There is **NO tRPC, NO
TanStack Query, NO Zustand, NO Redux**. State crosses the wire two ways only:
`"use server"` actions and `app/api/**/route.ts` handlers. Client URL/UI state uses
**nuqs** (`?studentId`, `?step`) and per-component `react-hook-form` + Zod. There is
**no test framework anywhere** and CI runs only `tsc --noEmit` + `eslint` (never
`next build`).

**Deployment:** Vercel by strong circumstantial evidence, but there is **no
`vercel.json`** in the repo — build/env/regions live in the Vercel dashboard.

---

## Subsystem map

Each row links a reference doc to its one-line role and primary routes/models.

| Doc | Subsystem | Primary routes / models |
|---|---|---|
| [01](01-build-config-infra.md) | **Build, config, tooling, infra** — npm scripts, TS/Next/ESLint/Prisma configs, CI, env surface, MCP | `/api/health`; `src/server/db.ts`; no models |
| [02](02-data-model.md) | **Data model** — `schema.prisma` (56 models, 18 enums) + 2-step migration set; pgvector; tenancy mapping | all models; `prisma/migrations/*` |
| [03](03-db-seeds-scripts.md) | **DB layer, seeds & ops scripts** — `db` singleton, 6 seeders, dead Supabase client, cache helper | global reference data (Subject/Objective/ResourceKind/Catechism/Commentary/Devotional/County) |
| [04](04-auth-tenancy-user.md) | **Auth, tenancy, middleware, user/account** — NextAuth v5 Google, `getCurrentUserOrg`, account lifecycle | `proxy.ts`; `User`/`Organization`/`Account`/`ClassroomInstructor` |
| [05](05-ai-core.md) | **AI core** — model registry, embedding, prompt builders, Zod output schemas, Inkling guardrails | `src/lib/ai/*`; no models |
| [06](06-context-engine.md) | **AI context engine** — `getMasterContext` + serializer + completeness/suggestions | `/context`, `/api/context/inspect`; `Resource.generationContext` |
| [07](07-academic-spine-curriculum-api.md) | **Academic spine & curriculum APIs** — global 5-level taxonomy, `/api/curriculum/*`, PHILOSOPHY_PROMPTS | `Subject>Strand>Topic>Subtopic>Objective`, `GradeBand`, `ResourceKind` |
| [08](08-generators-inkling-toolkit.md) | **Inkling Toolkit / Creation Station** — single-resource generation (2 parallel engines) | `/creation-station`, `/creation-station/[id]`; `Resource`, `ResourceKind` |
| [09](09-curriculum-compiler-studio26.md) | **Studio 26 curriculum compiler** — Inngest compile→verify→explode pipeline | `compile-curriculum.ts`; `CurriculumSpec`, `CurriculumBundle` |
| [10](10-courses-builder-blocks.md) | **Course builder, blocks, activities, assignments** — dnd-kit tree, REST+actions | `/courses/*`; `Course`, `CourseBlock`, `Activity`, `ResourceAssignment` |
| [11](11-planner-scheduling.md) | **Planner & scheduling** — `distributeCourse`, weekly grid, daily check-off | `/planner`, `/student/dashboard`; `StudentScheduleItem`, `CustomEvent` |
| [12](12-students-personality-assessment.md) | **Students & personality assessment** — CRUD, 3-step AI calibration wizard, avatars | `/students/*`; `Student`, `LearnerProfile`, `SafetyFlag` (rel only) |
| [13](13-onboarding-family-blueprint.md) | **Onboarding / Family Blueprint** — 3-step wizard, lazy Org creation | `/onboarding`, `/blueprint`; `Classroom`, `ClassroomInstructor`, `ClassroomHoliday` |
| [14](14-dashboards.md) | **Dashboards & home** — `/` router, Parent/Student dashboards, student switcher | `/`, `/student/dashboard`; read-only across models |
| [15](15-living-library-media.md) | **Living Library & media** — book/video/article/doc intake, embeddings, vector search | `/living-library/*`, `/api/library/*`; `Book`/`VideoResource`/`Article`/`DocumentResource` |
| [16](16-grading-assessment-attempts.md) | **Inkling Grading & attempts** — grade attempts + AI feedback (mostly half-built) | `/grading/*`, `/api/grading/[id]`; `Assessment*` models |
| [17](17-transcripts.md) | **Transcripts & PDF export** — GPA calc, single-JSON model, client-side PDF | `/transcripts/*`; `Transcript` (one `data` Json blob) |
| [18](18-discipleship-bible-catechism-commentary.md) | **Discipleship A** — ESV Bible, Matthew Henry commentary, catechisms, devotionals | `/family-discipleship/{bible-study,catechism,devotionals}`; `Catechism*`, `Commentary*`, `Devotional`, `StudentCatechismProgress` |
| [19](19-discipleship-prayer-missions-neighbor.md) | **Discipleship B** — Bible memory, prayer, church notes, heart-check, missions, neighbor | `/family-discipleship/{bible-memory,prayer,church,missions,neighbor}`; `BibleMemory`, `PrayerJournalEntry`, `LocalChurchNotes`, `County` |
| [20](20-thinkling-chat-safety.md) | **Thinkling chat & child-safety pipeline** — student AI chat + Inngest safety scan + Resend | `/thinkling`, `/api/chat`; `SafetyFlag` |
| [21](21-shell-navigation-ui-primitives.md) | **App shell, nav, UI primitives, utils** — layout, Sidebar, shadcn primitives, qc-* tokens | `app/layout.tsx`; no models |
| [90](90-addendum.md) | **Addendum** — coverage gaps (e.g. empty `src/types/index.ts` stub) | — |

---

## Data model overview

The relational layer is **56 Prisma models + 18 enums** (`prisma/schema.prisma`, see
`02-data-model.md`). Grouped by domain:

- **Tenancy & identity (6):** `Organization` (tenant root), `User`, `Account`/`Session`/`VerificationToken` (Auth.js adapter), `ClassroomInstructor`.
- **Classroom & schedule (5):** `Classroom`, `ClassroomHoliday`, `ClassroomStudent`, `StudentScheduleItem`, `CustomEvent`.
- **Academic Spine — global reference (7):** `Subject`→`Strand`→`Topic`→`Subtopic`→`Objective` (~26k rows), `GradeBand`, `ResourceKind`.
- **Students & profiling (3):** `Student`, `LearnerProfile`, `SafetyFlag`.
- **Courses & content (5):** `Course`, `CourseStudent`, `CourseBlock` (polymorphic hub), `Activity`, `ActivityObjective`.
- **Assessments (4):** `Assessment`, `AssessmentItem`, `AssessmentAttempt`, `AssessmentItemResponse`.
- **Progress (3):** `CourseProgress`, `ActivityProgress`, (assessment status).
- **Library & generated artifacts (7):** `Book`, `BookGeneratedMaterial`, `VideoResource`, `Article`, `DocumentResource`, `Resource`, `ResourceAssignment`.
- **Curriculum compiler (2):** `CurriculumSpec`, `CurriculumBundle`.
- **Transcript (1):** `Transcript` (entire structure in one `data` Json blob).
- **Family Discipleship — global content (8):** `Devotional`, `PrayerCategory`, `Catechism`, `CatechismQuestion`, `CommentaryChapter`, `CommentarySection`, `County`, `BibleMemoryFolder`.
- **Family Discipleship — user/student-scoped (6):** `GratitudeJournal`, `DevotionalReflection`, `LocalChurchNotes`, `PrayerJournalEntry`, `BibleMemory`, `StudentCatechismProgress`.

### Tenancy model — read this before writing any query or raw SQL

- **`Organization` == a family.** One `User` ↔ one `Organization` (`User.organizationId`, **nullable** — un-onboarded users exist).
- **`organizationId` in Prisma maps to the DB column `account_id`** on ~11 tenant tables (User, Classroom, Student, Course, Book, VideoResource, Resource, Article, DocumentResource, StudentScheduleItem, CustomEvent).
- **Two exceptions use `organization_id`:** `Transcript` (`schema.prisma:127`) and `CurriculumSpec` (`:769`). **This split is a silent-bug source in hand-written SQL.**
- The Auth.js **`accounts`** table is OAuth tokens — **unrelated** to `account_id`. In raw SQL, `account_id` means *organization*.
- **RLS is theater.** The baseline migration auto-enables RLS on every table, but the repo has **zero `CREATE POLICY`** statements and the app connects as the Supabase `postgres` superuser (BYPASSRLS). Tenant isolation is **100% application-level** `where: { organizationId }` filtering via `getCurrentUserOrg()`. A query that forgets the org filter leaks across tenants.

### Cascade blast-radius

- **Deleting an `Organization` is a full-tenant wipe** — cascades to all users, students, courses, books, resources, transcripts, then deeper.
- **RESTRICT/CASCADE asymmetry:** creator FKs (`created_by_user_id`, `added_by_user_id`, `assigned_by_user_id`) are `ON DELETE RESTRICT`, so user/org teardown is **order-sensitive** and the hand-rolled `deleteAccount` cascade (04) will drift as models are added.
- `CourseBlock` self-nests and carries six optional content FKs all `ON DELETE SET NULL`.
- `StudentCatechismProgress.catechism_id` stores the catechism **slug** (`Catechism.code`) with **no FK** — no referential integrity.

---

## Cross-cutting concerns

These threads run through nearly every subsystem; understand them once.

1. **Auth & tenancy gating.** Real protection is **per-page**, not middleware:
   `proxy.ts` only guards `/dashboard` and `/onboarding`, and **`/dashboard` does not
   exist** — so the proxy protects nothing meaningful. Each page/route/action must
   call `auth()` then `getCurrentUserOrg()` (`src/lib/auth-helpers.ts`, the canonical
   tenant gate used by 55+ files) and filter by `organizationId`. **A new page that
   forgets `auth()` is silently public.** The safe IDOR pattern is to **re-derive
   org/user from the session and ignore client-supplied ids** (see
   `generate-tool.tsx:47-49`).

2. **The AI context engine** (06). `getMasterContext(organizationId, studentId, ...)`
   assembles a structured "master context" (family, student, academic objective,
   library, schedule) from Prisma; `serializeMasterContext` flattens it into a
   token-budgeted prompt block (injecting `PHILOSOPHY_PROMPTS`). The serialized JSON is
   persisted on every generated `Resource.generationContext` as lineage. This is the
   single source of truth for what the AI "knows" before generating.

3. **AI generation paths** (05/08). Two parallel engines: **Path A** =
   `streamUI`/RSC (`generate-tool.tsx`) streaming React components; **Path B** =
   `generateObject`/`generateText` (`generate-resource-core.ts`) for QUIZ/WORKSHEET
   JSON and markdown. The compiler (09) reuses the session-less `generateResourceCore`
   primitive. Models: `pro`/`pro3` = `gemini-2.5-pro` (the `gemini-3-pro-preview` was
   retired ~2026-06; **all "Gemini 3 Pro" comments are doc-drift**), `flash`/`flashLite`
   for chat/feedback/safety, **`gemini-3-pro-image`** ("Nano Banana Pro", image generation via
   `generateText` + `responseModalities:["IMAGE"]`), embeddings `gemini-embedding-2` @ 1536 dims.

4. **The child-safety pipeline** (20). Every Thinkling user turn fires a background
   Inngest scan (`scanMessage`): regex fast-path → LLM deep-path → deterministic policy
   matrix → write `SafetyFlag` → pattern escalation → email caregivers via Resend (only
   for `PARENT_SUMMARY_*` resolutions). Core principle = **Minimum Social
   Responsibility**: if a caregiver is implicated or the child fears disclosure, no
   caregiver is notified. Detection **fails open** on LLM error, and no UI surfaces
   `SafetyFlag` to caregivers — email is the sole output.

5. **The `resource_kind` contract** (07/08/09). `ResourceKind` is a **global,
   non-tenant** generator catalog (`resource_kinds` table) seeded destructively from
   `GENERATOR_CONTENT_TYPES.YAML`. Its `code` (unique) is the join point that ties the
   generators, the Studio 26 compiler (six lowercase-underscore codes:
   `teacher_guide`, `student_packet`, `reading_anthology`, `graphic_organizers`,
   `slides`, `release_manifest`), and the seed slugify together. The compiler hardcodes
   these literals instead of importing `CURRICULUM_KIND_CODES` — bypassing the very
   drift guard that constant exists for.

---

## Key end-to-end flows

- **Family Blueprint onboarding** (13). `/onboarding` 3-step wizard (Classroom →
  Schedule → Environment) → per-step server actions in `blueprint.ts` re-derive
  org/user from session → first save **lazily creates** `Organization {PARENT_INSTRUCTOR}`
  + links `User` → persists everything onto **one `Classroom` row**. `/blueprint` is the
  read-only review. ⚠ Multi-instructor onboarding **crashes** on a unique-constraint
  violation; Step-2 schedule fields are partly dropped.

- **Single-resource generation** (08). Pick a source (book/video/course/topic/URL/file)
  + a `ResourceKind` template → `generateResource` (auth wrapper) → `generateResourceCore`
  → `buildMasterPrompt` → `generateObject` (QUIZ/WORKSHEET → JSON) or `generateText`
  (markdown) → persists an org-scoped `Resource` → viewed at `/living-library/resource/[id]`.

- **Studio 26 compile → explode** (09). A `CurriculumSpec` + empty `CurriculumBundle`
  shell is persisted → Inngest `curriculum/compile` event → durable 8-step function
  generates Teacher Guide / Student Packet / Slides / Reading Anthology / Graphic
  Organizers (each via `generateResourceCore`) → verification gate (SHA-256 + LLM QA,
  fault-tolerant) → Release Manifest → bundle `COMPLETED`/`FAILED`. `explode-bundle.ts`
  materializes a completed bundle into a `Course` UNIT/MODULE/LESSON block tree
  (idempotent via `sourceBundleId`).

- **Thinkling chat + safety** (20). Caregiver picks a student + mode (Tutor/Research/
  Career) → `POST /api/chat` (org-checked) → `streamText` with `models.flash` and a
  learner-profile-aware system prompt + hard-coded safeguarding charter → each user turn
  async-fires the safety scan above. Streaming is **not** safety-gated (the model answers
  live; flagging is after the fact).

- **Transcript export** (17). `/transcripts/[studentId]` builds a transcript seeded from
  `Student.courseEnrollments` → computes weighted/unweighted GPA under a selectable
  scale → stored as one `Transcript.data` Json blob → **client-side PDF** via popup +
  `window.print()` (no server PDF). All interpolated fields are HTML-escaped.

---

## Project status & risk concentration

Synthesizing risks across all docs into a prioritized list. **The platform is a broad,
impressively-wired skeleton with deep half-built seams and several real cross-tenant
leaks.** A lead should treat the following as the shortlist.

### P0 — Security (cross-tenant leaks / IDOR)
1. **`POST /api/context/inspect`** reads `organizationId` from the request body after only
   checking a session exists → any authed user reads any org's master context (06).
2. **`generateItemFeedback` / `generateOverallFeedback`** (grading actions) have **no auth
   check** and trust client-supplied org/student/course ids (16).
3. **`findSimilarBooks`** (Living Library "Similar Books" sidebar) runs raw cosine SQL with
   **no org filter** → leaks other orgs' book titles/summaries (15).
4. **`getCourseBooks`** lacks org filter + ownership check → enumerates other orgs' book
   titles/TOCs (07).
5. **`getSmartDefaults` course branch** and **`reorderBlocks`** are not properly org-scoped →
   potential cross-org reads/writes (06, 10).
6. **`exportUserData`** with a null org runs **unfiltered** Prisma queries across all tenants
   (04). **`deleteAccount`** has **no role guard** and is non-atomic — any member can destroy
   the whole org (04).
7. **`bible-memory/page.tsx`** uses `db.student.findFirst()` returning an arbitrary student
   from **any** organization "for demo purposes" (19).

### P1 — Half-built / non-functional features
- **Grading** (16): no assessment-authoring and no student-taking flow exist anywhere; the
  index is normally empty and the save endpoint is unvalidated/non-atomic.
- **Activity creation** (10): the form POSTs to a route that **does not exist** → every
  submission 404s.
- **Instructor PIN** (04): hashed and stored but **never verified** anywhere.
- **Book deep-extraction** (15): summary/ToC/EXTRACTED status is UI-only; nothing populates it.
- **Semantic search** (15): `/api/library/search` is built but **unwired** to any UI.
- **`deactivatedAt`** (04): set but never enforced — deactivation has no effect.
- **Signature capture** (17) and **transfer-ownership / reactivate** (04) are written but dead.
- **`ResourcePicker` mis-scoping** (10): `CourseBuilder` passes `courseId` where `organizationId`
  is expected → wrong/empty library lists.

### P2 — Correctness bugs
- **`getBibleText(string)`** called with a bare string against an object-schema → always throws,
  silently swallowed; Bible-memory auto-fetch text is always empty (18/19).
- **`distributeCourse`** hardcodes Mon–Fri (ignores `classroom.schoolDaysOfWeek`) and omits
  `revalidateTag` → wrong dates + up to 1h stale planner (11).
- **Prayer category / date / tags / privacy** never persisted via the live UI (19).
- **`saveTranscript`** upsert keyed on `'new'` can insert duplicates / lose edits (17).
- **`/auth/login`** redirect target does not exist (prayer page) (19).
- Two divergent quiz/worksheet JSON schemas both occupy `Resource.content` (05/08).

### P3 — Drift, dead code, infra hygiene
- Pervasive **doc-drift**: README/Turbopack, `provider:"accelerate"`, "Gemini 3 Pro" comments,
  "with caching" comments with no cache. (The embedding "1536-dim" drift is now real/resolved — see below.)
- **No `next build` in CI and no tests** — a webpack-only build break can reach prod (01).
- **Two conflicting Supabase MCP project_refs**; vestigial Stripe/Sentry env vars; tracked
  `tsconfig.tsbuildinfo`; ~19MB + 2,089-file unused `quill-standards` shadow; large dead-code
  nav surface (MainNav, ContextNav, CommandPalette → Ctrl/Cmd-K is dead) (01, 03, 21).
- `(db as any)` on all `StudentScheduleItem`/`CustomEvent` access — Prisma client out of sync (11).
- `ui/calendar.tsx` uses react-day-picker v8 API while v9 is installed — likely broken (21).

**Shippable today:** the academic spine, Living Library intake (books/videos/articles/docs),
single-resource generation, the Studio 26 compile→explode pipeline, Thinkling chat + safety
scan, the Family Blueprint (single-instructor), course building (minus Activities), planner
distribution (Mon–Fri only), transcripts, and most of the Family Discipleship suite.
**Not shippable without work:** grading, multi-instructor onboarding, activity creation,
book deep-extraction, semantic search UI, and anything blocked by the P0 leaks.

---

## Glossary / naming map

Brand/marketing names vs. what they're called in code:

| Brand / UI name | Code name / location | What it is |
|---|---|---|
| **Quill & Compass** | `QuillNext` (repo, layout metadata) | The product (brand drift: layout says "QuillNext") |
| **Inkling** | `INKLING_BASE_PERSONALITY`, "Inkling-Generated" | The AI persona/brand for generation & summaries |
| **Inkling Toolkit** | "Quick Create" / `/creation-station` | Single-resource AI generation (the name "Inkling Toolkit" never appears in code) |
| **Studio 26** | `compile-curriculum.ts`, `CurriculumSpec`/`Bundle` | The bulk curriculum **compiler** |
| **Thinkling** | `/thinkling`, `lib/thinkling.ts`, `/api/chat` | Student-facing AI **chat** (UI sometimes mislabels it "Inkling") |
| **Family Blueprint** | `blueprint.ts`, `/onboarding`, `/blueprint` | First-run **onboarding** + read-only review |
| **Living Library** | `/living-library`, `getLibraryResources` | Per-org content repository |
| **Inkling Grading** | `/grading`, `Assessment*` | Assessment grading product (largely half-built) |
| **Daily Liturgy** | hard-coded Psalm 23 stub in `ParentDashboard` | A static placeholder, not dynamic |
| **Organization** | `organizationId` → DB column **`account_id`** | A single **family** (tenant root) |

---

## How to navigate this map

Pick the doc that owns your task, then read its "Risks / drift" and "Cross-links" sections.

- **"How is the app built / why won't it build / env vars?"** → [01](01-build-config-infra.md).
- **"What's the schema / what cascades / what does `account_id` mean?"** → [02](02-data-model.md) (then [03](03-db-seeds-scripts.md) for seeds & the `db` singleton).
- **"How do auth & tenant isolation work? Why is my page public?"** → [04](04-auth-tenancy-user.md). The IDOR-safe pattern is there.
- **"How does the AI know things / how do I add a prompt?"** → [05](05-ai-core.md) (models, schemas, guardrails) + [06](06-context-engine.md) (master context).
- **"Where do objectives/subjects come from?"** → [07](07-academic-spine-curriculum-api.md).
- **"How is a resource generated?"** → [08](08-generators-inkling-toolkit.md) (single) or [09](09-curriculum-compiler-studio26.md) (bulk / Inngest).
- **"Courses, blocks, activities, assignments?"** → [10](10-courses-builder-blocks.md). **Scheduling?** → [11](11-planner-scheduling.md).
- **"Students, profiles, the assessment wizard, avatars?"** → [12](12-students-personality-assessment.md). **Onboarding?** → [13](13-onboarding-family-blueprint.md). **Dashboards/home?** → [14](14-dashboards.md).
- **"Books/videos/docs, embeddings, vector search?"** → [15](15-living-library-media.md).
- **"Grading?"** → [16](16-grading-assessment-attempts.md). **Transcripts/GPA/PDF?"** → [17](17-transcripts.md).
- **"Discipleship (Bible/catechism/commentary/devotionals)?"** → [18](18-discipleship-bible-catechism-commentary.md). **(Prayer/missions/memory/neighbor)?"** → [19](19-discipleship-prayer-missions-neighbor.md).
- **"Student chat & child safety?"** → [20](20-thinkling-chat-safety.md).
- **"Layout, nav, UI primitives, `cn`, design tokens, shared utils?"** → [21](21-shell-navigation-ui-primitives.md).
- **"A file none of the above seems to cover?"** → check the [90 addendum](90-addendum.md).

**Two rules for every change:** (1) every page/route/action must `auth()` + scope by
`organizationId` from the session — never trust client ids; (2) trust the code over any
prose doc in the repo.
