# 18 — Grading & Assessment Runtime
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|------|------|
| `src/app/grading/page.tsx` | Grading index (server component): lists last 100 attempts org-wide + hosts the "record a submission" form. |
| `src/app/grading/[id]/page.tsx` | Single-attempt grading page (server component): loads attempt + Inkling master-context + personality sidebar. |
| `src/app/api/grading/[id]/route.ts` | POST endpoint that persists scores/feedback and marks the attempt `GRADED`. |
| `src/app/actions/grading-actions.ts` | Server actions `generateItemFeedback` / `generateOverallFeedback` (AI-assisted feedback via Gemini flash). |
| `src/components/grading/GradingInterface.tsx` | Client grader UI: per-item score inputs, AI feedback buttons, save (calls the API route). |
| `src/components/grading/NewAttemptForm.tsx` | Client form: pick assessment + student, calls `createAssessmentAttempt` (defined in 16-), routes to `/grading/[id]`. |

Assessment **creation** (`createAssessmentAttempt`, `assessment-actions.ts`) lives in chapter 16 — see 16-. This chapter is the **runtime** (taking-to-grade-to-persist). Data model for `AssessmentAttempt` / `AssessmentItemResponse` / `GradingMethod` is in 02-.

## 2. Purpose / intent
The grading runtime lets an instructor turn an assessment + student into a gradeable "attempt", then score each item, optionally generate personalized (Inkling/AI) feedback, and persist a final grade. It is the human-in-the-loop scoring surface that sits downstream of assessment authoring (16-). There is no real student-facing assessment-taking flow yet: attempts are seeded blank by `createAssessmentAttempt` (assessment-actions.ts:10-13 comment), so "taking" is a stub and the runtime is effectively a manual/AI-assisted grading console.

## 3. Architecture & key files
- **Index** (`grading/page.tsx`): `force-dynamic` server component. Auth gate → `getCurrentUserOrg()` → three parallel `withTenant` reads (attempts, assessments, learners), all with explicit `{ organizationId, userId: null }` ctx and `course.organizationId` / `learner.organizationId` predicates (page.tsx:20-43). Renders `NewAttemptForm` + an attempt list with Grade/Review links.
- **Attempt page** (`grading/[id]/page.tsx`): loads one attempt via `withTenant` `findUnique` with deep includes (assessment→course→subject/strand, items, student→learnerProfile, itemResponses→item) (page.tsx:29-66), then post-filters `course.organizationId !== organizationId` → redirect (page.tsx:68-70). Pulls `getMasterContext` + `serializeMasterContext` for the Inkling sidebar (page.tsx:73-83) and `learnerProfile.personalityData` for the personality card (page.tsx:86). Hands `attempt` (typed `any`) to `GradingInterface`.
- **Grader UI** (`GradingInterface.tsx`): client component. Local state for per-item `scores`/`feedback`, overall feedback, and loading flags. `handleScoreChange` clamps to item points (line 26-30). `handleGenerateFeedback`/`handleGenerateOverallFeedback` call the server actions. `handleSave` POSTs aggregated payload to `/api/grading/[id]` then `window.location.reload()` (line 82-118).
- **Persistence** (`api/grading/[id]/route.ts`): POST. Auth + org check, fetches attempt with `db` (raw, non-tenant), verifies `course.organizationId === organizationId` (line 32), updates the attempt (`scorePoints`, `maxPoints`, `feedback`, `gradingMethod` default `AI_ASSISTED`, `graderUserId`, `status=GRADED`, `completedAt`) and loops item scores into `AssessmentItemResponse` rows (line 51-71).
- **AI feedback** (`grading-actions.ts`): both actions call `assertStudentInOrg(studentId)` (derives org from session, verifies learner ∈ org — line 30-39), build a master prompt via `buildMasterPrompt`, and call `generateText({ model: models.flash })`. Return `{ text }`.

`GradingMethod` enum = `AUTO | AI_ASSISTED | MANUAL` (schema.prisma:1343-1346). AUTO/MANUAL are never written by this runtime — only `AI_ASSISTED` is ever sent (GradingInterface.tsx:102) or defaulted (route.ts:43). No auto-grading code path exists.

