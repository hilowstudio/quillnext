# 09 — Master Context Engine
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|------|------|
| `src/lib/context/master-context.ts` | Hub. Aggregates family/classroom + student profile + academic spine + library media + schedule into one `MasterContext` object. 5 sub-fetchers + `getMasterContext` orchestrator. |
| `src/lib/context/context-types.ts` | `ContextSuggestion` interface + `getContextImpactDescription()` per-pillar copy. |
| `src/lib/context/context-serializer.ts` | Converts `MasterContext` → prompt string (sectioned, prioritized, token-budgeted truncation). Injects philosophy mental-model prompts. |
| `src/lib/context/context-suggestions.ts` | `analyzeContextCompleteness()` — scores 5 pillars 0–100% and emits actionable `ContextSuggestion[]`. |
| `src/lib/context/smart-defaults.ts` | `getSmartDefaults()` — auto-suggests studentId/objectives from course enrollment. |
| `src/app/context/page.tsx` | Server page `/context` — Context Inspector dashboard. |
| `src/app/api/context/inspect/route.ts` | `POST /api/context/inspect` — returns raw `MasterContext` JSON for the session org. |
| `src/components/context/ContextBadges.tsx` | Inline pills ("Personalized for…", "Aligned to…", "Using…"). |
| `src/components/context/ContextCompleteness.tsx` | Gauge + 5-pillar checklist card (consumes suggestions). |
| `src/components/context/ContextInspector.tsx` | **DEAD** standalone manual inspector (free-form orgId input). |
| `src/components/context/ContextInspectorClient.tsx` | Tabbed inspector (Preview/Raw JSON/Structured) + export buttons. |
| `src/components/context/ContextLineageDisplay.tsx` | "Generated with: …" lineage chips + collapsible full-context. |
| `src/components/context/ContextPreview.tsx` | **DEAD** generic expandable `<pre>` context card. |
| `src/components/context/ContextSuggestionsInline.tsx` | High-priority suggestions callout (creation-station). |
| `src/components/context/SmartDefaultsSuggestions.tsx` | "Quick Suggestions" buttons linking with prefilled studentId/objectiveId. |
| `src/app/students/[id]/_components/AIContextPreview.tsx` | Student-page serialized-context `<pre>` + download. |
| `src/app/students/[id]/_components/PersonalizationContextCard.tsx` | Student-scoped 4-item completeness card (profile/learningStyle/courses/books). Renamed 2026-06-19 from `ContextCompleteness` to resolve the name collision with the org-level component (Q-09-007). |

## 2. Purpose / intent
The Master Context Engine is the single aggregation layer that gathers everything QuillNext knows about a teaching situation — the family's educational philosophy and faith background, the individual student's personality/learning-style/interests profile, the targeted academic objective and its full subject→strand→topic→subtopic path, the org's relevant library media (books/videos/resources), and the school-year schedule — and packages it as both a typed object (`MasterContext`) and a serialized prompt string. That string is the personalization payload fed into every AI generator (see 08-ai-core, 10-curriculum-compiler/generators). A secondary purpose is operator transparency: the `/context` inspector page lets a parent see exactly what context an AI call will receive, scored for completeness with concrete "fix this" calls-to-action.

## 3. Architecture & key files

**Hub — `getMasterContext(params)`** (`master-context.ts:215`). Takes `MasterContextParams` (`organizationId` required; optional `studentId`/`objectiveId`/`courseId` + unused `courseBlockId`/`bookId`/`videoId`/`articleId`/`documentId`, master-context.ts:9). Runs family + schedule in parallel via `Promise.all` with `.catch(() => null)` (optional), then student (throws if studentId given), academic (throws if objectiveId given), library (catch→null). Returns `{family, student, academic, library, schedule, metadata}` where `metadata.contextCompleteness` is a per-section boolean map and `generatedAt` is a timestamp (master-context.ts:242-258).

**Five sub-fetchers** (all in master-context.ts):
- `getFamilyContext(orgId)` (264) — org→newest classroom (`take:1`, `orderBy createdAt desc`), instructors, holidays, and `environmentPreferences` JSON cast to `environment`.
- `getStudentContext(studentId, orgId)` (365) — learner + `learnerProfile` (personality/learningStyle/interests JSON), enrollments, completed `activityProgress`/`assessmentAttempts` counts, `courseProgress[0]`, plus a separate objective query and a book-ids query.
- `getAcademicContext(objectiveId)` (578) — objective + full hierarchy; builds `fullPath` = `subject > strand > topic > subtopic`.
- `getLibraryContext(orgId, objectiveId?, courseId?)` (676) — relevant books (by objective's subject/strand, else course's), videos (org-wide EXTRACTED), course resources.
- `getScheduleContext(orgId)` (885) — newest classroom calendar; computes `currentWeek`/`totalWeeks` from today vs school-year dates.

