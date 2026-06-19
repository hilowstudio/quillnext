# 17 — Courses, Blocks, Activities, Blueprint & Onboarding
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|---|---|
| `src/app/courses/page.tsx` | Courses index (server). Lists org's courses via cached `withTenant` query. |
| `src/app/courses/new/page.tsx` | Client form to create a course; POSTs `/api/courses`. |
| `src/app/courses/[id]/page.tsx` | Thin redirect → `/courses/[id]/builder`. |
| `src/app/courses/[id]/builder/page.tsx` | Course builder page (server). Loads course+blocks+context, renders `CourseBuilder`/`CourseDistributor`. |
| `src/app/courses/[id]/blocks/new/page.tsx` | Client form to create a CourseBlock (UNIT/MODULE/SECTION/CHAPTER/LESSON). |
| `src/app/courses/[id]/blocks/[blockId]/page.tsx` | Client form to edit/delete a block; lists activities + child blocks. |
| `src/app/courses/[id]/blocks/[blockId]/activities/new/page.tsx` | Client form to add an Activity to a LESSON. POSTs to a **non-existent** endpoint. |
| `src/app/api/courses/route.ts` | POST create course (+ inline create of new Subject/Strand). |
| `src/app/api/courses/[id]/route.ts` | GET single course (org-checked). |
| `src/app/api/courses/[id]/blocks/route.ts` | GET list / POST create blocks (+ inline create of Topic/Subtopic). |
| `src/app/api/courses/[id]/blocks/[blockId]/route.ts` | GET / PATCH / DELETE single block. |
| `src/app/actions/course-actions.ts` | Server actions: `reorderBlocks`, `deleteBlock`, `updateBlock`, `deleteCourse`. |
| `src/app/actions/assignments.ts` | Server action `assignResourceToStudent` (enroll in course or assign resource). |
| `src/components/courses/CourseBuilder.tsx` | DnD block tree, resource attach/detach, generator + compiler dialogs. |
| `src/components/courses/CourseDistributor.tsx` | Dialog to schedule (distribute) a course to a student. |
| `src/components/courses/ResourcePicker.tsx` | Tabbed picker (books/videos/articles/docs/resources/bundles/generate). |
| `src/app/blueprint/page.tsx` | Family Blueprint dashboard (server): classroom/schedule summary + completeness score. |
| `src/server/actions/blueprint.ts` | Onboarding step persistence + **Organization creation** + owner profile upsert. |
| `src/lib/utils/course-pacing.ts` | Pacing math + auto-fill scheduler. **No importers (DEAD).** |
| `src/lib/schemas/courses.ts` | `courseBlockSchema` (Zod). |
| `src/app/onboarding/page.tsx` | Onboarding entry (server): loads progress, renders wizard. |
| `src/components/onboarding/onboarding-wizard.tsx` | 3-step wizard shell with URL `step` state. |
| `src/components/onboarding/classroom-step.tsx` | Step 1 form: classroom, instructors, PIN, philosophy, faith, goals. |
| `src/components/onboarding/schedule-step.tsx` | Step 2 form: school year, off-days calendar, school days, daily times, breaks. |
| `src/components/onboarding/environment-step.tsx` | Step 3 form: preferences/resources/goals/devices/challenges. |
| `src/lib/schemas/onboarding.ts` | Zod schemas for the wizard (instructor/classroom/schedule/environment). |
| `src/lib/constants/educational-philosophies.ts` | `PHILOSOPHY_PROMPTS` — pedagogy text injected into AI context. |

## 2. Purpose / intent
Two product surfaces converge here. (1) **Onboarding/Blueprint**: the first-run wizard that creates the family's `Organization`, `Classroom`, instructors, schedule and environment preferences — this is the foundation of the "Master Context" that personalizes all AI generation (see 09-context-engine). (2) **Courses**: a hierarchical course builder where a parent assembles `CourseBlock`s (UNIT→MODULE→SECTION→CHAPTER→LESSON), attaches library resources/generated content to blocks, links blocks to the Academic Spine (Topic/Subtopic/Objective — see 07/02), enrolls students, and "distributes" the course (auto-schedules lessons). The Blueprint page is a read-only dashboard summarizing the same data plus a context-completeness scorecard.

