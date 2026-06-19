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
- **Two generation back-ends, not one.** `generateResourceCore` (the 784-line pipeline) is the heavy path used by Quick Create and the Inngest compiler. `generateLearningTool` (`generate-tool.tsx`) is a *separate* streamUI generative-UI path used only by the `[id]` page's `GeneratorForm` — it builds prompts via `buildMasterPrompt` (09-) and persists via plain `db.resource.create`. The two share almost no code.
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
2. `compile-curriculum-action.ts:19` re-validates with `curriculumSpecSchema.parse`, creates spec (`:22`) + bundle (`:35`), sends Inngest event with `{specId, bundleId, organizationId, userId}` (`:43-51`).
3. Inngest `compile-curriculum.ts` (23-) calls `generateResourceCore(...)` per artifact (`compile-curriculum.ts:83`) with the carried org/user.
4. `window.location.reload()` (`CreationStationClient.tsx:53`) re-pulls bundles from `page.tsx:18-33`.

Generative-UI ([id] page): `GeneratorForm.handleSubmit` → `generateLearningTool` (`generate-tool.tsx:17`) → `getCurrentUserOrg` (ignores `params.organizationId`, `:49`) → `getMasterContext`+`buildMasterPrompt` (09-) → `streamUI` with quiz/worksheet tools that `db.resource.create` on plain db (`:121`,`:199`).

## 5. Status table

| Unit | Status | Evidence |
|---|---|---|
| `generateResourceCore` pipeline | DONE | wired from `generate-resource.ts:32` + `compile-curriculum.ts:83` |
| `generateResource` wrapper | DONE | `GeneratorsClient.tsx:10,158` |
| BOOK full-text RAG path | DONE | `generate-resource-core.ts:435-494`, gated on INGESTED |
| SPINE / TOPIC textbook grounding | DONE | `:544-586`, `:587-626` |
| YOUTUBE_PLAYLIST DEEP_VISION tier | PARTIAL | `:642-651` — relies on prompt only; comments admit no real grounding tool wired ("In a real production app… we would enable google_search_retrieval") |
| `generate_image` (Nano Banana) tool | PARTIAL | `:730-742` returns base64 inline; `maxSteps` removed (`:744` "type definition mismatch") so multi-step image use is limited |
| `generateLearningTool` (streamUI) | DONE | `GeneratorForm.tsx:55`; persists `:121`,`:199` |
| `compileCurriculumAction` / `patchCurriculumAction` | DONE | `CreationStationClient.tsx:44`, `BundleView.tsx:120` |
| `explodeCurriculumBundle` | DONE | `CourseBuilder.tsx:692` |
| `suggestCourseBlocks` | DONE | `CourseBuilder.tsx:556` |
| `getSourceMetadata` | DONE | `GeneratorsClient.tsx:102` |
| `SpecForm` / `BundleView` / `SpineBrowser` / `TopicSelector` | DONE | rendered in CreationStation/GeneratorsClient |
| `SourceTypeSelector` exposes FILE | PARTIAL | tab exists (`SourceTypeSelector.tsx:41`) but `GeneratorsClient.tsx:319-323` renders "File upload coming soon..." (no upload) |
| `FileUpload` (SimpleInputs export) | DEAD | imported `GeneratorsClient.tsx:19` but never rendered; FILE branch uses inline placeholder |
| `curriculumSpecSchema` / `clampDurationDays` | DONE | `SpecForm.tsx:22`, `compile-curriculum-action.ts:19`, `explode-bundle.ts:113` |
| `CURRICULUM_KIND_CODES` | DONE | `BundleView.tsx:8`, `explode-bundle.ts:7` |
| `generateResourceSchema` (schemas/actions.ts) | DEAD | zero importers repo-wide (grep: only its definition `actions.ts:109`); generation actions don't validate input with it |
| `GeneratedResourceCard` | DONE | `ResourceList.tsx:6,150` |
| `YouTubeImport` | DONE | `GeneratorsClient.tsx:326` |
| `actions.ts` other schemas | PARTIAL | only `fetchPlaylistSchema`, `deleteStudentSchema`, `searchLibrarySchema`, `deleteBlockSchema`/`updateBlockSchema`/`deleteCourseSchema`, `createPrayerJournalSchema` are imported; the rest (createCourse, createStudent, assignment, grading, bibleStudy, schedule, etc.) have no importers |

