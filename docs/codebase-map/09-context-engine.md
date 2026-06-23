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
| `src/components/context/ContextInspectorClient.tsx` | Tabbed inspector (Preview/Raw JSON/Structured) + export buttons. |
| `src/components/context/ContextLineageDisplay.tsx` | "Generated with: …" lineage chips + collapsible full-context. |
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
- `getStudentContext(studentId, orgId)` (365) — learner + `learnerProfile` (personality/learningStyle/interests JSON), enrollments, completed `activityProgress`/`assessmentAttempts` counts, `courseProgress[0]`, plus a separate objective query.
- `getAcademicContext(objectiveId)` (578) — objective + full hierarchy; builds `fullPath` = `subject > strand > topic > subtopic`.
- `getLibraryContext(orgId, objectiveId?, courseId?)` (676) — relevant books (by objective's subject/strand, else course's), videos (org-wide EXTRACTED), course resources.
- `getScheduleContext(orgId)` (885) — newest classroom calendar; computes `currentWeek`/`totalWeeks` from today vs school-year dates.

**Context shape** — the interfaces (`FamilyContext`, `StudentContext`, `AcademicContext`, `LibraryContext`, `ScheduleContext`, `MasterContext`) are all declared in master-context.ts:21-205 and re-imported by the serializer.

**Serializer — `serializeMasterContext(context, options)`** (`context-serializer.ts:30`). Iterates `prioritize` order (default `[academic, student, family, library, schedule]`), appends per-section blocks, joins with `\n\n`. If `estimateTokenCount` (chars/4, line 323) exceeds `maxTokens` (default 2000), calls `truncateContext` which re-parses lines into sections by heuristic string-match (`getSectionType`, line 412), sorts by priority, and keeps high-priority sections within budget. Family serializer injects `PHILOSOPHY_PROMPTS[philosophy]` mental-model text (line 106-109).

**Completeness/suggestions — `analyzeContextCompleteness(orgId, opts)`** (`context-suggestions.ts:11`). 5-point score (family/student/academic/library/schedule), each present = +1; emits typed `ContextSuggestion`s with `actionUrl`/`actionLabel`/`priority`, sorted high→low. Returns `{completeness: 0-100, suggestions}`.

**Smart defaults — `getSmartDefaults(orgId, courseId?)`** (`smart-defaults.ts:6`). If courseId: org-scoped course lookup, auto-pick lone enrolled student, fetch ≤10 objectives. Else: if exactly 1 learner in org, suggest it. (The org learner count/list here and in `context-suggestions.ts` exclude parent-as-learner rows via `excludeParentLearners` — Q-05-006, 2026-06-19.)

**Entry points**: server page `/context` (page.tsx) renders `ContextCompleteness` + `ContextInspectorClient`; `POST /api/context/inspect` returns raw JSON. The engine is consumed for AI by `src/lib/utils/prompt-builder.ts:38`, `src/app/actions/generate-tool.tsx:53`, `src/app/actions/suggest-blocks.ts:61`, and rendered as previews on blueprint/students/courses-builder/grading pages.

## 4. Data flow