## 3. Architecture & key files
- **Course read path** is server-rendered and tenant-gated: `courses/page.tsx` and `builder/page.tsx` both call `auth()` → `getCurrentUserOrg()` → redirect if no org, then query through `withTenant(...)` with an explicit `organizationId` predicate AND a post-fetch `course.organizationId !== organizationId` re-check (builder/page.tsx:77).
- **Course write path** is split between REST routes (`/api/courses*`) used by the client forms, and server actions (`course-actions.ts`) used by `CourseBuilder`'s optimistic DnD/inline-edit. The REST routes use raw `db` (no `withTenant`) but every handler re-checks `course.organizationId === organizationId`. The actions use `withTenant` and fold ownership reads + writes into one tx (course-actions.ts:40-79) — these were clearly hardened (inline security comments).
- **Block hierarchy** is a self-referential `CourseBlock` tree (`parentBlockId`, `position`, `kind`) with polymorphic content pointers (`bookId`/`videoId`/`articleId`/`documentId`/`resourceId`/`topicId`/`subtopicId`/`bookChapterId`) — the model lives in 02-data-model. Parent-kind legality is enforced client-side only (`getAvailableParentBlocks`, blocks/new/page.tsx:189-214); the API only checks same-course membership + self-parent (blocks/[blockId]/route.ts:122-141), not kind nesting rules.
- **CourseBuilder** (787 lines) is the centerpiece: `@dnd-kit` flat sortable list (no real drag-to-nest — depth is purely visual via `marginLeft`, line 100 + comments 412-416), optimistic state, `ResourcePicker` for attach, a generator `Dialog` (`GeneratorForm`), and a compiler `Dialog` (`SpecForm` → `compileCurriculumAction`). "Inkling Assist" dynamically imports `suggestCourseBlocks`; bundle selection dynamically imports `explodeCurriculumBundle`.
- **Onboarding** is a 3-step wizard (`classroom-step`, `schedule-step`, `environment-step`) driven by `onboarding-wizard.tsx`; each step is a self-contained RHF+Zod form that calls its own server action in `blueprint.ts`. Step 1 (`saveClassroomStep`) is where the `Organization` is born and the user is linked to it.
- **Pacing**: `course-pacing.ts` is a standalone math utility (week iteration, holiday exclusion, objective distribution). It is **not wired anywhere** (§5).

## 4. Data flow
**Create course (form → REST → DB):** `new/page.tsx:78` POSTs `{title,description,subjectId,strandId,gradeBandId}` → `api/courses/route.ts:8` POST: `auth` (9) → `getCurrentUserOrg` (14) → if `subjectId` starts `new:` create a global `Subject` (35), same for `Strand` (59) → `db.course.create` stamping `organizationId`+`createdByUserId` (92-107) → returns `{course}` → client routes to `/courses/{id}/builder` (new/page.tsx:95).

**Builder render:** `builder/page.tsx:22-32` auth+org gate → `withTenant` `course.findUnique` with deep include of blocks→activities→objectives + students (67-75) → org re-check (77) → `getMasterContext` (82) + `analyzeContextCompleteness` (94) + relevant books (`withTenant`, 99) + `availableTools` (`db.resourceKind.findMany`, context-free, 136) → renders `CourseBuilder` (206) and `CourseDistributor` (319).

**Reorder (DnD → action):** `CourseBuilder.handleDragEnd` (422) → `saveOrder` builds `{id,position,parentBlockId}[]` → `reorderBlocks(courseId, updates)` (course-actions.ts:19): `ReorderSchema.parse` (34) → single `withTenant` tx: verify course ownership (42), load own block ids, reject foreign block/parent ids (60-67), `updateMany` scoped by `{id, courseId}` (71) → `revalidatePath`.

**Create block:** `blocks/new/page.tsx:160` POSTs to `/api/courses/[id]/blocks` → route POST (blocks/route.ts:70): org-check course (86-92) → `courseBlockSchema.parse` (95) → optional parent same-course check (98) → inline create Topic/Subtopic if `new:` (115/147) → `db.courseBlock.create` (191).

**Add activity:** `activities/new/page.tsx:86` POSTs to `/api/courses/{id}/blocks/{blockId}/activities` — **this route does not exist** (verified: no file under `api/courses/[id]/blocks/[blockId]/activities/`). The submit always fails with the generic alert (line 103).

**Onboarding step 1:** `classroom-step.tsx:87` fetches `/api/auth/user-org` then calls `saveClassroomStep(organizationId, userId, data)` (98) → `blueprint.ts:28`: **ignores caller args**, re-derives identity from `getCurrentUserOrg()` (34-36) → `withTenant` tx: if no org, `tx.organization.create` (54) + link user (63), re-stamp GUC (73), upsert classroom + instructors + owner PARENT profile (157) → returns. Steps 2/3 (`saveScheduleStep`/`saveEnvironmentStep`) similarly re-derive org from session and update the classroom.