**Context shape** — the interfaces (`FamilyContext`, `StudentContext`, `AcademicContext`, `LibraryContext`, `ScheduleContext`, `MasterContext`) are all declared in master-context.ts:21-205 and re-imported by the serializer.

**Serializer — `serializeMasterContext(context, options)`** (`context-serializer.ts:30`). Iterates `prioritize` order (default `[academic, student, family, library, schedule]`), appends per-section blocks, joins with `\n\n`. If `estimateTokenCount` (chars/4, line 323) exceeds `maxTokens` (default 2000), calls `truncateContext` which re-parses lines into sections by heuristic string-match (`getSectionType`, line 412), sorts by priority, and keeps high-priority sections within budget. Family serializer injects `PHILOSOPHY_PROMPTS[philosophy]` mental-model text (line 106-109).

**Completeness/suggestions — `analyzeContextCompleteness(orgId, opts)`** (`context-suggestions.ts:11`). 5-point score (family/student/academic/library/schedule), each present = +1; emits typed `ContextSuggestion`s with `actionUrl`/`actionLabel`/`priority`, sorted high→low. Returns `{completeness: 0-100, suggestions}`.

**Smart defaults — `getSmartDefaults(orgId, courseId?)`** (`smart-defaults.ts:6`). If courseId: org-scoped course lookup, auto-pick lone enrolled student, fetch ≤10 objectives. Else: if exactly 1 learner in org, suggest it.

**Entry points**: server page `/context` (page.tsx) renders `ContextCompleteness` + `ContextInspectorClient`; `POST /api/context/inspect` returns raw JSON. The engine is consumed for AI by `src/lib/utils/prompt-builder.ts:275`, `src/app/actions/generate-tool.tsx:53`, `src/app/actions/suggest-blocks.ts:54`, and rendered as previews on blueprint/students/courses-builder/grading pages.

## 4. Data flow

**AI generation path (the real consumer):** generator action → `prompt-builder.ts:275 getMasterContext(contextParams)` → `serializeMasterContext` (line 278) → wrapped into the "You are an expert educator…" template (prompt-builder.ts:286-301) → handed to the AI SDK (see 08-ai-core). Same pattern in `generate-tool.tsx:53` and `suggest-blocks.ts:54`.

**Inspector page flow:** `/context` request → `page.tsx:18 auth()` (redirect /login if no user) → `page.tsx:27 getCurrentUserOrg()` (redirect /onboarding if no org) → `getMasterContext({organizationId, studentId, objectiveId, courseId})` (33) → `analyzeContextCompleteness` (41) → `serializeMasterContext({maxTokens:10000})` (48) → renders `ContextCompleteness` (66) + `ContextInspectorClient` (69).

**Inspect API flow:** `route.ts:9 auth()` → 401 if no user → `route.ts:17 getCurrentUserOrg(session)` → 403 if no org → body parsed, only string-narrowed ids passed (`str()`, line 25) → `getMasterContext` (27) → JSON response. Org is derived from session, never body (route.ts:14-17).

**Inside `getStudentContext`:** `withTenant(learner.findUnique by id)` (master-context.ts:445) then defense-in-depth `student.organizationId !== organizationId → return null` (455); then bare `db.objective.findMany` filtered by enrolled course strands (486, global spine — no org column); then `withTenant(book.findMany)` by enrolled subjects (508). `bookPreferences` are returned with **empty title/subject** (master-context.ts:567-570 — placeholder).

## 5. Status table

