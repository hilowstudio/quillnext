# 10 — Resource Generation & Creation Station
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|---|---|
| `src/app/creation-station/page.tsx` | RSC entry: auth + org gate, loads recent `CurriculumBundle`s, renders client shell |
| `src/app/creation-station/CreationStationClient.tsx` | Tab shell: "Curriculum Compiler" (SpecForm+BundleView) and "Quick Create" (GeneratorsClient) |
| `src/app/creation-station/GeneratorsClient.tsx` | Quick-create wizard: source-type → content → template → generate via `generateResource` |
| `src/app/creation-station/[id]/page.tsx` | Per-ResourceKind generator page (context preview + `GeneratorForm` → `generateLearningTool`) |
| `src/app/creation-station/compiler/BundleView.tsx` | Lists recent bundles, status badges, artifact links, "Refine" patch dialog |
| `src/app/creation-station/compiler/SpecForm.tsx` | react-hook-form spec form, validated by shared `curriculumSpecSchema` |
| `src/app/actions/generate-resource.ts` | `"use server"` browser wrapper: auth → `getCurrentUserOrg` → `generateResourceCore` |
| `src/app/actions/generate-resource-core.ts` | **Core generation pipeline** (784 lines): source load → grounding → AI → verify → persist |
| `src/app/actions/generate-tool.tsx` | `"use server"` `generateLearningTool`: streamUI generative-UI (quiz/worksheet components) |
| `src/app/actions/generator-actions.ts` | `getSourceMetadata` (subject/strand lookup) + `SourceType` union |
| `src/app/actions/suggest-blocks.ts` | `suggestCourseBlocks`: AI-suggest course Units/Modules, persist CourseBlocks |
| `src/app/actions/explode-bundle.ts` | `explodeCurriculumBundle`: materialize a completed bundle into a Course as a Unit |
| `src/app/actions/compile-curriculum-action.ts` | `compileCurriculumAction` + `patchCurriculumAction`: create spec/bundle → Inngest |
| `src/components/generators/GeneratorForm.tsx` | Client form for `[id]` page → `generateLearningTool` |
| `src/components/generators/SimpleInputs.tsx` | `UrlInput` (used) + `FileUpload` (imported, unrendered) |
| `src/components/generators/SourceTypeSelector.tsx` | Tab strip of source types (SPINE/BOOK/VIDEO/COURSE/TOPIC/URL/FILE/YOUTUBE_PLAYLIST) |
| `src/components/generators/SpineBrowser.tsx` | Cascading spine selector; reports deepest node as generation target |
| `src/components/generators/TopicSelector.tsx` | 3-mode topic input (Spine / Free / Standard) for TOPIC source |
| `src/components/creation/YouTubeImport.tsx` | Playlist URL fetch + preview → `onImport` callback |
| `src/components/resources/GeneratedResourceCard.tsx` | Library card for a generated Resource (view/delete/lineage) |
| `src/lib/validation/curriculum-spec.ts` | Shared `curriculumSpecSchema` + `clampDurationDays` |
| `src/lib/constants/curriculum-kinds.ts` | `CURRICULUM_KIND_CODES` map (compiler artifact slugs) |
| `src/lib/schemas/actions.ts` | App-wide Zod server-action schemas (only some are consumed) |

## 2. Purpose / intent
"Creation Station" is the teacher-facing surface for AI-generating educational artifacts. Two modes: **Quick Create** (one source + one template → one Resource, synchronous) and the **Curriculum Compiler** (a constrained spec → an async Inngest job that produces a whole `CurriculumBundle` of artifacts — Teacher Guide, Student Packet, Slides, Reading Anthology, Graphic Organizers). Completed bundles can be "refined" (patch re-compile) and "exploded" into a Course as a ready-to-run Unit. A separate per-ResourceKind generator page (`[id]`) uses the context engine (09-) for a context preview and generative-UI streaming. The whole area sits on top of the AI core (08-) and the context/grounding machinery (09-, generation-guards, vector RAG).