**Distribute course:** `CourseDistributor.handleDistribute` (33) → `distributeCourse(courseId, studentId, startDate)` in `server/actions/scheduling.ts` (out of chapter scope — see scheduling chapter).

## 5. Status table

| Unit | Status | Evidence |
|---|---|---|
| `courses/page.tsx` index | DONE | cached org-scoped `withTenant` query, take:100 (page.tsx:60-78,104). |
| `courses/new` form | PARTIAL | works; submit gated on `title`+`subject`+`strand` (new/page.tsx:200) yet API treats `strandId` as optional/nullable (route.ts:54,97) — UI↔API requiredness drift; `bookId` prefill is a TODO no-op (new/page.tsx:49-52). |
| `courses/[id]` redirect | DONE | redirects to builder ([id]/page.tsx:9). |
| `builder/page.tsx` | DONE | full auth+org gate, deep include, re-check (builder/page.tsx:29-79). |
| `blocks/new` form | PARTIAL | client-only kind-nesting rules; sends `bookId/bookChapterId` via `@ts-ignore` (blocks/new/page.tsx:168-170); custom Topic/Subtopic creation explicitly stripped to undefined (166-167). |
| `blocks/[blockId]` edit/delete | DONE | PATCH/DELETE wired with org checks; child-block delete guard (page.tsx:188-191). |
| `activities/new` page | STUB/BROKEN | POSTs to missing route `…/activities` (activities/new/page.tsx:86); edit page calls activities "(coming soon)" (blocks/[blockId]/page.tsx:443,456). |
| `POST /api/courses` | PARTIAL | org-checked, but no Zod validation, no `assertParentProfile`, creates global Subject/Strand (route.ts:21,35,59). |
| `GET /api/courses/[id]` | DONE | org re-check (route.ts:32). |
| `GET/POST /api/courses/[id]/blocks` | DONE | Zod-validated, org-checked (blocks/route.ts:90,95). |
| `GET/PATCH/DELETE …/blocks/[blockId]` | DONE | org+course checks; DELETE gated by `assertParentProfile` (route.ts:216). |
| `reorderBlocks` | DONE | hardened tx + foreign-id rejection (course-actions.ts:40-79). |
| `deleteBlock`/`updateBlock`/`deleteCourse` | DONE | `withTenant`, org check; delete/deleteCourse gated by `assertParentProfile` (course-actions.ts:91,183). |
| `assignResourceToStudent` | DONE | org-checks student+course+resource (assignments.ts:13,18,41); used by `AssignResourceDialog`. |
| `CourseBuilder` | PARTIAL | DnD is flat-only (no nesting); bundle add does `window.location.reload()` (CourseBuilder.tsx:698); passes `courseId` as `organizationId` to ResourcePicker (683). |
| `CourseDistributor` | DONE | wired to `distributeCourse` (CourseDistributor.tsx:41). |
| `ResourcePicker` | PARTIAL | functional, but library lists empty when given a courseId as orgId (see Q-17-002). |
| `blueprint/page.tsx` | DONE | renders progress + completeness; 4 org-scoped counts via `withTenant` (blueprint/page.tsx:36-46). |
| `saveClassroomStep` | DONE | creates Organization + classroom + owner profile (blueprint.ts:28). |
| `saveScheduleStep` | DONE | updates classroom + holidays (blueprint.ts:182). |
| `saveEnvironmentStep` | DONE | stores `environmentPreferences` JSON (blueprint.ts:274,310). |
| `getBlueprintProgress` | PARTIAL | returns step 2/3; comments claim "Step 3 removed / only 2 steps" but wizard still renders 3 (blueprint.ts:357-359 vs onboarding-wizard.tsx:34-38). |
| `course-pacing.ts` (all exports) | DEAD | zero importers repo-wide (Grep `course-pacing` → no files). |
| `courseBlockSchema` | DONE | imported by blocks pages + routes. |
| onboarding wizard + 3 steps | DONE | wired in `onboarding-wizard.tsx`; each step → blueprint action. |
| `onboarding.ts` schemas | DONE | consumed by steps + blueprint actions. |
| `PHILOSOPHY_PROMPTS` | DONE | consumed by `context-serializer.ts:107`, `prompt-builder.ts:68`, `generate-resource-core.ts:5`. |