| Unit | Status | Evidence |
|------|--------|----------|
| `getMasterContext` | DONE | Consumed by prompt-builder.ts:275, generate-tool.tsx:53, suggest-blocks.ts:54, 6 pages + inspect route. |
| `getFamilyContext` / `getScheduleContext` / `getStudentContext` / `getAcademicContext` / `getLibraryContext` | DONE | All invoked inside `getMasterContext` (master-context.ts:219-240). |
| `serializeMasterContext` | DONE | prompt-builder.ts:278; context/page.tsx:48; students/blueprint/courses/grading pages. |
| `truncateContext` heuristic | PARTIAL | Section detection is fragile string-matching (context-serializer.ts:412-429); `getSectionType` returns "other" for sub-lines and section reassembly can reorder/drop content. Works but lossy. |
| `bookPreferences` in StudentContext | STUB | master-context.ts:566-570 returns `title:""`, `subject:""` with `// Would need to fetch full book data`. |
| `FamilyContext.instructors.whatStudentsCall` | STUB | Hardcoded `null` with comment "field doesn't exist in schema" (master-context.ts:351). |
| `analyzeContextCompleteness` | DONE | context/page.tsx:41, creation-station:79, courses/builder:94, dashboard.ts:39. |
| `getSmartDefaults` | DONE | creation-station/[id]/page.tsx:86. |
| `getContextImpactDescription` | DONE | ContextCompleteness.tsx:194. |
| `ContextCompleteness` (org gauge) | DONE | context/page.tsx, courses/builder, ParentDashboard.tsx:104. |
| `ContextInspectorClient` | DONE | context/page.tsx:69. |
| `ContextBadges` | DONE | StudentHeader.tsx:41, creation-station:165, courses/builder:175. |
| `ContextSuggestionsInline` | DONE | creation-station/[id]/page.tsx:271. |
| `SmartDefaultsSuggestions` | DONE | creation-station/[id]/page.tsx:189. |
| `ContextLineageDisplay` | DONE | GeneratedResourceCard.tsx:112. |
| `AIContextPreview` | DONE | students/[id]/page.tsx:117. |
| `PersonalizationContextCard` (student-scoped, `_components`) | ✅ DONE | Renamed 2026-06-19 from `ContextCompleteness` to resolve collision (Q-09-007). students/[id]/page.tsx:89. |
| `ContextInspector.tsx` (standalone) | DEAD | Only self-reference; zero importers repo-wide (grep). |
| `ContextPreview.tsx` | DEAD | Only self-reference; zero importers repo-wide (grep). |
| `MasterContextParams.courseBlockId/bookId/videoId/articleId/documentId` | DEAD (fields) | Declared (master-context.ts:13-18), threaded by prompt-builder/inspect route, but never read by any sub-fetcher in master-context.ts. |

## 6. Integration points
- **Imports in:** `@/server/db` (`db`, `withTenant`), `@/generated/client` (`Prisma`, `EducationalPhilosophy`), `@/lib/constants/educational-philosophies` (`PHILOSOPHY_PROMPTS`), `@/auth`, `@/lib/auth-helpers` (`getCurrentUserOrg`).
- **Importers out (engine → consumers):** `src/lib/utils/prompt-builder.ts`, `src/app/actions/generate-tool.tsx`, `src/app/actions/suggest-blocks.ts`, `src/server/queries/students.ts` (`getStudentMasterContext`, cached), `src/server/queries/dashboard.ts` (`analyzeContextCompleteness`), pages: `context`, `blueprint`, `creation-station/[id]`, `courses/[id]/builder`, `grading/[id]`, `students/[id]`.
- **Prisma models read:** `Organization`, `Classroom` (+ instructors, holidays, environmentPreferences), `Learner`, `LearnerProfile`, `CourseEnrollment`→`Course`→`Subject`/`Strand`, `ActivityProgress`, `AssessmentAttempt`, `CourseProgress`, `PersonalizedResource`(personalizedResources)+`ResourceKind`, `Objective`→`Subtopic`→`Topic`→`Strand`→`Subject` (global spine), `Book`, `VideoResource`, `Resource`+assignments.
- **External APIs:** none directly (consumers call the AI SDK).
- **Inngest jobs:** none.
- **Routes:** page `/context`; API `POST /api/context/inspect`.
- **Env vars:** none direct.
- **Cross-refs:** 02-data-model (models, global academic spine), 04-security-auth-tenancy (`withTenant`/`getCurrentUserOrg`, RLS off), 08-ai-core + 10 (serialized context fed to generators), 06/07 (UI primitives, dashboards).

## 7. Findings

Q-09-001  [MED]  `analyzeContextCompleteness` issues several queries via tenant-bypassing `db` indirectly? — actually uses `withTenant` for its own counts but the wrapped `getMasterContext` student/library paths are tenant-threaded; the real gap is the dashboard caller — `src/server/queries/dashboard.ts:36-39`
  Evidence: dashboard.ts:36 carries the maintainer NOTE "analyzeContextCompleteness still queries via `db`; it is not yet tenant-threaded". In context-suggestions.ts the count queries DO use `withTenant` (lines 98, 138, 161, 172, 185), but `getMasterContext` it invokes runs `getAcademicContext`/objective queries on bare `db`. Org boundary is enforced for org-scoped models, but the NOTE indicates known threading drift.
  Impact: Drift between the comment's claim and the actual code; reviewer confusion. Functionally counts ARE org-scoped, so low real risk, but the schema-vs-comment mismatch should be reconciled.
  Status: documented (not fixed)

Q-09-002  [LOW]  `currentObjectives` query in `getStudentContext` runs on bare `db` with no org predicate — `src/lib/context/master-context.ts:486-505`
  Evidence: `db.objective.findMany` filtered only by enrolled-course strands; `Objective` has no `organizationId` column (schema.prisma:451-468 — global academic spine). The enrolled `courseIds` are themselves derived from a tenant-checked learner (master-context.ts:455), so cross-org leakage is bounded by the upstream learner ownership check.
  Impact: Correct-by-construction today (spine is shared, course ids are pre-validated), but the unscoped `db` access relies on an upstream invariant; if `getStudentContext` were ever called with a foreign studentId that passed the `findUnique` it would already return null at line 455 first. No live vuln.
  Status: documented (not fixed)