## 3. Architecture & key files
- **Two generation back-ends, not one.** `generateResourceCore` (the 784-line pipeline) is the heavy path used by Quick Create and the Inngest compiler. `generateLearningTool` (`generate-tool.tsx`) is a *separate* streamUI generative-UI path used only by the `[id]` page's `GeneratorForm` — it builds prompts via `buildMasterPrompt` (09-) and persists via `withTenant` `resource.create` (Q-10-010 resolved 2026-06-20 — was plain `db`; now matches the heavy pipeline's tenant path). The two share almost no code — but since 2026-06-19 (Q-08-001) both prompt paths inject the same Inkling persona + ethical guardrails (the class `PromptBuilder` and `buildMasterPrompt` respectively), so this generative-UI path now carries the same safety bounds as the heavy pipeline.
- **`generateResourceCore`** (`generate-resource-core.ts`): session-less by design (`generate-resource-core.ts:236-242` — NOT `"use server"`, identity passed in). Flow: (1) load `ResourceKind` (`:247`); (2) load classroom + optional student via `withTenant` (`:262`,`:272`); (3) branch on `sourceType` to assemble `context` + `factsBlock` + optional RAG `excerptsBlock`/`quoteRule` (`:306-665`); (4) build prompt via `PromptBuilder` (08-) (`:679-697`); (5) generate — `generateObject` for QUIZ/WORKSHEET, `generateText` (with a `generate_image` Nano-Banana tool) for markdown (`:703-748`); (6) verify/revise against canonical facts (`:754-761`); (7) `withTenant` `resource.create` (`:764-781`).
- **Grounding/RAG** (09- territory, invoked here): `buildCanonicalFactsBlock`, `verifyAndReviseMarkdown/Object`, `QUOTE_GROUNDING_RULE*` from `@/lib/ai/generation-guards`; `retrieveBookChunks`/`retrieveTextbookChunks` from `@/lib/utils/vector`; `TEXTBOOK_SOURCES` from `@/lib/sources/registry`. BOOK full-text RAG gated on `fullTextStatus === "INGESTED"` (`:447`); spine/TOPIC sources ground-don't-echo against the textbook corpus (`:571-586`,`:610-626`).
- **Spine generation**: `SPINE_SOURCE_TYPES` (`:57`) + `loadSpineNode` (`:75-199`) resolve any level (SUBJECT…OBJECTIVE) to a path + descendant objectives (cap 40). `SpineBrowser` produces the `SpineSelection`; `GeneratorsClient` maps `level` directly to `sourceType` (`GeneratorsClient.tsx:157-164`).
- **Compiler UI**: `SpecForm` (validated by the *shared* `curriculumSpecSchema`) → `CreationStationClient.handleCompile` → `compileCurriculumAction` → creates `CurriculumSpec` + `CurriculumBundle(status=COMPILING)` → `inngest.send("curriculum/compile")` (23-). `BundleView` renders status + artifact links; `RefineBundleDialog` → `patchCurriculumAction` (clones spec, sets `parentBundleId`+`feedback`, re-sends event).
- **explode-bundle** materializes a COMPLETED bundle: one CourseBlock per artifact (because inline Resources only fill `resourceId`), plus a "Daily Lessons" module of `durationDays` lessons, all atomic in one `withTenant` tx (`explode-bundle.ts:140-201`). Triggered from `CourseBuilder.tsx:692`.

## 4. Data flow
Quick Create (synchronous):
1. `GeneratorsClient.handleGenerate` (`GeneratorsClient.tsx:141-190`) → `generateResource(sourceId, sourceType, kindId, instructions, additionalData)`.
2. `generate-resource.ts:26-30` authenticates + resolves org, then calls `generateResourceCore` with explicit `{organizationId, userId}` (`:32-40`), then `revalidatePath("/living-library")` (`:42`).
3. `generateResourceCore` runs the 7-step pipeline above and returns `{success, resourceId}`; client links to `/living-library/resource/{id}` (`GeneratorsClient.tsx:434`).

Compiler (async):
1. `SpecForm` submit → `CreationStationClient.handleCompile` (`CreationStationClient.tsx:41-61`) → `compileCurriculumAction(values)`.
2. `compile-curriculum-action.ts:19` re-validates with `curriculumSpecSchema.parse`, then creates spec + bundle atomically in one `withTenant` tx (`:26-48`, Q-10-002), sends Inngest event with `{specId, bundleId, organizationId, userId}` (`:51-59`) — outside the tx.
3. Inngest `compile-curriculum.ts` (23-) calls `generateResourceCore(...)` per artifact (`compile-curriculum.ts:83`) with the carried org/user.
4. `window.location.reload()` (`CreationStationClient.tsx:53`) re-pulls bundles from `page.tsx:18-33`.

