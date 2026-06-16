# 16 — Inkling Grading & Assessment Attempts

> Code-truth reference. Verified against source on 2026-06-15. The repo's prose/markdown
> docs are unreliable; everything below is cited to `file:line` against the actual code.

## Purpose & role in the app

This subsystem is the **teacher/parent-facing grading product**: a place to record that a
student "submitted" an assessment, then score each item and (optionally) generate
AI-personalised feedback, persisting a graded `AssessmentAttempt`.

The important structural truth: **the data model for assessments is fully designed
(`Assessment` / `AssessmentItem` / `AssessmentAttempt` / `AssessmentItemResponse` +
`GradingMethod` / `AttemptStatus` enums), but the product around it is only partially
built.** Specifically:

- There is **no UI/route/action anywhere in the codebase that creates `Assessment` or
  `AssessmentItem` rows** (verified by grep — see [Risks](#risks-drift-dead-code--half-built)).
  So in practice the grading index will usually show *no assessments to grade*.
- There is **no student-facing assessment-taking flow.** No code captures real student
  answers into `AssessmentItemResponse.responseData`. The only "creation" path
  (`createAssessmentAttempt`) seeds an attempt with **blank** responses (`responseData: {}`)
  purely so the existing grading screen becomes reachable. This is explicitly called out
  in the action's own docstring (`assessment-actions.ts:7-14`).
- The grading screen itself (score inputs + AI feedback + save) is built and works
  end-to-end **given** an attempt with items.

A naming trap to keep straight: the route `src/app/api/students/[id]/assessment/route.ts`
and `src/app/students/[id]/assessment/page.tsx` are **NOT** part of this gradeable-assessment
product. They are the **student personality/learning-style calibration wizard** that writes
`LearnerProfile`. They share the English word "assessment" only. They are documented here
(because this subsystem owns those file paths) but flagged as a different feature.

---

## File-by-file reference

### `src/app/grading/page.tsx` — Grading index (server component)

- **Role:** Landing page at `/grading`. Lists recent attempts and hosts the "record a
  submission" form.
- **Server/client:** Server component. `export const dynamic = "force-dynamic"` (`page.tsx:10`).
- **Auth/tenancy:** `auth()` → redirect `/login` if no user (`page.tsx:13-14`);
  `getCurrentUserOrg()` → redirect `/onboarding` if no org (`page.tsx:16-17`). All three
  queries are **org-scoped**: attempts via `assessment.course.organizationId`
  (`page.tsx:21`), assessments via `course.organizationId` (`page.tsx:34`), students via
  `organizationId` (`page.tsx:39`).
- **Prisma models touched (read):** `AssessmentAttempt` (take 100, newest first),
  `Assessment`, `Student` (`page.tsx:19-43`).
- **Key behaviour:** Builds `<option>` lists for the form; renders each attempt with status
  and `scorePoints/maxPoints`, linking to `/grading/[id]` with label "Grade" or "Review"
  depending on `status === "GRADED"` (`page.tsx:99-101`).
- **Notes:** Empty-state copy tells users to "Record a submission above". The `graded`
  display guard requires both `status === "GRADED"` **and** `scorePoints != null`
  (`page.tsx:82`).

### `src/app/grading/[id]/page.tsx` — Grading detail (server component)

- **Role:** Loads a single attempt with everything needed to grade it; renders the
  `GradingInterface` plus a context sidebar.
- **Server/client:** Server component (no `dynamic` export here; relies on `await params`).
- **Auth/tenancy:** `auth()` → `/login` (`[id]/page.tsx:18-22`); `getCurrentUserOrg()` →
  `/grading` if no org (`[id]/page.tsx:24-27`). **Tenancy is enforced after the fetch**: the
  attempt is loaded by id, then redirected to `/grading` unless
  `attempt.assessment.course.organizationId === organizationId` (`[id]/page.tsx:63-65`).
- **Prisma models touched (read):** `AssessmentAttempt` with deep include →
  `assessment` (→ `course` → `subject`, `strand`; → `items` ordered by `position`),
  `student` (→ `learnerProfile`), `itemResponses` (→ `item`, ordered by item position)
  (`[id]/page.tsx:29-61`). Result is cast to `any` (`[id]/page.tsx:61`).
- **External calls:** `getMasterContext({ organizationId, studentId, courseId })`
  (`[id]/page.tsx:68-72`) then `serializeMasterContext(..., { includeDetails, maxTokens:
  2000, prioritize: ["student","academic","family"] })` (`[id]/page.tsx:74-78`) to render a
  read-only "Inkling Context" preview in the sidebar.
- **Notes:** Reads `student.learnerProfile.personalityData` (`[id]/page.tsx:81`) to render a
  "Student Context" card and to pass `personalityData` into the interface. Sidebar only
  shows the personality card when `personalityData` is truthy.

### `src/app/api/grading/[id]/route.ts` — Save-grades REST endpoint (POST)

- **Role:** Persists grading results for an attempt. Called by `GradingInterface.handleSave`.
- **Server/client:** Route handler. `export const dynamic = "force-dynamic"` (`route.ts:1`).
- **Auth/tenancy:** `auth()` → 401 if no user (`route.ts:13-16`). `getCurrentUserOrg()`
  destructures `{ userId, organizationId }` (`route.ts:18`). Tenancy enforced by loading the
  attempt + its `assessment.course` and rejecting with 404 unless
  `attempt.assessment.course.organizationId === organizationId` (`route.ts:21-34`).
- **Prisma writes:** Updates `AssessmentAttempt` — `scorePoints`, `maxPoints`, `feedback`,
  `gradingMethod` (defaults `"AI_ASSISTED"`), `graderUserId = userId`, `status = "GRADED"`,
  `completedAt = now` (`route.ts:37-48`). Then, if `data.itemScores` present, loops each
  `[itemId, score]`, finds the matching `AssessmentItemResponse` by `(attemptId, itemId)`,
  and updates `pointsEarned`, `feedback` (from `data.itemFeedback[itemId]`), `gradedAt`
  (`route.ts:51-71`).
- **Notes / bugs:**
  - **No Zod / input validation.** `scorePoints`, `maxPoints` etc. are taken straight from
    the JSON body (`route.ts:40-42`). A caller could post arbitrary numbers (e.g. score >
    max); the client UI clamps per-item but the API does not.
  - **N+1 writes:** per-item find-then-update in a loop, not a transaction
    (`route.ts:52-70`). Not atomic — a mid-loop failure leaves a partially-graded attempt.
  - **`isCorrect` is never set** on item responses despite existing in the model.
  - **`letterGrade` is never written** despite existing on `AssessmentAttempt`.

### `src/app/api/students/[id]/assessment/route.ts` — Learner-profile wizard endpoint (POST) — DIFFERENT FEATURE

- **Role (actual):** Generates and saves a student's **personality / learning-style /
  interests profile** (`LearnerProfile`). This is the calibration wizard, **not** the
  gradeable-assessment product. Owned here only by file path.
- **Server/client:** Route handler (no `dynamic` export).
- **Auth/tenancy:** `auth()` → 401 (`route.ts:17-20`). Loads `Student` by id, 404 if
  missing (`route.ts:30-36`), then `getCurrentUserOrg()` and 404 unless
  `student.organizationId === organizationId` (`route.ts:39-42`). Good multi-tenant guard.
- **External AI:** Dispatches on `body.step` to `generateStudentProfile`,
  `generateLearningStyleProfile`, or `generateInterestProfile` from
  `@/server/ai/personality` (`route.ts:7-11`, `49-66`).
- **Prisma writes:** `learnerProfile.upsert({ where: { studentId } })` writing
  `personalityData` / `learningStyleData` / `interestsData` plus `completedAt`
  (`route.ts:68-77`).
- **Notes:** Console-logs each step (`route.ts:27`, `50`, `55`, `60`, `69`). Returns 400 for
  unknown step (`route.ts:64-65`). Caller is `AssessmentWizard.tsx` (see cross-links).

### `src/app/actions/grading-actions.ts` — AI feedback server actions

- **Role:** Two `"use server"` actions that produce personalised feedback text via the AI
  SDK. Used by `GradingInterface`.
- **`generateItemFeedback({ organizationId, studentId, courseId, questionText,
  responseContent })`** (`grading-actions.ts:24-58`): builds a master prompt via
  `buildMasterPrompt(...)` with the question + (string-or-JSON-stringified) response, then
  `generateText({ model: models.flash, prompt })`. Returns `{ text }`. Throws
  `"Failed to generate feedback"` on error (`grading-actions.ts:54-57`).
- **`generateOverallFeedback({ organizationId, studentId, courseId, assessmentTitle,
  totalScore, maxScore })`** (`grading-actions.ts:60-98`): computes percentage, builds a
  master prompt, same `generateText` call, returns `{ text }`.
- **Auth/tenancy:** **None directly.** These actions do **not** call `auth()` or
  `getCurrentUserOrg()` — they trust the `organizationId`/`studentId`/`courseId` passed by
  the client. See [Auth/security posture](#auth--security-posture).
- **External deps:** `generateText` from `ai` (Vercel AI SDK), `models.flash`
  (`gemini-2.5-flash`) from `@/lib/ai/config`, `buildMasterPrompt` from
  `@/lib/utils/prompt-builder`.

### `src/app/actions/assessment-actions.ts` — `createAssessmentAttempt` server action

- **Role:** The minimal "make a gradeable attempt exist" path. Seeds an attempt as
  `SUBMITTED` with one **blank** response per item so `/grading/[id]` is reachable. Its
  docstring explicitly states the full student-facing taking flow is "a separate, larger
  feature" (`assessment-actions.ts:7-14`).
- **Signature:** `createAssessmentAttempt(assessmentId, studentId)` → `{ success, attemptId }`.
- **Auth/tenancy:** `getCurrentUserOrg()` (throws if unauthenticated) +
  `if (!organizationId) throw` (`assessment-actions.ts:16-17`). Verifies the assessment's
  `course.organizationId === organizationId` (`:20-29`) **and** the student's
  `organizationId === organizationId` (`:31-35`). Both throw `"Unauthorized"`. Solid tenancy.
- **Prisma writes:** `assessmentAttempt.create` with `status: "SUBMITTED"`, `submittedAt:
  now`, `maxPoints: assessment.totalPoints ?? undefined`, and nested
  `itemResponses.create` mapping each item to `{ itemId, responseData: {}, pointsPossible:
  item.points }` (`assessment-actions.ts:37-52`). Then `revalidatePath("/grading")`.
- **Notes:** Does not set `startedAt` (DB default `now()` applies) or `graderUserId`. The
  blank `responseData: {}` is what later renders as `{}` in the grading UI's
  "Student Response" box.

### `src/components/grading/GradingInterface.tsx` — Grading UI (client component)

- **Role:** The interactive grading form. Per-item score inputs, per-item + overall AI
  feedback generation, and Save.
- **Server/client:** `"use client"` (`GradingInterface.tsx:1`).
- **Props:** `{ attempt: any, personalityData: any, organizationId: string }` — all typed
  `any` (`:10-14`).
- **State:** `scores` (itemId→number), `feedback` (itemId→string), per-item generating flag,
  `overallFeedback`, plus loading booleans (`:21-26`).
- **Score handling:** `handleScoreChange` clamps to the item's `points` max via
  `Math.min` (`:28-32`).
- **AI feedback:** `handleGenerateFeedback` calls `generateItemFeedback(...)` (passes
  `item.questionText` + `response.responseData`) (`:34-57`); `handleGenerateOverallFeedback`
  sums `scores` and item `points` and calls `generateOverallFeedback(...)` (`:59-84`).
- **Save:** `handleSave` POSTs to `/api/grading/${attempt.id}` with `scorePoints`
  (sum of `scores`), `maxPoints` (sum of item points), `feedback: overallFeedback`,
  `itemScores`, `itemFeedback`, `gradingMethod: "AI_ASSISTED"` (`:86-122`), then
  `alert(...)` + `window.location.reload()`.
- **Notes / UX issues:**
  - **Error handling via `alert()`** and a full-page `window.location.reload()` after save
    (`:114-115`) — no toast, no optimistic update (contrast with `NewAttemptForm` which uses
    `sonner`).
  - **Total max is computed two different ways** in this file: from item `points`
    (`:63-66`, `:91-94`) — it ignores `attempt.assessment.totalPoints` and the
    `pointsPossible` stored on responses.
  - Blank `responseData: {}` from `createAssessmentAttempt` renders as the literal string
    `{}` in the response box (`:157-160`) — graders see no real student work.
  - `gradingMethod` is hardcoded `"AI_ASSISTED"` regardless of whether AI was used.

### `src/components/grading/NewAttemptForm.tsx` — record-a-submission form (client component)

- **Role:** Two `<select>`s (assessment, student) + button that calls
  `createAssessmentAttempt` then routes to `/grading/[attemptId]`.
- **Server/client:** `"use client"` (`NewAttemptForm.tsx:1`).
- **Props:** `{ assessments: Option[], students: Option[] }` where `Option = { id, label }`.
- **Behaviour:** Early-returns guidance text if either list is empty — notably "No
  assessments yet — create one from a course's Assessments page first."
  (`:20-28`) — **but that Assessments page does not exist** (see Risks). Uses
  `useTransition` + `sonner` toasts; on success `router.push("/grading/" + attemptId)`
  (`:30-46`).
- **Notes:** Plain native `<select>` (not the design-system Select). Validation only checks
  both ids are chosen (`:31-34`).

---

## Data models & tenancy

All in `prisma/schema.prisma`. None of these models carry `organizationId` directly —
**tenancy is always derived through `Assessment.course.organizationId`** (Course is the
org-scoped anchor).

### `Assessment` (`schema.prisma:590-611`, table `assessments`)
`id`, `courseId`, `scopeKind: AssessmentScopeKind`, `courseBlockId?` (mapped
`scope_block_id`), `assessmentType: AssessmentType`, `title`, `description?`,
`totalPoints: Decimal?`, `timeLimitMinutes: Int?`, `createdByUserId`, timestamps.
Relations: `attempts[]`, `items[]`, `course` (cascade delete), `createdByUser`,
`courseBlock?`, `resourceAssignments[]`.

### `AssessmentItem` (`schema.prisma:613-628`, table `assessment_items`)
`id`, `assessmentId`, `itemType: AssessmentItemType`, `questionText`, `questionData: Json?`,
`correctAnswer: Json?`, `points: Decimal`, `position: Int`, timestamps. Relations:
`responses[]`, `assessment` (cascade).

### `AssessmentAttempt` (`schema.prisma:849-873`, table `assessment_attempts`)
`id`, `assessmentId`, `studentId`, `status: AttemptStatus`, `startedAt` (default now),
`submittedAt?`, `completedAt?`, `scorePoints: Decimal?`, `maxPoints: Decimal?`,
`letterGrade: String?`, `graderUserId?`, `gradingMethod: GradingMethod?`, `feedback?`,
timestamps. Relations: `assessment` (cascade), `graderUser?` (`"GradedAttempts"`),
`student` (cascade), `itemResponses[]`. Indexed on `assessmentId`, `studentId`.

### `AssessmentItemResponse` (`schema.prisma:875-893`, table `assessment_item_responses`)
`id`, `attemptId`, `itemId`, `responseData: Json` (**required**), `pointsEarned: Decimal?`,
`pointsPossible: Decimal` (**required**), `isCorrect: Boolean?`, `feedback?`, `gradedAt?`,
timestamps. Relations: `attempt` (cascade), `item` (cascade). `@@unique([attemptId, itemId])`,
indexed on `itemId`.

### Enums
- `AssessmentScopeKind` (`:1005-1012`): `LESSON, UNIT, MODULE, SECTION, CHAPTER, COURSE`.
- `AssessmentType` (`:1014-1018`): `QUIZ, TEST, FINAL_EXAM`.
- `AssessmentItemType` (`:1020-1027`): `MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER, ESSAY,
  MATCHING, FILL_IN_BLANK`.
- `AttemptStatus` (`:1068-1073`): `IN_PROGRESS, SUBMITTED, GRADED, ABANDONED`.
- `GradingMethod` (`:1075-1079`): `AUTO, AI_ASSISTED, MANUAL`.

**Field usage reality:** Most of the model is unused by the current code. Never written by
this subsystem: `letterGrade`, `isCorrect`, `Assessment.timeLimitMinutes`,
`AssessmentItem.correctAnswer`, `questionData`. `AttemptStatus` values `IN_PROGRESS` and
`ABANDONED` are never produced; `GradingMethod` `AUTO`/`MANUAL` are never produced (always
`"AI_ASSISTED"`).

---

## Entry points & end-to-end flows

### Discoverability (entry point gap)
`/grading` is **not linked from any navigation, sidebar, or menu** — grep finds zero
`href="/grading"` references in nav/layout components; the only links are internal
self-references and a one-line changelog mention (`src/app/changelog/page.tsx:57`). The
route is reachable only by typing the URL. (Recent commit `8ef568a` "make grading reachable"
added the index page and minimal submit but did not wire it into nav.)

### Flow A — Record & grade (the working path)
1. Teacher opens `/grading` (`grading/page.tsx`) → server loads attempts/assessments/students,
   org-scoped.
2. In `NewAttemptForm`, picks an assessment + student → `createAssessmentAttempt`
   (`assessment-actions.ts`) → validates org for both → creates `AssessmentAttempt
   (SUBMITTED)` + one blank `AssessmentItemResponse` per item → returns `attemptId`.
3. Client routes to `/grading/[id]` (`grading/[id]/page.tsx`) → loads attempt deep-include,
   tenancy-checked → fetches + serialises master context for the sidebar.
4. `GradingInterface`: per item, teacher enters a score (clamped to item points) and/or
   clicks "Generate Inkling Feedback" → `generateItemFeedback` server action → AI SDK
   (`gemini-2.5-flash`) → text into state. Optionally "Generate Overall Feedback" →
   `generateOverallFeedback`.
5. "Save Grades" → `POST /api/grading/[id]` (`api/grading/[id]/route.ts`) → updates attempt
   to `GRADED` (sets `scorePoints/maxPoints/feedback/gradingMethod/graderUserId/completedAt`)
   and each item response's `pointsEarned/feedback/gradedAt` → client `alert` + reload.

**Critical caveat:** Step 1 presupposes `Assessment` + `AssessmentItem` rows exist. **No
code path in the repo creates them**, so on a real database the assessment `<select>` is
typically empty and `NewAttemptForm` shows the "create one from a course's Assessments page
first" message — pointing at a page that doesn't exist.

### Flow B — Learner-profile wizard (the look-alike, different feature)
`/students/[id]/assessment` → `DynamicAssessmentWizard` (the `AssessmentWizard` source in
this subsystem's scope) → on each step `POST /api/students/[id]/assessment` →
`generate*Profile` AI → upsert `LearnerProfile`. This produces the `personalityData` that
Flow A's grading sidebar later reads. It does **not** touch any `Assessment*` table.

### Downstream consumption
`getMasterContext` counts `assessmentAttempts` with `status: "GRADED"` as
`completedAssessments` in the student academic summary
(`src/lib/context/master-context.ts:411-417`, `545`). So graded attempts feed back into
Inkling's master context.

---

## External dependencies & services

- **Vercel AI SDK (`ai`)** — `generateText` in `grading-actions.ts`.
- **Google Gemini via `@ai-sdk/google`** — `models.flash` = `gemini-2.5-flash`
  (`src/lib/ai/config.ts:12`). API key shimmed from `GEMINI_API_KEY` →
  `GOOGLE_GENERATIVE_AI_API_KEY` (`config.ts:3-6`). The personality route additionally uses
  `@/server/ai/personality` generators.
- **Prisma 7 / Postgres** — `@/server/db` (`db`).
- **NextAuth** — `@/auth` (`auth()`), via `@/lib/auth-helpers` (`getCurrentUserOrg`).
- **Context engine** — `getMasterContext` + `serializeMasterContext` (`@/lib/context/*`),
  `buildMasterPrompt` (`@/lib/utils/prompt-builder`).
- **UI** — design-system primitives (`@/components/ui/*`), `sonner` toasts (NewAttemptForm),
  `next/navigation`.

---

## Auth / security posture

- **Pages & REST routes are properly auth+tenant guarded.** `/grading`,
  `/grading/[id]`, `POST /api/grading/[id]`, `POST /api/students/[id]/assessment`, and
  `createAssessmentAttempt` all authenticate and scope to the caller's org (the grading ones
  via `Assessment.course.organizationId`, the personality one via `Student.organizationId`).
- **`grading-actions.ts` (`generateItemFeedback` / `generateOverallFeedback`) have NO auth
  check.** They are server actions that trust client-supplied `organizationId`, `studentId`,
  `courseId` and feed them into `buildMasterPrompt` (which pulls org/student/course context).
  Since Next server actions are publicly invokable endpoints, an authenticated user from org
  A could pass org B's ids and exfiltrate B's context into generated feedback. **This is a
  cross-tenant IDOR / context-leak risk.** (Severity depends on what `buildMasterPrompt`
  returns, but the actions themselves perform no `getCurrentUserOrg` comparison.)
- **`POST /api/grading/[id]` lacks input validation** (no Zod): scores/maxPoints are written
  verbatim; nothing enforces `scorePoints <= maxPoints` or non-negative values server-side.
- **`organizationId` null not handled in the REST route**: `getCurrentUserOrg()` can return
  `organizationId: null`; the comparison at `route.ts:32` would then never match (safe-ish:
  yields 404), but it's relying on incidental behaviour rather than an explicit guard.
- Per-item grading writes are **not transactional** (`route.ts:52-70`).

---

## Risks, drift, dead-code & half-built

1. **No assessment authoring exists.** Grep across the repo finds **zero** `Assessment` /
   `AssessmentItem` create calls. The grading product cannot be populated through the app;
   the "create one from a course's Assessments page first" hint
   (`NewAttemptForm.tsx:23`) refers to a non-existent page. This is the headline gap.
2. **No student-facing assessment-taking flow.** `responseData` is always `{}`
   (`assessment-actions.ts:48`); graders see literal `{}` as the "student response"
   (`GradingInterface.tsx:157-160`). The data model supports real responses; the capture UI
   was never built. Acknowledged in code (`assessment-actions.ts:7-14`).
3. **Cross-tenant risk in AI feedback actions** (see Auth posture) — `generateItemFeedback` /
   `generateOverallFeedback` don't verify the passed ids belong to the caller's org.
4. **Not in navigation** — `/grading` is URL-only; effectively hidden from users.
5. **`max points` computed three inconsistent ways**: server seed uses
   `assessment.totalPoints` (`assessment-actions.ts:43`); `GradingInterface` sums item
   `points` (`GradingInterface.tsx:63-66`, `91-94`); responses store `pointsPossible`. If
   `totalPoints` ≠ sum(item.points), the index and detail screens disagree.
6. **Unused model fields** (silent drift between schema ambition and behaviour):
   `letterGrade`, `isCorrect`, `correctAnswer`, `questionData`, `timeLimitMinutes` are never
   read/written. `AttemptStatus.IN_PROGRESS/ABANDONED` and `GradingMethod.AUTO/MANUAL` are
   never produced. `gradingMethod` is hardcoded `"AI_ASSISTED"` even for purely manual
   scoring (`route.ts:43`, `GradingInterface.tsx:106`).
7. **Non-atomic, N+1 save loop** in the REST route (`route.ts:52-70`) — partial-grade risk.
8. **No input validation** on the save endpoint (no Zod, no score-bounds check).
9. **Heavy `any` typing** — `GradingInterface` props, the deep attempt query cast to `any`
   (`[id]/page.tsx:61`), `personalityData as any`. No compile-time safety over the attempt
   shape.
10. **UX inconsistency** — `GradingInterface` uses `alert()` + `window.location.reload()`
    while the rest of the subsystem uses `sonner` toasts + `router` navigation.
11. **Naming collision** — `students/[id]/assessment` (personality wizard) vs the gradeable
    `Assessment` model. Easy to conflate; they are unrelated features.

---

## Cross-links to other subsystems

- **Auth & tenancy (`04-auth-tenancy-user`)** — `getCurrentUserOrg` (`@/lib/auth-helpers`)
  and `auth()` (`@/auth`) gate every page/route here.
- **Context engine (`06-context-engine`)** — `getMasterContext` + `serializeMasterContext`
  power the grading sidebar; `buildMasterPrompt` feeds the AI feedback actions.
  `master-context.ts:411-417,545` counts GRADED attempts as `completedAssessments`.
- **AI core (`05-ai-core`)** — `models.flash` / `@/lib/ai/config`, Vercel AI SDK
  `generateText`. The personality route uses `@/server/ai/personality`.
- **Data model (`02-data-model`)** — all five `Assessment*` models + their enums live in
  `prisma/schema.prisma`; tenancy anchored on `Course`.
- **Courses / builder / blocks (`10-courses-builder-blocks`)** — `Assessment` belongs to a
  `Course` (and optional `CourseBlock` via `scopeKind`/`courseBlockId`). This is where an
  authoring UI *would* live but currently does not.
- **Account lifecycle (`account-actions`)** — org/account deletion cascades through
  `AssessmentItemResponse` → `AssessmentAttempt` → `AssessmentItem` → `Assessment`
  (`account-actions.ts:53,82-92`).
- **Students / LearnerProfile** — the personality wizard (`AssessmentWizard` →
  `/api/students/[id]/assessment`) writes `LearnerProfile.personalityData`, consumed by the
  grading detail sidebar.
- **Transcript / GPA** — the `grading` hits in `src/components/transcript/*` are a separate
  "grading scale / GPA" concept, **not** this attempts subsystem.

---

## Open questions

1. Where is the intended **assessment authoring** flow (create `Assessment`/`AssessmentItem`)?
   Is it planned under a course's pages, or abandoned? Nothing implements it today.
2. Is the **student-facing taking flow** on the roadmap, and what is the contract for
   `responseData` JSON per `AssessmentItemType` (so grading can render real answers)?
3. Should `generateItemFeedback` / `generateOverallFeedback` enforce org ownership of the
   passed ids? (Recommended — current code does not.)
4. Should grading be **transactional** and **validated** server-side (score bounds,
   `scorePoints <= maxPoints`)?
5. Is `letterGrade` meant to be derived/stored at grade time (it never is today)?
6. Which is the source of truth for max points — `Assessment.totalPoints`, sum of item
   `points`, or response `pointsPossible`? They can diverge.
7. Should `/grading` be added to primary navigation, or is it intentionally
   internal/unfinished?