Q-09-003  [LOW]  `bookPreferences` returns empty placeholder data — `src/lib/context/master-context.ts:566-570`
  Evidence: maps `bookIds` to `{id, title:"", subject:""}` with comment "Would need to fetch full book data". `StudentContext.bookPreferences` therefore always carries blank titles.
  Impact: Any consumer/serializer reading `bookPreferences` titles gets empty strings. The serializer does not currently render `bookPreferences` (it uses `LibraryContext.relevantBooks` instead), so impact is latent; the field is misleading dead-ish data on the student object.
  Status: documented (not fixed)

Q-09-004  [LOW]  Two DEAD context components shipped but unimported — `src/components/context/ContextInspector.tsx:9`, `src/components/context/ContextPreview.tsx:13`
  Evidence: repo-wide grep shows only self-references; the live inspector is `ContextInspectorClient`, and `AIContextPreview`/`ContextInspectorClient` cover the preview use cases. `ContextInspector` also exposes a free-form Organization ID input (line 49) — a manual-orgId UX that would bypass session-derived org if ever wired (the API route itself ignores body org, so no live leak).
  Impact: Dead code; the orphan `ContextInspector` is also an anti-pattern (manual orgId entry) that should not be revived as-is.
  Status: documented (not fixed)

Q-09-005  [LOW]  Unused `MasterContextParams` narrowing fields — `src/lib/context/master-context.ts:13-18`
  Evidence: `courseBlockId`, `bookId`, `videoId`, `articleId`, `documentId` are declared and forwarded by `prompt-builder.ts:268-272` and `inspect/route.ts:31-36`, but no sub-fetcher in master-context.ts reads them. `getLibraryContext` only uses `objectiveId`/`courseId`.
  Impact: API/params surface implies media-specific context narrowing that is not implemented; callers passing `bookId`/`videoId` get no effect. Schema↔code drift / incomplete feature.
  Status: documented (not fixed)

Q-09-006  [LOW]  Fragile heuristic truncation can drop/reorder context — `src/lib/context/context-serializer.ts:330-429`
  Evidence: `truncateContext` re-derives section boundaries by substring matching on rendered lines (`getSectionType`), sorts sections by priority, and emits in priority order — not original order; lines that don't match a header map to "other" (priority `indexOf` = -1, sorted first). The injected `PHILOSOPHY_PROMPTS` block (a multi-line blob after the family header, line 108) has no header markers, so under truncation it can be misclassified and reordered/cut.
  Impact: When context exceeds `maxTokens`, the prompt sent to the AI may silently lose the philosophy mental-model or reorder sections away from authoring intent, degrading personalization fidelity. Only triggers above budget (default 2000 tokens; inspector uses 10000 so it's invisible there).
  Status: documented (not fixed)

Q-09-007  [INFO]  ✅ RESOLVED 2026-06-19 — renamed student-scoped component to `PersonalizationContextCard` (file + symbol); collision gone (see CHANGELOG.md). Duplicate component name `ContextCompleteness` with divergent props — `src/components/context/ContextCompleteness.tsx:43` vs `src/app/students/[id]/_components/ContextCompleteness.tsx:9`
  Evidence: org-level version takes `{completeness, suggestions}` and computes 5 pillars from suggestions; student-level version takes `{student, relevantBooks}` and computes a separate 4-item score (profile/learningStyle/courses/books, lines 13-24) entirely independently of `analyzeContextCompleteness`.
  Impact: Two unrelated "completeness" scoring algorithms with the same component name; the student page's score will not match the org engine's. Naming collision + scoring drift; maintenance hazard.
  Status: documented (not fixed)

Q-09-008  [INFO]  ✅ RESOLVED 2026-06-19 — added an Array.isArray defensive guard in context-serializer for environment.goals/challenges; the write path (blueprint.ts) already Zod-validates, so this hardens legacy/hand-edited rows (see CHANGELOG.md). `environmentPreferences` JSON cast without validation — `src/lib/context/master-context.ts:326-332`
  Evidence: `environment = classroom.environmentPreferences as FamilyContext["environment"]`; the `try/catch` wraps only an assignment that cannot throw, so malformed JSON shape is accepted unchecked. Downstream serializer reads `environment.goals`/`.challenges` arrays (context-serializer.ts:121-126) assuming arrays.
  Impact: If `environmentPreferences` has an unexpected shape, `.goals.length` could throw at serialize time rather than fail gracefully. No Zod validation on this JSON column.
  Status: documented (not fixed)