Generative-UI ([id] page): `GeneratorForm.handleSubmit` → `generateLearningTool` (`generate-tool.tsx:17`) → `getCurrentUserOrg` (ignores `params.organizationId`, `:49`) → `getMasterContext`+`buildMasterPrompt` (09-) → `streamUI` with quiz/worksheet tools that write via `withTenant` `resource.create` (`:121`,`:199`; Q-10-010 — was plain `db`).

## 5. Status table

| Unit | Status | Evidence |
|---|---|---|
| `generateResourceCore` pipeline | DONE | wired from `generate-resource.ts:32` + `compile-curriculum.ts:83` |
| `generateResource` wrapper | DONE | `GeneratorsClient.tsx:10,158` |
| BOOK full-text RAG path | DONE | `generate-resource-core.ts:435-494`, gated on INGESTED |
| SPINE / TOPIC textbook grounding | DONE | `:544-586`, `:587-626` |
| YOUTUBE_PLAYLIST DEEP_VISION tier | PARTIAL (by-design) | `:642-651` — passes the playlist URL to `models.pro` ≡ `gemini-2.5-pro` (config.ts:11/15-16), the only Gemini model with native YouTube processing (config.ts:26,34,59), with a strong prompt; an explicit `google_search_retrieval`/Vertex grounding tool is a noted *future* enhancement, not a defect (Q-10-006 accepted 2026-06-20). |
| `generate_image` (Nano Banana) tool | PARTIAL | `:730-742` returns base64 inline; `maxSteps` removed (`:744` "type definition mismatch") so multi-step image use is limited |
| `generateLearningTool` (streamUI) | DONE | `GeneratorForm.tsx:55`; persists via `withTenant` `:121`,`:199` (Q-10-010, 2026-06-20) |
| `compileCurriculumAction` / `patchCurriculumAction` | DONE | `CreationStationClient.tsx:44`, `BundleView.tsx:120` |
| `explodeCurriculumBundle` | DONE | `CourseBuilder.tsx:692` |
| `suggestCourseBlocks` | DONE | `CourseBuilder.tsx:556` |
| `getSourceMetadata` | DONE | `GeneratorsClient.tsx:102` |
| `SpecForm` / `BundleView` / `SpineBrowser` / `TopicSelector` | DONE | rendered in CreationStation/GeneratorsClient |
| `SourceTypeSelector` exposes FILE | PARTIAL | tab exists (`SourceTypeSelector.tsx:41`) but `GeneratorsClient.tsx:319-323` renders "File upload coming soon..." (no upload) |
| `FileUpload` (SimpleInputs export) | UNFINISHED | imported `GeneratorsClient.tsx:19` but never rendered; FILE is a half-wired feature with a live entry point (`DocumentList.tsx:184` "Use in Generator" → `?sourceType=FILE`) and a wired `file`→`fileContent` FileReader (`:112-120`) — but `setFile` never fires (no `FileUpload` rendered) so FILE dead-ends. Completing it needs file-content extraction (Q-10-005 resolved-by-doc 2026-06-20). |
| `curriculumSpecSchema` / `clampDurationDays` | DONE | `SpecForm.tsx:22`, `compile-curriculum-action.ts:19`, `explode-bundle.ts:113` |
| `CURRICULUM_KIND_CODES` | DONE | `BundleView.tsx:8`, `explode-bundle.ts:7` |
| `generateResourceSchema` (schemas/actions.ts) | ✅ DONE (was DEAD) | Q-10-004 (Session 19, 2026-06-20): corrected to match `GenerateResourceCoreParams` (5 spine source types + `sectionNumber`/`subject`; `url` is NOT `.url()`; instructions/fileContent capped) and wired via `safeParse` in the browser-facing `generateResource` (`generate-resource.ts:32`). Shape-locked by `actions.test.ts`. |
| `GeneratedResourceCard` | DONE | `ResourceList.tsx:6,150` |
| `YouTubeImport` | DONE | `GeneratorsClient.tsx:326` |
| `actions.ts` other schemas | PARTIAL | now imported: `generateResourceSchema` (Q-10-004), `fetchPlaylistSchema`, `deleteStudentSchema`, `searchLibrarySchema`, `deleteBlockSchema`/`updateBlockSchema`/`deleteCourseSchema`, `createPrayerJournalSchema`; the rest (createCourse, createStudent, assignment, grading, bibleStudy, schedule, etc.) still have no importers |