## 6. Integration points
- **Imports in (cross-chapter):** `@/auth`, `@/lib/auth-helpers#getCurrentUserOrg` (04-security), `@/server/db#{db,withTenant}` (04), `@/server/profiles/guards#assertParentProfile` + `ids#parentProfileId` (profiles), `@/server/rls-context#setRlsContext` (04), `@/lib/context/{master-context,context-serializer,context-suggestions}` (09), `@/lib/schemas/{actions,pin}`, `@/app/actions/{curriculum-actions,course-resource-actions,suggest-blocks,explode-bundle,compile-curriculum-action,resource-library-actions}` (08/09/curriculum), `@/components/generators/GeneratorForm` (08), `@/app/creation-station/compiler/SpecForm` (compiler), `@/server/actions/scheduling#distributeCourse` (scheduling), `@/lib/utils/holidays#isHoliday`.
- **Importers out:** `CourseBuilder`/`CourseDistributor` ← builder page; `ResourcePicker` ← CourseBuilder; onboarding steps ← `onboarding-wizard` ← `onboarding/page.tsx`; `PHILOSOPHY_PROMPTS` ← AI/context layer; `assignResourceToStudent` ← `AssignResourceDialog`; blueprint actions ← onboarding steps + `onboarding/page.tsx` + `blueprint/page.tsx`.
- **External APIs / fetches:** client steps GET `/api/auth/user-org`; new-course/new-block GET `/api/curriculum/{subjects,grade-bands,strands,topics,subtopics,resource-kinds}`; ResourcePicker GET `/api/curriculum/resource-kinds`.
- **Prisma models used:** `Course`, `CourseBlock`, `CourseStudent`, `Activity` (read-only), `Subject`, `Strand`, `Topic`, `Subtopic`, `Objective`, `GradeBand`, `ResourceKind`, `Book`, `Organization`, `Classroom`, `ClassroomInstructor`, `ClassroomHoliday`, `Profile`, `User`, `Learner`, `Resource`, `ResourceAssignment`. (Subject/Strand/Topic/Subtopic/Objective/GradeBand/ResourceKind are CONTEXT_FREE per db.ts:39 — raw `db` use for them is intentional.)
- **Inngest jobs:** none directly here (compilation is delegated via `compileCurriculumAction`).
- **Env vars:** none read directly in these files.

## 7. Findings

Q-17-001  [HIGH]  Activity creation page POSTs to a nonexistent API route — feature dead  — `src/app/courses/[id]/blocks/[blockId]/activities/new/page.tsx:86`
  Evidence: `fetch(`/api/courses/${courseId}/blocks/${blockId}/activities`, {method:"POST"})`. No route file exists under `api/courses/[id]/blocks/[blockId]/activities/` (Glob returned nothing). The block-edit page also labels activities "(coming soon)" (blocks/[blockId]/page.tsx:443).
  Impact: Adding an activity always throws "Failed to create activity" (line 97-103). Entire Activity authoring flow is broken/unfinished.
  Status: documented (not fixed)

Q-17-002  [MED]  CourseBuilder passes `courseId` where `organizationId` is expected → empty ResourcePicker  — `src/components/courses/CourseBuilder.tsx:683`
  Evidence: `<ResourcePicker organizationId={courseId} … />` with an inline comment admitting "Using courseId as orgId proxy for now". `ResourcePicker` forwards it to `getLibraryResources(organizationId)` which runs `tx.book.findMany({ where:{ organizationId } })` (resource-library-actions.ts:13,23) — a course id never matches an org id, so all library tabs return zero rows.
  Impact: The in-builder "Add to Course" picker shows empty Books/Videos/Articles/Documents/Resources/Bundles lists; only the "Generate New" tab works. Not a tenancy leak (RLS off but it under-fetches, not over-fetches), purely a functional bug.
  Status: documented (not fixed)

Q-17-003  [MED]  `POST /api/courses` lacks input validation and parent-profile gate; mints global taxonomy from unauthenticated-content input  — `src/app/api/courses/route.ts:21,35,59,99`
  Evidence: Handler reads `data.title`/`data.description` with no Zod schema (line 99 — only `subjectId` presence is checked). Any string prefixed `new:` causes creation of a globally-shared `Subject`/`Strand` (35,59) visible to ALL orgs (these are CONTEXT_FREE). No `assertParentProfile()` (contrast block DELETE + `deleteCourse` which do gate).
  Impact: A student-role session (or any member) can create courses and pollute the global curriculum taxonomy with arbitrary names; missing length/type validation can store empty/oversized titles.
  Status: documented (not fixed)