## 4. Data flow
1. **Create attempt**: `NewAttemptForm.onCreate` → `createAssessmentAttempt(assessmentId, studentId)` (NewAttemptForm.tsx:37, defined assessment-actions.ts:15) → seeds attempt `status=SUBMITTED` + blank `itemResponses` (assessment-actions.ts:37-52) → `router.push('/grading/'+attemptId)` (NewAttemptForm.tsx:40).
2. **Open attempt**: `grading/[id]/page.tsx:29` loads attempt → renders `GradingInterface` (page.tsx:113) + context sidebar.
3. **AI feedback (optional)**: `GradingInterface.handleGenerateFeedback` (line 32) → `generateItemFeedback` (grading-actions.ts:41) → `buildMasterPrompt` + `generateText(models.flash)` → text into local state. Overall variant: line 56 → `generateOverallFeedback` (grading-actions.ts:77).
4. **Save**: `handleSave` (GradingInterface.tsx:82) sums `scores` + item `points` → `fetch POST /api/grading/[id]` (line 93). Route updates attempt → `GRADED` + writes per-item `pointsEarned`/`feedback`/`gradedAt` (route.ts:37-71) → `{ success: true }` → client `alert` + reload (line 110-111).

## 5. Status table

| Unit | Status | Evidence |
|------|--------|----------|
| `grading/page.tsx` (index list) | DONE | Tenant-scoped reads + render, live at `/grading` (page.tsx:19-109). |
| `grading/[id]/page.tsx` (attempt view) | DONE | Loads + renders, org post-check (page.tsx:29-70). |
| `api/grading/[id]/route.ts` POST | PARTIAL | Works but no input validation, sequential N+1 item updates, raw `db` (route.ts:19,37-71). |
| `generateItemFeedback` | DONE | Wired from GradingInterface.tsx:40; org-asserted (grading-actions.ts:41-75). |
| `generateOverallFeedback` | DONE | Wired from GradingInterface.tsx:65 (grading-actions.ts:77-115). |
| `GradingInterface` | PARTIAL | Functional; `alert()`+`reload()` UX, scores not reset/seeded from saved state on first paint via `??` only (GradingInterface.tsx:133, 110-111). |
| `NewAttemptForm` | DONE | Wired into index page; creates + navigates (NewAttemptForm.tsx:14-76). |
| AUTO grading path | DEAD/absent | `GradingMethod.AUTO` defined (schema.prisma:1344) but never written/computed anywhere in this runtime. |
| MANUAL grading path | PARTIAL | Enum value exists (schema.prisma:1346) but UI/API never send `MANUAL`; all grades labeled `AI_ASSISTED` even when scored by hand (GradingInterface.tsx:102). |

## 6. Integration points
- **Imports in**: `auth` (`@/auth`), `getCurrentUserOrg` (`@/lib/auth-helpers`), `withTenant`/`db` (`@/server/db`), `getMasterContext` (`@/lib/context/master-context`), `serializeMasterContext` (`@/lib/context/context-serializer`), `buildMasterPrompt` (`@/lib/utils/prompt-builder`), `models` (`@/lib/ai/config`), `generateText` (`ai`), `createAssessmentAttempt` (`@/app/actions/assessment-actions` — 16-), UI primitives (`@/components/ui/*`), `toast` (`sonner`).
- **Importers out**: `GradingInterface` ← `grading/[id]/page.tsx:9`; `NewAttemptForm` ← `grading/page.tsx:8`; grading actions ← `GradingInterface.tsx:8`. No other consumers (Grep-confirmed).
- **Prisma models**: `AssessmentAttempt` (schema.prisma:1084-1108), `AssessmentItemResponse` (1110-1128), `Assessment`, `AssessmentItem`, `Course`, `Learner`, `LearnerProfile`. Enums `AttemptStatus` (schema.prisma:1336-1341), `GradingMethod` (1343-1346).
- **External APIs**: Vercel AI SDK `generateText` → `models.flash` (Gemini flash).
- **Inngest jobs**: none.
- **Env vars**: none directly (inherits `RLS_ENABLED` semantics via `@/server/db`; OFF per anchor → `db` is raw `base`, db.ts:114).
- **Routes**: page `/grading`, `/grading/[id]`; API `POST /api/grading/[id]`.

## 7. Findings

Q-18-001  [HIGH]  Grading API POST has zero input validation (trusts client-supplied scores/method) — `src/app/api/grading/[id]/route.ts:19,37-48`
  Evidence: `const data = await request.json();` then `scorePoints: data.scorePoints, maxPoints: data.maxPoints, feedback: data.feedback, gradingMethod: data.gradingMethod || "AI_ASSISTED"` written straight to DB. No Zod, no numeric/type coercion, no bound check that item scores ≤ item points, no clamp on `scorePoints`. `gradingMethod` accepts any string (Prisma enum will reject invalid, but negative/absurd score values pass).
  Impact: A caller can persist arbitrary/garbage grades (negative points, score > max, mismatched feedback). The only client-side clamp (GradingInterface.tsx:29) is trivially bypassable since the route is a public POST.
  Status: documented (not fixed)