## 6. Integration points
- **Imports in**: `@/server/db` (`db`,`withTenant`), `@/auth`, `@/lib/auth-helpers` (`getCurrentUserOrg`), `@/lib/ai/config` (`models`, `getModelForTaskWithVideoCheck`, `AITaskType`), `@/lib/ai/prompt-builder` (`PromptBuilder`), `@/lib/utils/prompt-builder` (`buildMasterPrompt`), `@/lib/ai/schemas` (`QuizSchema`,`WorksheetSchema`), `@/lib/ai/generation-guards`, `@/lib/utils/vector`, `@/lib/sources/registry`, `@/lib/services/image-generation`, `@/lib/context/*` (master-context, serializer, suggestions, smart-defaults), `@/inngest/client`, `@/app/actions/spine-actions`, `@/app/actions/youtube-actions`.
- **Importers out**: `GeneratorsClient` ← CreationStationClient; `generateResourceCore` ← `generate-resource.ts` + `inngest/functions/compile-curriculum.ts`; `explodeCurriculumBundle`/`suggestCourseBlocks` ← `CourseBuilder.tsx`; `GeneratedResourceCard` ← `ResourceList.tsx`; `SourceType` ← SourceTypeSelector.
- **APIs**: `fetch("/api/curriculum/resource-kinds")` (`GeneratorsClient.tsx:83`); Vercel AI SDK (`generateText`/`generateObject`/`streamUI`/`tool`); Gemini (`models.flash/pro/pro3`); Nano Banana image gen; YouTube (`getPlaylistDetails`).
- **Prisma models used**: `ResourceKind`, `Resource`, `Classroom`, `Learner`, `Book`/`BookExtraction`/`BookExtractionSection`, `VideoResource`, `Course`/`CourseBlock`, `Subject`/`Strand`/`Topic`/`Subtopic`/`Objective`, `CurriculumSpec`, `CurriculumBundle`. See 02-data-model.md.
- **Inngest jobs**: emits `curriculum/compile` (compile-curriculum-action.ts:51,100) → consumed in 23-.
- **Env**: none read directly here (AI keys live in `@/lib/ai/config`).

## 7. Findings

Q-10-001  [HIGH]  ✅ RESOLVED 2026-06-20 (Session 20) — closed the live IDOR. `getSourceMetadata` had
  **NO auth check** and read book/video/course by id on plain `db` with no org predicate → a live cross-org
  metadata read (RLS off). **Fix:** added a `getCurrentUserOrg()` auth+org gate and changed the 3
  `findUnique({where:{id}})` → `findFirst({where:{id, organizationId}})` so a cross-org id returns null →
  `{success:false}` (`generator-actions.ts:11-15,20,29,38`). **No `withTenant` needed** — a single-op read; the
  explicit `organizationId` predicate is the live boundary with RLS off, and under an RLS flip the per-query
  extension wraps the op transparently (db.ts:115-131). A 3-skeptic adversarial pass (high-effort, each tasked to
  *refute*) returned FIX_AS_PROPOSED / zero-regression; the sole caller (`GeneratorsClient.tsx:104`) passes the
  user's own library id, so the legit same-org flow is unaffected. (see CHANGELOG.md).
  Original evidence: `db.book/videoResource/course.findUnique({ where: { id } })` with NO `organizationId` filter and no `withTenant`. These are org-scoped tables; RLS is OFF (db.ts:9), so the app layer is the only tenant boundary.
  Impact: any authenticated user can probe another org's book/video/course subject+strand ids by id (IDOR-style metadata leak). Low data value but a real cross-tenant read.
  Status: ✅ resolved (see CHANGELOG.md)