## 6. Integration points
- **Imports in**: `@/server/db` (`db`,`withTenant`), `@/auth`, `@/lib/auth-helpers` (`getCurrentUserOrg`), `@/lib/ai/config` (`models`, `getModelForTaskWithVideoCheck`, `AITaskType`), `@/lib/ai/prompt-builder` (`PromptBuilder`), `@/lib/utils/prompt-builder` (`buildMasterPrompt`), `@/lib/ai/schemas` (`QuizSchema`,`WorksheetSchema`), `@/lib/ai/generation-guards`, `@/lib/utils/vector`, `@/lib/sources/registry`, `@/lib/services/image-generation`, `@/lib/context/*` (master-context, serializer, suggestions, smart-defaults), `@/inngest/client`, `@/app/actions/spine-actions`, `@/app/actions/youtube-actions`.
- **Importers out**: `GeneratorsClient` ← CreationStationClient; `generateResourceCore` ← `generate-resource.ts` + `inngest/functions/compile-curriculum.ts`; `explodeCurriculumBundle`/`suggestCourseBlocks` ← `CourseBuilder.tsx`; `GeneratedResourceCard` ← `ResourceList.tsx`; `SourceType` ← SourceTypeSelector.
- **APIs**: `fetch("/api/curriculum/resource-kinds")` (`GeneratorsClient.tsx:83`); Vercel AI SDK (`generateText`/`generateObject`/`streamUI`/`tool`); Gemini (`models.flash/pro/pro3`); Nano Banana image gen; YouTube (`getPlaylistDetails`).
- **Prisma models used**: `ResourceKind`, `Resource`, `Classroom`, `Learner`, `Book`/`BookExtraction`/`BookExtractionSection`, `VideoResource`, `Course`/`CourseBlock`, `Subject`/`Strand`/`Topic`/`Subtopic`/`Objective`, `CurriculumSpec`, `CurriculumBundle`. See 02-data-model.md.
- **Inngest jobs**: emits `curriculum/compile` (compile-curriculum-action.ts:43,83) → consumed in 23-.
- **Env**: none read directly here (AI keys live in `@/lib/ai/config`).

## 7. Findings

Q-10-001  [HIGH]  Org-scoped reads on plain `db` (no tenant predicate) in `getSourceMetadata`  — `generator-actions.ts:13,20,27`
  Evidence: `db.book/videoResource/course.findUnique({ where: { id } })` with NO `organizationId` filter and no `withTenant`. These are org-scoped tables; RLS is OFF (db.ts:9), so the app layer is the only tenant boundary.
  Impact: any authenticated user can probe another org's book/video/course subject+strand ids by id (IDOR-style metadata leak). Low data value but a real cross-tenant read.
  Status: documented (not fixed)

Q-10-002  [HIGH]  `compileCurriculumAction`/`patchCurriculumAction` write org-scoped rows on plain `db`  — `compile-curriculum-action.ts:22,35,65,73`
  Evidence: `db.curriculumSpec.create`, `db.curriculumBundle.create`, `db.curriculumBundle.findUnique` use plain `db`, not `withTenant`. The spec write stamps `organizationId` from session (good), but the create runs outside the tenant transaction; the patch read fetches a bundle by id then checks `parent.spec.organizationId !== organizationId` in app code (`:70`) — correct but relies entirely on app-layer enforcement since RLS is inert.
  Impact: pattern depends on hand-written ownership checks; the bundle creates bypass the RLS GUC path that the rest of the codebase uses (`withTenant`). Inconsistent tenant enforcement, drift risk.
  Status: documented (not fixed)