Q-18-002  [MED]  Grading API uses raw `db` (non-tenant) and authorizes solely via a manual org check — `src/app/api/grading/[id]/route.ts:6,21-34,37,53-61`
  Evidence: imports `{ db }` (raw `base` client, db.ts:114 with RLS OFF), not `withTenant`. Tenant safety rests entirely on the single `attempt.assessment.course.organizationId !== organizationId` guard (line 32). The subsequent `update` and item `findFirst`/`update` (line 37-71) carry no `organizationId` predicate — they trust that the earlier guard ran. Also note `getCurrentUserOrg()` result is destructured but `organizationId` is never null-checked before the comparison (line 18,32) — if `organizationId` is undefined and an attempt's course org is also somehow null the compare could behave unexpectedly (defense-in-depth).
  Impact: Correct today because the guard precedes the writes, but it is the sole tenant boundary (RLS inert). Any refactor that reorders or early-returns differently risks a cross-tenant write. Pattern inconsistent with the tenant-scoped `withTenant` reads on the page components.
  Status: documented (not fixed)

Q-18-003  [MED]  Per-item grade persistence is an unbounded N+1 sequential loop — `src/app/api/grading/[id]/route.ts:51-71`
  Evidence: `for (const [itemId, score] of Object.entries(data.itemScores))` runs a `findFirst` then `update` per item, awaited serially, with no transaction. The attempt header `update` (line 37) is also outside any transaction with the item updates.
  Impact: Slow for assessments with many items; a mid-loop failure leaves the attempt `GRADED` with only partially-updated item responses (no atomicity). Could use `updateMany`/`@@unique([attemptId,itemId])` (schema.prisma:1125) for a single keyed write.
  Status: documented (not fixed)

Q-18-004  [LOW]  All grades recorded as `AI_ASSISTED`; MANUAL/AUTO methods unreachable — `src/components/grading/GradingInterface.tsx:102`, `src/app/api/grading/[id]/route.ts:43`, `prisma/schema.prisma:1343-1346`
  Evidence: client always sends `gradingMethod: "AI_ASSISTED"`; route defaults to `AI_ASSISTED`. No code path sets `MANUAL` (even for hand-typed scores with no AI) or `AUTO`.
  Impact: `gradingMethod` analytics/audit are misleading — manually graded attempts are mislabeled as AI-assisted; AUTO grading is undelivered despite the enum value.
  Status: documented (not fixed)

Q-18-005  [LOW]  Attempt list and item-response persistence ignore the `letterGrade` field and never recompute `isCorrect` — `src/app/api/grading/[id]/route.ts:37-71`, `prisma/schema.prisma:1094,1117`
  Evidence: `AssessmentAttempt.letterGrade` and `AssessmentItemResponse.isCorrect` exist in schema but the grading runtime writes neither. Item update writes `pointsEarned`/`feedback`/`gradedAt` only.
  Impact: Schema↔code drift; transcripts/reporting that expect `letterGrade` or `isCorrect` will see nulls from this flow.
  Status: documented (not fixed)

Q-18-006  [LOW]  No student-facing assessment-taking flow; attempts are seeded blank — `src/app/actions/assessment-actions.ts:10-13,44-50`
  Evidence: `createAssessmentAttempt` doc comment explicitly says a real response-capturing flow "is a separate, larger feature" and seeds `responseData: {}` per item. GradingInterface renders `JSON.stringify(response.responseData)` (GradingInterface.tsx:153-155), which shows `{}` for these blank seeds.
  Impact: The grader scores empty responses; the "runtime" is effectively a manual-entry console, not a graded submission pipeline. Expected gap, recorded for completeness.
  Status: documented (not fixed)

Q-18-007  [LOW]  Save UX uses blocking `alert()` + full `window.location.reload()` — `src/components/grading/GradingInterface.tsx:110-111,113`
  Evidence: on success `alert("Grades saved successfully!"); window.location.reload();`; failures also use `alert(...)` (lines 49,75,113).
  Impact: Coarse UX, loses unsaved per-item feedback state on reload, inconsistent with the app's `sonner` toast pattern used in NewAttemptForm.tsx. Not a correctness bug.
  Status: documented (not fixed)