Q-10-002  [HIGH→really MED]  ✅ RESOLVED 2026-06-20 (Session 20) — RLS-readiness hardening (NO live vuln).
  The adversarial pass confirmed there was no live cross-tenant exposure today: `compileCurriculumAction`
  stamps `organizationId` on `curriculumSpec.create` from session, and `patchCurriculumAction` has an explicit
  `parent.spec.organizationId !== organizationId` check before its write — so the finding was really **MED**
  (graded HIGH only on cluster-membership; the skeptic flagged the over-grade). **Fix (closes it regardless of
  grade):** wrapped spec.create + bundle.create in ONE `withTenant(..., {organizationId, userId})` tx in
  `compileCurriculumAction` (now atomic — no orphan spec on a failed bundle create) and the ownership-check read +
  patch bundle.create in ONE `withTenant` tx in `patchCurriculumAction`, **keeping the app-layer org check as the
  LIVE boundary** (withTenant adds no predicate with RLS off); `inngest.send` stays OUTSIDE both tx (a network call
  must not hold the DB connection). Zero behavior change today (RLS off → no-op tx, db.ts:106-110); RLS-ready,
  matching `explode-bundle.ts` / `generate-resource-core.ts:763` / the Q-10-010 fix. Advances Workstream B
  (ch.24 §5). (`compile-curriculum-action.ts:26-48,76-97`). (see CHANGELOG.md).
  Original evidence: `db.curriculumSpec.create`, `db.curriculumBundle.create`, `db.curriculumBundle.findUnique` use plain `db`, not `withTenant`. The spec write stamps `organizationId` from session (good), but the create runs outside the tenant transaction; the patch read fetches a bundle by id then checks `parent.spec.organizationId !== organizationId` in app code — correct but relies entirely on app-layer enforcement since RLS is inert.
  Impact: pattern depends on hand-written ownership checks; the bundle creates bypass the RLS GUC path that the rest of the codebase uses (`withTenant`). Inconsistent tenant enforcement, drift risk.
  Status: ✅ resolved (see CHANGELOG.md)