Q-10-003  [HIGH]  `suggestCourseBlocks` creates CourseBlocks on plain `db` after an app-only ownership check  — `suggest-blocks.ts:36,101`
  Evidence: course loaded via plain `db.course.findUnique` + manual `course.organizationId !== organizationId` (`:49`); `db.courseBlock.create` (`:101`) writes with NO tenant stamp/tx. With RLS off, the only guard is the app check; CourseBlock has no `organizationId` of its own here.
  Impact: relies solely on the manual guard; any logic slip = cross-tenant write. Inconsistent with `explode-bundle` which correctly uses `withTenant`.
  Status: documented (not fixed)

Q-10-004  [MED]  `generateResourceSchema` is DEAD and generation actions perform NO input validation  — `actions.ts:109-121`; `generate-resource.ts:19-44`
  Evidence: grep finds zero importers of `generateResourceSchema`. `generateResource`/`generateResourceCore` accept `sourceId`/`sourceType`/`resourceKindId`/`instructions`/`additionalData` and use them directly (e.g. `additionalData.fileContent`, `url`, `sectionNumber`) with no Zod parse. The dead schema also omits the `SPINE`-level source types and the `subject`/`sectionNumber` fields the code actually uses (schema↔code drift).
  Impact: unbounded/untyped inputs reach the AI pipeline and DB writes; e.g. `instructions` and `fileContent` are unbounded (token-cost / prompt-injection surface), `sourceType` not enum-checked. A validation layer was written but never wired.
  Status: documented (not fixed)

Q-10-005  [LOW]  `FileUpload` imported but never rendered; FILE source is a non-functional placeholder  — `GeneratorsClient.tsx:19,319-323`; `SimpleInputs.tsx:29`
  Evidence: `FileUpload` is imported (`:19`) but the FILE branch renders a static "File upload coming soon..." div; `SourceTypeSelector` still exposes the FILE tab. `fileContent` plumbing exists in `handleGenerate` but can never be populated.
  Impact: dead import + dead UI path; selecting FILE yields a dead end. `generateResourceCore`'s FILE branch (`generate-resource-core.ts:633-637`) is therefore unreachable from this UI.
  Status: documented (not fixed)

Q-10-006  [LOW]  YOUTUBE_PLAYLIST DEEP_VISION "grounding" is prompt-only — no search/vision tool wired  — `generate-resource-core.ts:642-651`
  Evidence: comments state "In a real production app with AI SDK 3.0+, we would enable google_search_retrieval tool here. For this implementation, we will instruct the model strongly." Only the prompt asks the model to "Watch/Search the videos."
  Impact: claimed deep-vision grounding does not actually retrieve video content; output quality for that tier may silently degrade to ungrounded generation.
  Status: documented (not fixed)

Q-10-007  [LOW]  `generateResourceCore` uses `eslint-disable @typescript-eslint/no-explicit-any` and many `any` casts on AI/DB boundaries  — `generate-resource-core.ts:92,287,289,290,736,742,755,757,773`
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

Q-10-010  [MED]  `generateLearningTool` writes Resource rows on plain `db` (no `withTenant`) and trusts caller-supplied context ids unverified  — `generate-tool.tsx:121,199`; lineage ids `:53-63,66-77,130-134,208-213`
  Evidence: identity is correctly taken from the session (`:49`, ignoring `params.organizationId`), and the write stamps `organizationId`/`createdByUserId` from session (`:124-125`,`:201-202`) — so the WRITE is not cross-tenant. But the create runs on plain `db.resource.create`, not the `withTenant` GUC path the rest of the area uses (cf. `generate-resource-core.ts:764`). Separately, the lineage ids (`studentId`/`bookId`/`videoId`/`articleId`/`documentId`/`courseId`/`courseBlockId`/`objectiveId`) arrive from `GeneratorForm` (URL-param-derived in `[id]/page.tsx`) and are forwarded straight into `getMasterContext`/`buildMasterPrompt` and persisted as `generatedFor*`/`generatedFrom*` with NO ownership check — a cross-org id could be threaded into the prompt context / lineage (RLS is OFF — db.ts:9). Whether the context lookups themselves re-scope is 09- territory.
  Impact: tenant-enforcement inconsistency (plain-db write) plus an unverified-foreign-key surface on the generative-UI path; mirrors Q-10-002/003.
  Status: documented (not fixed)