Q-17-004  [MED]  Course REST routes use raw `db` (no `withTenant`) — app-layer org check is the ONLY boundary  — `src/app/api/courses/[id]/route.ts:23`, `…/blocks/route.ts:24,32`, `…/blocks/[blockId]/route.ts:25,34`
  Evidence: All GET/POST/PATCH/DELETE course/block handlers query via `db.course.findUnique(...)` without a tenant-stamped tx, relying on a follow-up `course.organizationId !== organizationId` comparison. RLS is OFF (db.ts), so if any handler ever omits that comparison the row is fully exposed. The block GET (blocks/route.ts:32) returns blocks by `courseId` only — safe solely because the preceding course org-check (28) acts as the gate.
  Impact: Correct today, but brittle: the tenant boundary is a manual `if` in each handler rather than a query-level predicate. Server actions in the same feature were migrated to `withTenant`; the REST routes were not.
  Status: documented (not fixed)

Q-17-005  [LOW]  `course-pacing.ts` is dead code  — `src/lib/utils/course-pacing.ts:36,83,153`
  Evidence: Grep for `course-pacing` across the repo returns no importing file; `calculateCoursePacing`, `calculatePacingFromSchedule`, and `autoFillCourseSchedule` are referenced only within the file itself.
  Impact: ~190 lines of unused pacing logic (including an org-scoped `withTenant` classroom read and a raw `db.objective` query) that drifts from the live distribution path in `scheduling.ts`. Maintenance/confusion risk.
  Status: documented (not fixed)

Q-17-006  [LOW]  Block kind-nesting rules enforced only client-side  — `src/app/courses/[id]/blocks/new/page.tsx:189-214`, `…/blocks/[blockId]/route.ts:122-141`
  Evidence: `getAvailableParentBlocks` restricts legal parents by kind in the browser, but the POST/PATCH API only validates same-course membership and self-parent — it never checks that a LESSON's parent is not, say, another LESSON, or that a UNIT has no parent.
  Impact: A crafted request can build an illegal/cyclic-by-kind hierarchy (e.g., UNIT under LESSON), which downstream tree rendering/pacing may not expect.
  Status: documented (not fixed)

Q-17-007  [LOW]  Onboarding wizard/step drift: code says "Step 3 removed" but Environment step still renders  — `src/server/actions/blueprint.ts:357-359`, `src/components/onboarding/onboarding-wizard.tsx:34-38`
  Evidence: `getBlueprintProgress` returns `step: hasSchedule ? 3 : 2` with comment "3 means Done … we only have 2 steps", and "Step 3 removed from wizard" (onboarding.ts:108). Yet `onboarding-wizard.tsx` still lists 3 steps including `EnvironmentStep`, which is fully wired to `saveEnvironmentStep`. So a returning user with a schedule is sent to "step 3" = the Environment form, contradicting the "Done" semantics.
  Impact: Confusing/contradictory flow control; "Complete Setup" semantics and the redirect target depend on a step count the comments claim no longer exists. Pure inconsistency, not a security issue.
  Status: documented (not fixed)

Q-17-008  [INFO]  ✅ RESOLVED 2026-06-19 — dropped dead organizationId/userId params from all 3 blueprint step actions + removed the /api/auth/user-org fetches in their callers (see CHANGELOG.md). `saveClassroomStep` signature takes `organizationId`/`userId` but ignores them  — `src/server/actions/blueprint.ts:28-36`
  Evidence: Params `(organizationId, userId, data)` are immediately overwritten from `getCurrentUserOrg()` (34-36). Callers (classroom-step.tsx:98) still fetch `/api/auth/user-org` and pass values that are discarded.
  Impact: Correct/safe (identity is session-derived, not caller-trusted) but the dead params + extra client fetch are misleading and waste a round-trip. Good defensive posture worth keeping; signature should be cleaned.
  Status: documented (not fixed)

Q-17-009  [INFO]  ✅ RESOLVED 2026-06-19 — removed `as any` in assignments.ts (consistent scalar create) (see CHANGELOG.md). `assignments.ts` writes via raw `db` (no `withTenant`)  — `src/app/actions/assignments.ts:3,43`
  Evidence: `assignResourceToStudent` imports raw `db` and creates `CourseStudent`/`ResourceAssignment` after explicit org checks on student/course/resource. No tenant-stamped tx; `ResourceAssignment.create` uses `as any` (line 50).
  Impact: Same brittleness as Q-17-004 (manual org checks are the only boundary, RLS off). The `as any` masks schema typing for the assignment write.
  Status: documented (not fixed)