Q-10-003  [HIGH→really MED]  ✅ RESOLVED 2026-06-20 (Session 20) — RLS-readiness hardening (NO live vuln).
  The adversarial pass confirmed the explicit `course.organizationId !== organizationId` check already throws
  before any write, and `CourseBlock` is org-scoped only via the verified-owned course — so no live cross-tenant
  exposure today (really **MED**, graded HIGH on cluster-membership). **Fix (closes it):** wrapped the
  ownership-check course read in `withTenant(..., {organizationId, userId})` and the CourseBlock create-loop in ONE
  `withTenant` tx (now atomic), **keeping the app-check as the LIVE boundary** and the `generateObject` AI call
  OUTSIDE any tx (must not hold a DB tx open past Prisma's ~5s timeout). Zero behavior change today; RLS-ready,
  mirroring `explode-bundle.ts`. Advances Workstream B (ch.24 §5). (`suggest-blocks.ts:32,39-58,102-129`).
  (see CHANGELOG.md).
  Original evidence: course loaded via plain `db.course.findUnique` + manual `course.organizationId !== organizationId` (`:49`); `db.courseBlock.create` (`:101`) writes with NO tenant stamp/tx. With RLS off, the only guard is the app check; CourseBlock has no `organizationId` of its own here.
  Impact: relies solely on the manual guard; any logic slip = cross-tenant write. Inconsistent with `explode-bundle` which correctly uses `withTenant`.
  Status: ✅ resolved (see CHANGELOG.md)

Q-10-004  [MED]  ✅ RESOLVED 2026-06-20 (Session 19) — corrected the dead+drifted schema and wired it.
  `generateResourceSchema` (`actions.ts:109-128`) was updated to match `GenerateResourceCoreParams`
  (added the 5 SPINE source types `SUBJECT/STRAND/TOPIC_NODE/SUBTOPIC/OBJECTIVE`, plus
  `additionalData.sectionNumber` + `subject`), and is now `safeParse`-validated at the top of the
  browser-facing `generateResource` server action (`generate-resource.ts:32-44`) — the ONLY
  client-reachable generation entry (the Inngest compiler calls `generateResourceCore` directly via a
  local adapter, `compile-curriculum.ts:76-91`, so trusted background input is unaffected). The
  adversarial pass caught a regression in the first draft: `url` must NOT be a strict `.url()` (the UI
  has no client URL validation and the core embeds the string verbatim into a prompt — even tolerating
  scheme-less domains / topic phrases, `generate-resource-core.ts:626-631`), so `url` is a bounded
  plain string. `sourceId` stays `.min(1)` (URL/TOPIC/FILE pass non-UUID ids). Value = token-cost
  bounding (`instructions`≤8000 / `fileContent`≤200000) + fail-fast on a bad `sourceType` (previously
  fell through every branch into a paid model call + DB write) + repo-wide Zod-at-the-boundary
  consistency + killing misleading dead code; the finding's *prompt-injection* framing was overstated
  (single-tenant self-injection — no privilege boundary). Shape-locked by `src/lib/schemas/actions.test.ts`
  (7 tests, incl. the SPINE-types and non-strict-`url` invariants). (see CHANGELOG.md).
  Original evidence: grep found zero importers of `generateResourceSchema`; generation accepted
  `sourceId`/`sourceType`/`resourceKindId`/`instructions`/`additionalData` with no Zod parse; the dead
  schema omitted the SPINE source types + `subject`/`sectionNumber` (schema↔code drift).
  Status: ✅ resolved (see CHANGELOG.md)

Q-10-005  [LOW]  ✅ RESOLVED 2026-06-20 (Session 18) — re-documented + kept (no code change). FILE is an **unfinished** feature, not dead/superseded code: re-verify confirmed a live entry point (`DocumentList.tsx:184` "Use in Generator" → `?sourceType=FILE&sourceId=…`) and a wired `file`→`fileContent` FileReader (`:112-120`); FILE only dead-ends because `setFile` never fires (`FileUpload` unrendered). Completing it = a real file-content-extraction feature (product backlog, not a finding). Mirrors Q-09-005. (see CHANGELOG.md). `FileUpload` imported but never rendered; FILE source is a non-functional placeholder  — `GeneratorsClient.tsx:19,319-323`; `SimpleInputs.tsx:29`
  Evidence: `FileUpload` is imported (`:19`) but the FILE branch renders a static "File upload coming soon..." div; `SourceTypeSelector` still exposes the FILE tab. `fileContent` plumbing exists in `handleGenerate` but can never be populated.
  Impact: dead import + dead UI path; selecting FILE yields a dead end. `generateResourceCore`'s FILE branch (`generate-resource-core.ts:633-637`) is therefore unreachable from this UI.
  Status: documented (not fixed)

Q-10-006  [LOW]  ✅ ACCEPTED (by-design) 2026-06-20 (Session 18) — not broken, no code change. The DEEP_VISION branch passes the playlist URL to `models.pro` ≡ `gemini-2.5-pro` (config.ts:11/15-16), which the codebase documents as the **only Gemini model with native YouTube processing** (config.ts:26,34,59); the comment notes an explicit `google_search_retrieval`/Vertex grounding tool as a *future* enhancement. So grounding relies on the model's native capability, not a missing tool — the "silently degrades to ungrounded" impact is overstated (traced the producer/model reality, cf. Q-07-001). (see CHANGELOG.md). YOUTUBE_PLAYLIST DEEP_VISION "grounding" is prompt-only — no search/vision tool wired  — `generate-resource-core.ts:642-651`
  Evidence: comments state "In a real production app with AI SDK 3.0+, we would enable google_search_retrieval tool here. For this implementation, we will instruct the model strongly." Only the prompt asks the model to "Watch/Search the videos."
  Impact: claimed deep-vision grounding does not actually retrieve video content; output quality for that tier may silently degrade to ungrounded generation.
  Status: documented (not fixed)

Q-10-007  [LOW]  ✅ RESOLVED 2026-06-20 (Session 18) — deleted the genuinely-dead `let tools: any = {}` (was generate-resource-core.ts:289; assigned, never read — the `tools:` at the `generateText` call `:729` is an inline property, not this var), removing 3 lint warnings (no-unused-vars / prefer-const / no-explicit-any). The remaining boundary `any`s (Prisma nested-where union `:94`, AI-SDK `tool()` typing `:736/:742`, generic verify/revise over `jsonContent` `:755/:757`, `Resource.content` JSON `:773`) are real dynamic-boundary casts, **accepted** under the owner's `no-explicit-any` warn-ratchet (Q-01-004). (see CHANGELOG.md). `generateResourceCore` uses `eslint-disable @typescript-eslint/no-explicit-any` and many `any` casts on AI/DB boundaries  — `generate-resource-core.ts:92,287,289,290,736,742,755,757,773`
  Evidence: `genContext: any`, `tools: any`, `where as any`, `execute: async (args: any)`, content casts `(jsonContent as any)`.
  Impact: type safety lost at the model-output → DB-persist boundary; malformed AI objects could be written without compile-time checks.
  Status: documented (not fixed)

Q-10-008  [INFO]  ✅ RESOLVED 2026-06-19 — tidied handleCompile — removed the unreachable success-branch guard (the action throws on failure, caught below) (see CHANGELOG.md). `CreationStationClient.handleCompile` ignores `result.success === false` and only refreshes on success  — `CreationStationClient.tsx:45-54`
  Evidence: on `!result.success` nothing is surfaced (no toast); the only failure path is the catch block. `compileCurriculumAction` throws (never returns `{success:false}`), so this is benign today but is dead defensive code that masks intent.
  Impact: minor; brittle if the action's contract changes to return error objects.
  Status: documented (not fixed)

Q-10-009  [INFO]  ✅ RESOLVED 2026-06-19 — getSourceMetadata returns {success:false} on a missing row (see CHANGELOG.md). `getSourceMetadata` always returns `{success:true}` even when the source row is missing  — `generator-actions.ts:35`
  Evidence: no null check on the found row; `subjectId`/`strandId` simply come back `undefined`. Callers (`GeneratorsClient.tsx:103`) treat success as authoritative.
  Impact: a non-existent / cross-org id silently yields empty metadata rather than an error; combined with Q-10-001, no signal that the id was invalid.
  Status: documented (not fixed)

Q-10-010  [MED→🔻LOW]  `generateLearningTool` plain-`db` write + unverified caller-supplied context ids  — `generate-tool.tsx:121,199`; lineage ids `:53-63,66-77,130-134,208-213`
  Split into two sub-claims and disposed separately (Session 19, 2026-06-20):
  • **Sub-claim 1 (plain-`db` write) ✅ RESOLVED** — both `db.resource.create` (`:121`,`:199`) now run
    through `withTenant((tx)=>tx.resource.create(...), undefined, {organizationId, userId})`, matching
    `generate-resource-core.ts:763` and the rest of the area. Zero behavior change today (RLS off →
    `withTenant` is a no-op with explicit ctx) and the correct RLS-ready path. `db` import dropped
    (now `withTenant`-only).
  • **Sub-claim 2 (unverified lineage ids) 🔻 RE-GRADED to LOW + ⏳ DEFERRED** with the ch.10 HIGH
    tenancy cluster (Q-10-001/002/003) + the RLS-cutover audit (Q-001, ch.24 §5). A 3-way adversarial
    trace **refuted the "cross-org read leak" impact**: `getMasterContext` re-scopes `studentId`
    (`master-context.ts:450` → null cross-org), `objectiveId` is global `CONTEXT_FREE` spine,
    `getLibraryContext` only returns SESSION-org books/videos (a cross-org `courseId`'s name is
    discarded), and `bookId/videoId/articleId/documentId/courseBlockId` are NOT consumed by any
    sub-fetcher (the unfinished params of [[Q-09-005]], ch.09 §7). So **no cross-org data reaches the
    prompt or caller**. The residual is only that the 5 persisted lineage FK columns
    (`generatedForStudentId`/`generatedFromBookId`/`VideoId`/`ArticleId`/`DocumentId`,
    `:130-134`/`:208-212`) are written from caller ids with no same-org check — a low-value
    integrity/unverified-FK *write* (no read leak; FK checks bypass RLS even when flipped). The proper
    fix is a uniform org-ownership sweep across the whole ch.10 tenancy cluster (one shared
    ownership-check primitive + a reject-vs-drop decision), not a piecemeal patch here
    (partial-sweep-worse-than-uniform). Stays **tracked-OPEN at LOW** (deferred ≠ closed). (see CHANGELOG.md).
  Original evidence: identity correctly from session (`:49`, ignoring `params.organizationId`) + write
  stamps `organizationId`/`createdByUserId` from session — so the WRITE was never cross-tenant; but it
  ran on plain `db.resource.create` (sub-claim 1, fixed), and the lineage ids arrive from `GeneratorForm`
  (URL-param-derived in `[id]/page.tsx`) and persist with no ownership check (sub-claim 2, residual LOW).
  Status: sub-claim 1 ✅ resolved; sub-claim 2 🔻 re-graded LOW + ⏳ deferred (see CHANGELOG.md)

Q-10-012  [HIGH]  ✅ RESOLVED 2026-06-20 (Session 19) — minted-and-fixed (surfaced while tracing Q-10-010's inbound path). `creation-station/[id]/page.tsx` read org-scoped rows by URL-param id with NO org-match guard (cross-org PII read)  — `[id]/page.tsx:95,128,138`
  Evidence: the generator page sanitized `studentId`/`bookId`/`videoId` from `searchParams` and read
  `learner`/`book`/`videoResource` via `withTenant` `findUnique({where:{id}})` — but with RLS OFF
  (`db.ts:9`) `withTenant` doesn't filter and the page applied no app-layer `organizationId` check (it
  didn't even select `organizationId`), then rendered another org's **student name** (`:219`), book
  title (`:247`), and video title (`:257`) + passed them to `ContextBadges`. So an authenticated user
  in org A could read org B's student PII / book / video title by putting a foreign UUID in the URL —
  a live cross-org IDOR (same class as Q-10-001/002/003; the rest of the codebase guards these reads,
  e.g. `getStudentContext:450`).
  Impact: cross-tenant PII/metadata read (gated only on knowing a foreign UUID, which is not enumerable).
  Fix: each of the 3 reads now selects `organizationId` and nulls the row when
  `row.organizationId !== organizationId` (`[id]/page.tsx`, matching the codebase's standard app-layer
  tenant guard). NOTE: the page still forwards the raw URL-param ids to `GeneratorForm` →
  `generateLearningTool` — that lineage-id write path is Q-10-010 sub-claim 2 (deferred LOW), a
  separate surface from these display reads.
  Status: ✅ resolved (see CHANGELOG.md)

Q-10-011  [LOW]  ✅ RESOLVED 2026-06-20 (Session 18) — minted-and-fixed this session (surfaced while verifying Q-10-005). `GeneratorsClient` silently dropped the `sourceId`/`url` deep-link params  — `GeneratorsClient.tsx:51-53,59`
  Evidence: `sourceId` state was initialized only from `searchParams.get("bookId")||"videoId"||"courseId"` (`:52`) and `url` from `useState("")` (`:59`) — but **five** Living-Library list components deep-link to the generator with `?sourceType=X&sourceId=…` (and ArticleList also `&url=…`): `BookList.tsx:125`, `VideoList.tsx:99`, `CourseList.tsx:95`, `DocumentList.tsx:184`, `ArticleList.tsx:167`. Those params were dropped, so the "Use in Generator" buttons opened the right tab with **no source pre-selected**; for URL, the core then mis-used the article id as the URL (`generate-resource-core.ts:629` `url = additionalData.url || sourceId`).
  Impact: broken deep-link source pre-selection across 5 library surfaces (UX regression; no data/security issue).
  Fix: `:52` now also reads `searchParams.get("sourceId")`; `:59` lazy-inits `url` from `searchParams.get("url")`. **Residual (noted, not fixed — needs a `TopicSelector` initial-value prop, beyond this LOW):** ParentDashboard's `?sourceType=TOPIC&topicText=…` quick-create links (`ParentDashboard.tsx:72/77`) still drop `topicText`; RecommendedBooks' `studentId` (`RecommendedBooks.tsx:46`) has no consumer but is harmless (its `bookId` still pre-selects).
  Status: ✅ resolved (see CHANGELOG.md)