**AI generation path (the real consumer):** generator action → `prompt-builder.ts:38 getMasterContext(contextParams)` → `serializeMasterContext` (line 41) → wrapped into the `buildMasterPrompt` template, which now LEADS with the Inkling persona + ethical guardrails (`prompt-builder.ts:53-71`, Q-08-001) above the serialized context → handed to the AI SDK (see 08-ai-core). `generate-tool.tsx:53/66` uses this same `buildMasterPrompt`; `suggest-blocks.ts:61` calls `getMasterContext` but assembles its OWN prompt (not via `buildMasterPrompt`, so outside Q-08-001's guardrail injection).

**Inspector page flow:** `/context` request → `page.tsx:18 auth()` (redirect /login if no user) → `page.tsx:27 getCurrentUserOrg()` (redirect /onboarding if no org) → `getMasterContext({organizationId, studentId, objectiveId, courseId})` (33) → `analyzeContextCompleteness` (41) → `serializeMasterContext({maxTokens:10000})` (48) → renders `ContextCompleteness` (66) + `ContextInspectorClient` (69).

**Inspect API flow:** `route.ts:9 auth()` → 401 if no user → `route.ts:17 getCurrentUserOrg(session)` → 403 if no org → body parsed, only string-narrowed ids passed (`str()`, line 25) → `getMasterContext` (27) → JSON response. Org is derived from session, never body (route.ts:14-17).

**Inside `getStudentContext`:** `withTenant(learner.findUnique by id)` (master-context.ts:445) then defense-in-depth `student.organizationId !== organizationId → return null` (455); then bare `db.objective.findMany` filtered by enrolled course strands (global spine — no org column). *(The dead `bookPreferences` placeholder field + its feeder `book.findMany` query were removed 2026-06-20, Q-09-003.)*

## 5. Status table

| Unit | Status | Evidence |
|------|--------|----------|
| `getMasterContext` | DONE | Consumed by prompt-builder.ts:38, generate-tool.tsx:53, suggest-blocks.ts:61, 6 pages + inspect route. |
| `getFamilyContext` / `getScheduleContext` / `getStudentContext` / `getAcademicContext` / `getLibraryContext` | DONE | All invoked inside `getMasterContext` (master-context.ts:219-240). |
| `serializeMasterContext` | DONE | prompt-builder.ts:41; context/page.tsx:48; students/blueprint/courses/grading pages. |
| `truncateContext` heuristic | ✅ DONE | Rewritten 2026-06-20 (Q-09-006) to a carry-forward classifier (context-serializer.ts): headerless lines inherit their section, kept sections emit in **original order**, the `PHILOSOPHY_PROMPTS` blob travels with its FAMILY header, and lowest-priority sections shed first. Was PARTIAL/lossy (string-match reorder). +3 unit tests (context-serializer.test.ts). |
| `bookPreferences` in StudentContext | ✅ REMOVED | Was a STUB returning `title:""`/`subject:""`; deleted 2026-06-20 (Q-09-003) with its feeder `bookIds` query — zero readers, redundant with `LibraryContext.relevantBooks`. |
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
| `ContextInspector.tsx` (standalone) | ✅ REMOVED | Deleted 2026-06-20 (Q-09-004) — zero importers; the free-form-orgId input was a latent anti-pattern. |
| `ContextPreview.tsx` | ✅ REMOVED | Deleted 2026-06-20 (Q-09-004) — zero importers; superseded by `AIContextPreview`. |
| `MasterContextParams` media ids (was courseBlockId/bookId/videoId/articleId/documentId) | ✅ REMOVED | Deleted 2026-06-23 (Q-09-005): the 5 never-read fields are gone from `MasterContextParams` + `buildMasterPrompt` + the inspect route. Source-specific generation now flows through `generateResourceCore` (sourceType/sourceId), not this context object. |

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

Q-09-001  [MED]  ✅ RESOLVED 2026-06-20 (Session 17) — corrected the stale maintainer NOTE; **no code change** (the code was already correct; see CHANGELOG.md round 20). The NOTE was a probe-era breadcrumb (added in `8a79c8c`) that the **next** commit `5a77836` ("route org/user-scoped reads through withTenant for the Next runtime") made stale — it threaded the tenant ~1.5h later but the comment was never updated. Re-verify (hand-trace + 2 independent adversarial RLS skeptics, both high-confidence, tasked to *prove the NOTE still true* and both failed): every org-scoped query reachable from the dashboard's `analyzeContextCompleteness(organizationId)` call (no options) runs via `withTenant(..., { organizationId, userId: null })` — `learner.count`/`course.count`/`book.count` (context-suggestions.ts:99/139/162) + `organization.findUnique`/`classroom.findFirst`/`videoResource.findMany` via `getMasterContext` (master-context.ts:262/874/776). The only bare-`db` reads are `db.objective.*` (global academic spine, `Objective` ∈ `CONTEXT_FREE_MODELS`) — and they're unreachable on the no-options path anyway. So the NOTE's "not yet tenant-threaded → returns empty under RLS" was false at HEAD. Over-graded MED for what is comment drift (no live vuln); resolved (not merely re-graded) since correcting the comment leaves nothing to track. `analyzeContextCompleteness` issues several queries via tenant-bypassing `db` indirectly? — actually uses `withTenant` for its own counts but the wrapped `getMasterContext` student/library paths are tenant-threaded; the real gap is the dashboard caller — `src/server/queries/dashboard.ts:36-39`
  Evidence: dashboard.ts:36 carries the maintainer NOTE "analyzeContextCompleteness still queries via `db`; it is not yet tenant-threaded". In context-suggestions.ts the count queries DO use `withTenant` (lines 98, 138, 161, 172, 185), but `getMasterContext` it invokes runs `getAcademicContext`/objective queries on bare `db`. Org boundary is enforced for org-scoped models, but the NOTE indicates known threading drift.
  Impact: Drift between the comment's claim and the actual code; reviewer confusion. Functionally counts ARE org-scoped, so low real risk, but the schema-vs-comment mismatch should be reconciled.
  Status: ✅ RESOLVED 2026-06-20 (comment-only correction; cross-chapter — `dashboard.ts` is owned by ch.16, finding owned by ch.09)

Q-09-002  [LOW]  ✅ ACCEPTED 2026-06-20 — correct-by-design; closed, no code change (see CHANGELOG.md round 19). `Objective` is global `CONTEXT_FREE_MODELS` spine (no `organizationId`); the read is bounded by a tenant-verified learner. No clarifying comment was added — the invariant is documented authoritatively at `db.ts:33-55`, and a `courseIds`-based comment would mis-frame it (the binding is a relevance filter, not the tenant boundary; sibling reads at master-context.ts:618/:685 are safe for the same global-data reason with no course binding). `currentObjectives` query in `getStudentContext` runs on bare `db` with no org predicate — `src/lib/context/master-context.ts:486-505`
  Evidence: `db.objective.findMany` filtered only by enrolled-course strands; `Objective` has no `organizationId` column (schema.prisma:451-468 — global academic spine). The enrolled `courseIds` are themselves derived from a tenant-checked learner (master-context.ts:455), so cross-org leakage is bounded by the upstream learner ownership check.
  Impact: Correct-by-construction today (spine is shared, course ids are pre-validated), but the unscoped `db` access relies on an upstream invariant; if `getStudentContext` were ever called with a foreign studentId that passed the `findUnique` it would already return null at line 455 first. No live vuln.
  Status: ✅ ACCEPTED (correct-by-design) 2026-06-20

Q-09-003  [LOW]  ✅ REMOVED 2026-06-20 — deleted the dead `bookPreferences` field + its feeder `bookIds` query + producer (see CHANGELOG.md round 19). Verified zero readers repo-wide (only the interface decl + the writer); the real book channel into the prompt is `LibraryContext.relevantBooks`, so nothing downstream changed (only the debug `/api/context/inspect` JSON loses a blank array). Also removed a wasted per-call `book.findMany` round-trip. `bookPreferences` returns empty placeholder data — `src/lib/context/master-context.ts:566-570`
  Evidence: maps `bookIds` to `{id, title:"", subject:""}` with comment "Would need to fetch full book data". `StudentContext.bookPreferences` therefore always carries blank titles.
  Impact: Any consumer/serializer reading `bookPreferences` titles gets empty strings. The serializer does not currently render `bookPreferences` (it uses `LibraryContext.relevantBooks` instead), so impact is latent; the field is misleading dead-ish data on the student object.
  Status: ✅ REMOVED 2026-06-20

Q-09-004  [LOW]  ✅ REMOVED 2026-06-20 — `git rm` both dead files (see CHANGELOG.md round 19). Zero importers (gold-standard refutation held; the live `ContextInspectorClient`/`AIContextPreview` are different files and supersede them); deleting orphaned nothing (their UI primitives are shared across 100+ files). Two DEAD context components shipped but unimported — `src/components/context/ContextInspector.tsx:9`, `src/components/context/ContextPreview.tsx:13`
  Evidence: repo-wide grep shows only self-references; the live inspector is `ContextInspectorClient`, and `AIContextPreview`/`ContextInspectorClient` cover the preview use cases. `ContextInspector` also exposes a free-form Organization ID input (line 49) — a manual-orgId UX that would bypass session-derived org if ever wired (the API route itself ignores body org, so no live leak).
  Impact: Dead code; the orphan `ContextInspector` is also an anti-pattern (manual orgId entry) that should not be revived as-is.
  Status: ✅ REMOVED 2026-06-20

Q-09-005  [LOW]  ✅ RESOLVED 2026-06-23 (consolidated onto `generateResourceCore`, not removed-as-feature) — routed `GeneratorForm`→`generateResource` (source-aware) via the new `lib/generators/resolve-source.ts`, then DELETED the 5 never-read `MasterContextParams` media ids + `generateLearningTool` + the standalone `[id]` page + `@ai-sdk/rsc` (see CHANGELOG.md). Original framing kept for history — was re-framed 2026-06-20 (Session 16) from "dead fields" to an **unfinished feature** (owner had kept the hook; round 19). These 5 ids are the **unbuilt context-injection half of source-anchored generation**: the *lineage* half is live (`generate-tool.tsx:131-134`/`:209-212` write `generatedFrom{Book,Video,Article,Document}Id`), but no sub-fetcher ever fetches the specific source's content into `MasterContext` — `getLibraryContext` only does broad subject/strand relevance. Safely removable (~4-file mechanical edit, tsc-safe; the page's `bookId/videoId` reads + lineage writes are driven by `generateLearningTool`'s own params, independent of this interface) but below the value bar for a LOW while the feature may be built. Unused `MasterContextParams` narrowing fields — `src/lib/context/master-context.ts:13-18`
  Evidence: `courseBlockId`, `bookId`, `videoId`, `articleId`, `documentId` are declared and forwarded by `prompt-builder.ts:16-20`/`:31-35` and `inspect/route.ts:32-36`, and threaded from `GeneratorForm`→`generateLearningTool`, but no sub-fetcher in master-context.ts reads them. `getLibraryContext` only uses `objectiveId`/`courseId`. *(The old cite `prompt-builder.ts:268-272` was stale — that file was shrunk to ~72 lines in Session 14, Q-08-003.)*
  Impact: API/params surface implies media-specific context narrowing that is not implemented; callers passing `bookId`/`videoId` get no source-specific grounding in the prompt (only the lineage tag is recorded). Incomplete feature, not a live defect.
  Cross-ref (2026-06-20, Session 19): this "ids are NOT consumed by any sub-fetcher" fact is what let **Q-10-010** (ch.10) rule out a cross-org *read* leak on the generative-UI path — the unverified caller-supplied ids can't pull foreign-org content into the prompt because nothing reads them; Q-10-010's residual is only the low-value lineage *write* (re-graded LOW, deferred). See CHANGELOG.md round 22.
  Status: ⏳ OPEN (unfinished feature) — re-documented 2026-06-20

Q-09-006  [LOW]  ✅ RESOLVED 2026-06-20 — rewrote `truncateContext` to a **carry-forward classifier** (see CHANGELOG.md round 19): each headerless line inherits the section it appears under (so the injected `PHILOSOPHY_PROMPTS` blob and detail lines like `- Faith Background` stay with their FAMILY section), kept sections are emitted in **original document order**, and lowest-priority sections are shed first. The verifier confirmed the old code scrambled the prompt (headerless lines `indexOf -1` → sorted FIRST, fragmenting sections). **Overrode the agents' proposed `split("\n\n")` fix** — the philosophy injection (`context-serializer.ts:108`) pushes `\n` + a value that itself starts with `\n`, producing a triple-newline that would fragment the family block. +3 new unit tests (`context-serializer.test.ts`, the file's first coverage). Fragile heuristic truncation can drop/reorder context — `src/lib/context/context-serializer.ts:330-429`
  Evidence: `truncateContext` re-derives section boundaries by substring matching on rendered lines (`getSectionType`), sorts sections by priority, and emits in priority order — not original order; lines that don't match a header map to "other" (priority `indexOf` = -1, sorted first). The injected `PHILOSOPHY_PROMPTS` block (a multi-line blob after the family header, line 108) has no header markers, so under truncation it can be misclassified and reordered/cut.
  Impact: When context exceeds `maxTokens`, the prompt sent to the AI may silently lose the philosophy mental-model or reorder sections away from authoring intent, degrading personalization fidelity. Only triggers above budget (default 2000 tokens; inspector uses 10000 so it's invisible there).
  Status: ✅ RESOLVED 2026-06-20

Q-09-007  [INFO]  ✅ RESOLVED 2026-06-19 — renamed student-scoped component to `PersonalizationContextCard` (file + symbol); collision gone (see CHANGELOG.md). Duplicate component name `ContextCompleteness` with divergent props — `src/components/context/ContextCompleteness.tsx:43` vs `src/app/students/[id]/_components/ContextCompleteness.tsx:9`
  Evidence: org-level version takes `{completeness, suggestions}` and computes 5 pillars from suggestions; student-level version takes `{student, relevantBooks}` and computes a separate 4-item score (profile/learningStyle/courses/books, lines 13-24) entirely independently of `analyzeContextCompleteness`.
  Impact: Two unrelated "completeness" scoring algorithms with the same component name; the student page's score will not match the org engine's. Naming collision + scoring drift; maintenance hazard.
  Status: documented (not fixed)

Q-09-008  [INFO]  ✅ RESOLVED 2026-06-19 — added an Array.isArray defensive guard in context-serializer for environment.goals/challenges; the write path (blueprint.ts) already Zod-validates, so this hardens legacy/hand-edited rows (see CHANGELOG.md). `environmentPreferences` JSON cast without validation — `src/lib/context/master-context.ts:326-332`
  Evidence: `environment = classroom.environmentPreferences as FamilyContext["environment"]`; the `try/catch` wraps only an assignment that cannot throw, so malformed JSON shape is accepted unchecked. Downstream serializer reads `environment.goals`/`.challenges` arrays (context-serializer.ts:121-126) assuming arrays.
  Impact: If `environmentPreferences` has an unexpected shape, `.goals.length` could throw at serialize time rather than fail gracefully. No Zod validation on this JSON column.
  Status: documented (not fixed)
