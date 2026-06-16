# 05 — AI Core (models, prompts, schemas, guardrails)

> Code-truth reference. Verified against source on 2026-06-15. Repo prose/markdown docs
> (`.cursor/*`, in-file comments) are stale and are flagged inline where they contradict code.

## Purpose & role in the app

The AI Core is the thin shared layer that every AI-powered feature in QuillNext sits on
top of. It does four things:

1. **Model registry & selection** (`src/lib/ai/config.ts`) — wraps the Vercel AI SDK v5
   `@ai-sdk/google` provider into a small set of named Gemini model instances and exposes
   helpers that pick a model per task type / complexity, plus the embedding model.
2. **Prompt construction** — two *unrelated* prompt builders:
   - `src/lib/ai/prompt-builder.ts` — a synchronous fluent `PromptBuilder` class (the
     "Inkling 2.0" persona builder) used by the resource generator.
   - `src/lib/utils/prompt-builder.ts` — async DB-backed functions that pull Academic
     Spine / student / family / master context out of Prisma and stitch a prompt string.
3. **Output contracts** — Zod schemas for structured generation (`src/lib/ai/schemas.ts`)
   and generator/tool type definitions (`src/lib/types/tools.ts`).
4. **Guardrails / persona** — the Inkling identity + ethical constants
   (`src/lib/constants/ai-guardrails.ts`).

Plus a video helper module (`src/lib/ai/video-processing.ts`) for YouTube ingestion and a
non-authoritative model-selection guide (`src/lib/ai/model-selection.md`).

The actual `generateObject` / `generateText` / `streamUI` / `embed` *call sites* live in
OTHER subsystems (server actions, API routes, Inngest jobs) — see Cross-links. This layer
provides the building blocks only; it does not itself call auth or Prisma except inside
`src/lib/utils/prompt-builder.ts`.

---

## File-by-file reference

### `src/lib/ai/config.ts` — model registry & selection
- **Role:** Central source of truth for which Gemini models exist and which model a task
  uses. Pure module-level config; no `"use server"`/`"use client"` directive (it is a
  server-importable plain TS module — it mutates `process.env`, so it must only ever run
  server-side).
- **Provider shim** (`config.ts:3-6`): if `GOOGLE_GENERATIVE_AI_API_KEY` is unset but
  `GEMINI_API_KEY` exists, it copies the latter into the former at import time. The AI SDK
  Google provider reads `GOOGLE_GENERATIVE_AI_API_KEY`. This is the only env handling.
- **`models`** (`config.ts:9-15`) — the registry:
  | key | Gemini model id | notes |
  |---|---|---|
  | `pro3` | **`gemini-3.1-pro-preview`** | structured / high-complexity tier (`getStructuredModel`, `COMPLEX_CONTENT_GENERATION`, `COURSE_STRUCTURE_DESIGN`, video tasks). ⚠️ **PREVIEW-only — no stable channel**, but **wrapped in `withRetirementFallback` → auto-retries the same call against stable `gemini-2.5-pro` on a retirement-shaped error (404/"not found"/`NoSuchModelError`)**, so a silent retirement degrades instead of breaking `generateObject`. Set 2026-06-16; live-verified incl. the fallback path. |
  | `pro` | **`gemini-3.1-pro-preview`** | identical to `pro3` — both resolve to the same model. |
  | `flash` | **`gemini-3.5-flash`** | workhorse / **default** (`getDefaultModel()` + `getModelForTask` fallback + most task mappings). Bumped from `gemini-2.5-flash` on 2026-06-16; live-verified for text + structured outputs. |
  | `flashLite` | **`gemini-3.1-flash-lite`** | cheap/fast low-complexity tier + the **safety-scan `generateObject`** (`lib/safety/guard.ts`). Stable channel. Bumped from `gemini-2.5-flash-lite` on 2026-06-16; live-verified for text + structured outputs. |
  | `imageGen` | **`gemini-3-pro-image`** | "Nano Banana Pro" image generation. ⚠️ NOT Imagen — it's a Gemini image-output model driven via `generateText` + `providerOptions.google.responseModalities:["IMAGE"]` (image returned in `result.files`), not `experimental_generateImage`. Stable. Renamed from `imagen` / `imagen-3.0-generate-001` on 2026-06-16; live-verified (produces real JPEG). |
- **`TaskComplexity`** enum (`config.ts:20-24`): HIGH / MEDIUM / LOW.
- **`AITaskType`** enum (`config.ts:29-54`): 20 task types grouped high/medium/low.
- **`taskModelMap`** (`config.ts:59-85`): maps each `AITaskType` to a model. Important
  deviations from the comments and from `model-selection.md`:
  - `PERSONALITY_PROFILING` and `LEARNING_STYLE_ANALYSIS` are mapped to **`models.flash`**,
    not pro3 — explicitly "Downgrade to Flash for reliability" (`config.ts:62-63`). The
    markdown guide still claims these use "Gemini 3 Pro" (stale).
  - `COMPLEX_CONTENT_GENERATION`, `MULTI_STEP_REASONING`, `COURSE_STRUCTURE_DESIGN`,
    `VIDEO_PROCESSING`, `VIDEO_BASED_CONTENT` → `pro3` (= 2.5-pro).
  - All medium tasks → `flash`; all low tasks → `flashLite`.
- **Selection helpers:**
  - `getModelForTask(taskType)` (`config.ts:91-93`) — map lookup, defaults to `flash`.
  - `getModelByComplexity(complexity)` (`config.ts:98-107`) — HIGH→pro3, MEDIUM→flash,
    LOW→flashLite. **No call sites found in app code** (only referenced in `.md` docs).
  - `getDefaultModel()` / `getStructuredModel()` / `getGenerativeUIModel()`
    (`config.ts:113-123`) — labelled "Legacy functions for backward compatibility".
    **All three are dead** — defined but never imported anywhere in `src/`.
  - `getModelForTaskWithVideoCheck(taskType, content?)` (`config.ts:148-159`) — if
    `content` matches a YouTube URL, force `pro3`; else `getModelForTask`. Used by the
    generative-UI server action.
- **`embeddingModel`** (`config.ts`): `google.textEmbeddingModel("gemini-embedding-2")` (stable,
  multimodal; set 2026-06-16, was `text-embedding-004`). Calls go through `embeddingProviderOptions(taskType)`
  which pins `outputDimensionality: EMBEDDING_DIMENSIONS` (**1536**) and sets asymmetric `taskType`
  (RETRIEVAL_DOCUMENT for stored content, RETRIEVAL_QUERY for searches). Output is unit-normalized at
  every size, so cosine works directly. The pgvector columns are dimensionless `vector`, so 1536 is
  enforced only in app code. Live-verified (1536-dim, correct semantic ordering).
- **`containsYouTubeUrl(content)`** (`config.ts:135-138`) — regex test for youtube.com/
  youtu.be / embed URLs (11-char id). Same regex is duplicated in `video-processing.ts`.

### `src/lib/ai/prompt-builder.ts` — `PromptBuilder` class ("Inkling 2.0")
- **Role:** Synchronous, in-memory, fluent builder that assembles a single large prompt
  string from the Inkling persona + ethical guardrails + student/family context + task +
  source + pedagogical framework + output guidelines. **No Prisma, no auth, no I/O.**
- **Key export:** `class PromptBuilder` (`prompt-builder.ts:5`). Defaults `identity` to
  `INKLING_BASE_PERSONALITY` and `ethicalGuardrails` to `INKLING_ETHICAL_GUIDELINES`
  (`prompt-builder.ts:6-7`, imported from `ai-guardrails.ts`).
- **Methods:** `setIdentity`, `getIdentity`, `setStudentContext(Student|null)`,
  `setFamilyContext(Classroom|null)`, `setTask`, `setSourceContent`, `setUserInstructions`,
  `build()`. All chainable.
  - `setStudentContext` (`:30-59`) merges `student.support_labels` + comma-split
    `student.learningDifficulties`, dedupes, and renders them as "Helpful Supports &
    Accommodations" (deliberate reframing of "Learning Difficulties"). Age computed from
    `birthdate.getFullYear()` (naive year diff — not birthday-accurate).
  - `setFamilyContext` (`:64-88`) reads `classroom.educationalPhilosophy` (default
    `ECLECTIC`) and `classroom.faithBackground` (default `OTHER`), looks up
    `PHILOSOPHY_PROMPTS[philosophy]` from `@/lib/constants/educational-philosophies`, and
    appends a faith-integration sentence unless faith is `OTHER`/`NONDENOMINATIONAL`.
  - `build()` (`:105-141`) concatenates everything into a Markdown-structured prompt ending
    with OUTPUT GUIDELINES that mandate Markdown/Mermaid and "ALWAYS label the output as a
    draft for parental review".
- **Takes Prisma types** (`Student`, `Classroom` from `@/generated/client`) as inputs but
  does not query — the caller passes already-fetched rows.
- **Single consumer:** `src/app/actions/generate-resource-core.ts` (`:179-190`).

### `src/lib/utils/prompt-builder.ts` — DB-backed async prompt builders
- **Role:** A *separate* set of async functions (NOT the class above) that fetch context
  from Prisma and build prompt strings. This is the file most generators import for context.
- **Server-side** (imports `@/server/db`); no `"use server"` directive (it is a plain lib
  consumed by server actions). **Does NOT call auth/`getCurrentUserOrg`** — it trusts the
  `organizationId`/`studentId` it is handed by the caller.
- **Exports:**
  - `buildSpineAwarePrompt(objectiveId, userInstruction)` (`:40-107`) — loads an
    `Objective` with its full Spine hierarchy (`subtopic→topic→strand→subject`), renders an
    "expert educator" system prompt with the hierarchy, learning objective text, grade
    level, and Bloom's complexity. Throws if objective not found.
  - `buildPersonalizedPrompt(studentId, basePrompt)` (`:113-156`) — loads `Student` +
    `learnerProfile`, reads `learnerProfile.personalityData` JSON
    (`suggestedSystemPrompt`/`communicationStyle`/`primaryDrivers`) and prepends it. Returns
    `basePrompt` unchanged if no personality data.
  - `buildFamilyContextPrompt(organizationId, basePrompt)` (`:162-198`) — loads
    `Organization` with its most recent `Classroom` and injects educational philosophy +
    faith background (and the `*Other` free-text fields). Note: it casts `organization` via
    `as unknown as {...}` (`:176`) — a typing escape hatch, suggesting the Prisma include
    shape isn't fully modeled.
  - `buildCompletePrompt(params)` (`:205-229`) — **`@deprecated`** (`:203`); composes the
    three above. No call sites in app code (only referenced in `.cursor/FEATURES_OVERVIEW.md`,
    which is stale).
  - `buildMasterPrompt(params, options?)` (`:236-291`) — the recommended path. Calls
    `getMasterContext(...)` and `serializeMasterContext(...)` from
    `@/lib/context/{master-context,context-serializer}`, defaulting `maxTokens` 2000,
    `prioritize` `[academic, student, family, library, schedule]`, `modelType` `flash`.
    Used by `generate-tool.tsx` and `grading-actions.ts`.
  - `calculateAge(birthDate)` (`:294-302`) — a correct birthday-aware age helper that is
    **dead code** (declared but never called in this file).

### `src/lib/ai/schemas.ts` — structured-output Zod schemas
- **Role:** Zod schemas for `generateObject` quiz/worksheet generation. Pure data; no I/O.
- **Exports:** `QuizQuestionSchema`, `QuizSchema`, `WorksheetItemSchema`,
  `WorksheetSectionSchema`, `WorksheetSchema`, and type `InteractiveContent`
  (`Quiz | Worksheet` union, `:53`).
  - `QuizQuestionSchema` (`:7-15`): `type` enum MULTIPLE_CHOICE/TRUE_FALSE/SHORT_ANSWER,
    `options?`, `correctAnswer`, `explanation?`, `points` default 1.
  - `QuizSchema` (`:17-26`): title, questions[], optional `gradingScale[]`.
  - Worksheet schemas (`:32-50`): sections of items (TEXT/INPUT_SHORT/INPUT_LONG/CHECKBOX/IMAGE).
- **Single consumer:** `generate-resource-core.ts` (`:200`, `:210`) passes these to
  `generateObject` for `QUIZ`/`WORKSHEET` content types.
- **Note:** `generate-tool.tsx` (the streamUI path) re-declares its own inline quiz/worksheet
  Zod shapes (`generate-tool.tsx:98-108`, `:178-187`) instead of importing these — schema
  duplication / drift risk.

### `src/lib/ai/video-processing.ts` — YouTube helpers
- **Role:** Functions to summarize/extract structured content from YouTube videos via the AI
  SDK, plus URL utility functions. Plain server lib (imports `generateObject`/`generateText`
  from `ai`). No auth, no Prisma.
- **Exports:**
  - `processYouTubeVideo(url)` (`:16-31`) — `generateText` on `models.pro3` for a freeform
    summary. **Dead — no call sites.** (`VideoProcessor.processYouTubeVideo` in
    `src/server/services/video-processor.ts` is a *different*, same-named static method.)
  - `extractVideoContent(url)` → `VideoContent` (`:47-59`) — `generateObject` on
    `models.pro3` with inline `VideoContentSchema` (summary, keyPoints[],
    suggestedActivities[], difficultyLevel enum, subjectAreas[]). **Used** by
    `server/services/video-processor.ts:53` and `app/api/library/videos/[id]/extract/route.ts:38`.
  - `generateVideoQuiz(url, numQuestions=5)` (`:65-76`) — `generateText` on pro3. **Dead.**
  - `isYouTubeUrl(url)` (`:81-84`) and `extractYouTubeVideoId(url)` (`:89-93`) — used by the
    video processor service and `app/api/library/videos/route.ts`.
- **Reliability caveat:** All three generation fns hardcode `models.pro3` with comments
  insisting "Only Gemini 3 Pro supports YouTube". But `pro3` is now **2.5-pro**, and whether
  2.5-pro accepts a bare YouTube URL string in a text prompt (vs. a structured file/video
  part) is unverified — the prompt just inlines the URL as text. See Risks.

### `src/lib/constants/ai-guardrails.ts` — Inkling persona + ethics
- **Role:** Two exported string constants defining the AI persona and safety boundaries.
- **Exports:** `INKLING_BASE_PERSONALITY` (`:9-17`) — "Inkling, an AI Classroom Aide"; tone
  rules (no first-person emotion/opinion). `INKLING_ETHICAL_GUIDELINES` (`:19-24`) —
  5 rules: Parent-Led, Theological Alignment (Nicene Creed / Scripture authoritative), No
  Pastoral Care, No Simulacrum, Transparency (output is a "draft").
- **Consumers:** Imported only by `src/lib/ai/prompt-builder.ts` (the class). The DB-backed
  builders and the streamUI/safety paths do **not** inject these guardrails — see Risks.

### `src/lib/types/tools.ts` — generator/tool type definitions
- **Role:** Zod schemas + inferred types describing generator ("tool") configuration, mostly
  derived from a `GENERATOR_CONTENT_TYPES.YAML` data structure. Pure types; no I/O.
- **Exports:** `GeneratorConfigSchema`/`GeneratorConfig` (`:12-35`; `contentType` enum
  WORKSHEET/TEMPLATE/PROMPT/GUIDE/QUIZ/RUBRIC/LESSON_PLAN/OTHER),
  `AvailableToolsSchema`/`AvailableTools` (`:41-47`), `GeneratorInputSchema`/`GeneratorInput`
  (`:53-63`), `OmniGeneratorToolSchema`/`OmniGeneratorTool` (`:69-79`).
- **Usage:** The *name* `getAvailableTools` exists in `src/server/queries/curriculum.ts:9`,
  but a grep for these exact schema/type symbols found **no importing consumers** — these
  types appear largely unwired (especially `OmniGeneratorTool`, which references a "unified
  generator endpoint with tool selection" that does not clearly exist). Treat as
  aspirational/under-used. See Open questions.

### `src/lib/ai/model-selection.md` — model guide (NON-AUTHORITATIVE)
- Prose guide describing "four Gemini models" including "Gemini 3 Pro". **Stale on multiple
  points:** claims pro3 = Gemini 3 Pro (it is 2.5-pro now); claims personality/learning-style
  tasks use Pro (they use Flash now); pricing/context numbers are unverified. Trust
  `config.ts`, not this file.

---

## Data models & tenancy

Prisma models touched by this subsystem (only `src/lib/utils/prompt-builder.ts` queries):
- **`Objective`** (+ `Subtopic → Topic → Strand → Subject` Spine hierarchy) — read by
  `buildSpineAwarePrompt`; fields used: `code`, `text`, `complexity`, `gradeLevel`.
- **`Student`** (+ `learnerProfile`) — read by `buildPersonalizedPrompt`; `personalityData`
  JSON read for `suggestedSystemPrompt`/`communicationStyle`/`primaryDrivers`. The
  `PromptBuilder` class also consumes `Student`/`Classroom` *types* (passed in, not queried).
- **`Organization`** (+ `classrooms` take 1, newest) — read by `buildFamilyContextPrompt`.
- **`Book` / video resource embeddings** — `embedding Unsupported("vector")?`
  (`schema.prisma:670`, `:720`). Migrations declare the columns as bare `vector` with **no
  dimension** (`prisma/migrations/00000000000001_init/migration.sql:576,617`), so they accept
  any vector length. The `embeddingModel` (gemini-embedding-2, 1536-dim) is consumed by
  `src/lib/utils/vector.ts` to populate these.

**Tenancy posture:** This layer is **NOT org-scoped by itself.** The DB-backed prompt
builders accept `organizationId`/`studentId` as plain arguments and query directly without
verifying the caller owns them. Tenant isolation is therefore entirely the *caller's*
responsibility. The hardened example is `generate-tool.tsx:47-50`, which deliberately ignores
`params.organizationId` and re-derives identity from `getCurrentUserOrg()` (the comment notes
this was an IDOR fix). Other callers of `buildMasterPrompt`/`buildPersonalizedPrompt` must do
the same; this module provides no guardrail.

---

## Entry points & end-to-end flows

There are **two distinct generation paths** in this codebase, both built on AI-SDK v5:

### Path A — `streamUI` / RSC (interactive components)
`generateLearningTool` server action (`src/app/actions/generate-tool.tsx`, `"use server"`):
1. Re-derives `{userId, organizationId}` from `getCurrentUserOrg()` (ignores param org).
2. `getMasterContext(...)` for lineage; `buildMasterPrompt(...)` for the prompt
   (→ `src/lib/utils/prompt-builder.ts`).
3. Picks model via `getModelForTaskWithVideoCheck(taskType, userPrompt)` (auto-upgrades to
   pro3 on YouTube URL).
4. `streamUI({ model, prompt, tools: { generateQuiz, generateWorksheet } })` from
   `@ai-sdk/rsc` — streams React components; the `generate` async generators persist a
   `Resource` row (storageType JSON, with `generationContext` + lineage FKs) and return JSX.

### Path B — `generateObject` / `generateText` (data + markdown)
`generate-resource-core.ts` (`src/app/actions/`):
1. Builds prompt with the **`PromptBuilder` class** (`.setIdentity().setStudentContext(...)
   .setFamilyContext(...).setTask(...).setSourceContent(...).setUserInstructions(...)`).
2. For `QUIZ`/`WORKSHEET` contentType → `generateObject({ model: models.pro3, schema:
   QuizSchema|WorksheetSchema, system: builder.getIdentity(), prompt })`.
3. Otherwise → `generateText({ model: modelToUse /* flash or pro */, tools: { generate_image
   } })`, where the image tool calls the image-generation service (Nano Banana Pro / `gemini-3-pro-image`).

### Other call sites of this layer (all in other subsystems)
- **Embeddings:** `src/lib/utils/vector.ts` uses `embeddingModel` + `embed()` for book/video
  semantic search via raw pgvector SQL (`embedding <=> ...::vector`).
- **Personality/learning-style:** `src/server/ai/personality.ts` uses
  `getModelForTask(PERSONALITY_PROFILING|LEARNING_STYLE_ANALYSIS)` → Flash, with its own
  inline schemas (not `schemas.ts`).
- **Chat:** `src/app/api/chat/route.ts` — `streamText({ model: models.flash })`.
- **Safety guard:** `src/lib/safety/guard.ts` — `generateObject({ model: models.flashLite })`
  for child-safety triage (does NOT use the Inkling guardrails constants).
- **Curriculum compile:** `src/inngest/functions/compile-curriculum.ts` — `generateObject`
  on `models.pro3`.
- **Vision/library scan:** `src/app/api/library/scan/vision/route.ts` — `generateObject` on
  `models.pro3`.
- **Bible study:** `src/server/actions/bible-study.ts` — `generateText` on `models.flash`.
- **Suggest blocks / grading:** `suggest-blocks.ts`, `grading-actions.ts` — `models.flash`.
- **Image generation:** `src/lib/services/image-generation.ts` —
  `generateText({ model: models.imageGen, providerOptions.google.responseModalities:["IMAGE"], imageConfig.aspectRatio })`,
  image extracted from `result.files` (gemini-3-pro-image). (Was a broken `experimental_generateImage({ model: models.imagen as any })` cast — fixed 2026-06-16.)

---

## External dependencies & services

- **`@ai-sdk/google` ^2.0.44** — Gemini provider (`google(...)`, `google.textEmbeddingModel`).
- **`ai` ^5.0.107** — core SDK: `generateObject`, `generateText`, `embed`,
  `experimental_generateImage`, `tool`, `streamText`.
- **`@ai-sdk/rsc` ^1.0.108** — `streamUI` (Path A, generative UI).
- **`@ai-sdk/react` ^2.0.118** — `useChat` (client chat UI, `ThinklingChat.tsx`).
- **`zod` ^4.1.13** — all schemas (Zod v4).
- **Google Gemini API** — auth via `GEMINI_API_KEY` (shimmed to
  `GOOGLE_GENERATIVE_AI_API_KEY` in `config.ts`).
- **`@ai-sdk/openai` ^2.0.77** — **installed but never imported in any source file.** Dead
  dependency / unused provider.
- **Postgres + pgvector** (via Prisma raw SQL) — only reached through embeddings/vector.ts.

---

## Auth / security posture

- **No file in this subsystem calls `getCurrentUserOrg`/auth.** Authn/authz and tenant
  scoping are delegated entirely to callers. The DB-backed `prompt-builder.ts` will happily
  build a prompt for ANY `organizationId`/`studentId` passed to it.
- The one demonstrated safe pattern is `generate-tool.tsx`, which re-derives org from the
  session and treats `params.organizationId` as untrusted (IDOR fix, `:47`). Any new caller
  that forwards a client-supplied org/student id straight into `buildMasterPrompt` /
  `buildPersonalizedPrompt` would reintroduce an IDOR.
- **Prompt-injection surface:** user instructions, source content, and (in
  `buildPersonalizedPrompt`) AI-generated `suggestedSystemPrompt` are concatenated into the
  prompt with no sanitization or delimiting beyond plain headers — a stored personality
  profile can effectively inject system-level instructions.
- **Guardrails are not universally applied.** `INKLING_BASE_PERSONALITY` /
  `INKLING_ETHICAL_GUIDELINES` are injected only via the `PromptBuilder` class (Path B
  resource generation). The streamUI path, chat route, master-prompt path, personality, and
  safety paths do **not** include these guardrails.
- Secrets: API key read from env; the env shim mutates `process.env` at import — safe only
  server-side (module must never be bundled to the client).

---

## Risks, drift, dead-code & half-built

**Model / config drift**
- `models.pro3`/`pro` are now **`gemini-3.1-pro-preview`** (set 2026-06-16; both identical).
  ⚠️ **PREVIEW-only, no stable channel** — but now guarded by **`withRetirementFallback`** (`config.ts`),
  which auto-retries the same call against stable `gemini-2.5-pro` on a retirement 404, neutralizing the
  exact footgun that killed the old `gemini-3-pro-preview`. The legacy `AITaskType`
  comments calling these "Gemini 3 Pro (only model that processes YouTube)" are now roughly accurate
  again, but `model-selection.md` and the embedding-dimension comments remain stale (below).
- `model-selection.md` is stale: says personality/learning-style use Pro (code uses Flash),
  treats Gemini 3 Pro as live, lists unverified pricing/context numbers.
- `getModelByComplexity` referenced only in docs; effectively unused in app code.

**Embedding dimension (resolved 2026-06-16)**
- Previously a drift bug (`text-embedding-004` is 768-dim while the comment claimed 1536). Now
  `gemini-embedding-2` is explicitly stored at **1536 dims** via `outputDimensionality`
  (`embeddingProviderOptions` / `EMBEDDING_DIMENSIONS`), so the comment and behavior agree. The
  pgvector columns remain dimensionless `vector` (no DB constraint), so the only rule is: never mix
  dimensions in a column, and re-embed all rows if `EMBEDDING_DIMENSIONS` changes.

**Dead code**
- `getDefaultModel`, `getStructuredModel`, `getGenerativeUIModel` (`config.ts:113-123`) —
  no importers.
- `processYouTubeVideo` and `generateVideoQuiz` in `video-processing.ts` — no importers.
- `buildCompletePrompt` (`@deprecated`) and `calculateAge` in `utils/prompt-builder.ts` — no
  importers.
- `@ai-sdk/openai` dependency — no importers.
- `src/lib/types/tools.ts` schemas — no importing consumers found (`OmniGeneratorTool` in
  particular looks half-built / aspirational).

**Schema duplication**
- Quiz/worksheet shapes are defined in THREE places: `schemas.ts` (used by
  generate-resource-core), inline in `generate-tool.tsx` (streamUI), and inline
  `VideoContentSchema`/personality schemas elsewhere. Easy to drift.

**Functional risk: YouTube on 2.5-pro**
- Since the retirement note says the 3-pro retirement "broke all generateObject paths" and
  pro3 was repointed to 2.5-pro, the YouTube extraction path (`extractVideoContent`) now runs
  on 2.5-pro with the URL inlined as plain prompt text. Whether 2.5-pro actually ingests a
  YouTube URL this way is unverified in code — this could silently degrade or hallucinate.

**Security**
- No tenancy/auth in this layer (delegated). IDOR risk if callers don't re-derive org.
- Personality `suggestedSystemPrompt` injected verbatim — prompt-injection via stored data.
- Guardrails not applied on chat/streamUI/master-prompt paths.

**Minor**
- `PromptBuilder.setStudentContext` age calc is naive year-diff (off by up to ~1 yr); the
  correct `calculateAge` helper exists but in a different file and is unused.
- Duplicate YouTube regex in `config.ts` and `video-processing.ts`.

---

## Cross-links to other subsystems

- **Context engine** — `@/lib/context/master-context` (`getMasterContext`) and
  `@/lib/context/context-serializer` (`serializeMasterContext`) drive `buildMasterPrompt`.
- **Constants** — `@/lib/constants/educational-philosophies` (`PHILOSOPHY_PROMPTS`) feeds the
  `PromptBuilder` pedagogical framework.
- **Vector search** — `@/lib/utils/vector.ts` (consumes `embeddingModel`; raw pgvector SQL).
- **Generators (server actions)** — `app/actions/generate-tool.tsx` (Path A),
  `app/actions/generate-resource-core.ts` (Path B), `app/actions/suggest-blocks.ts`,
  `app/actions/grading-actions.ts`, `app/actions/process-video.ts`.
- **Server services/AI** — `server/ai/personality.ts`, `server/services/video-processor.ts`,
  `server/actions/bible-study.ts`, `server/queries/curriculum.ts` (`getAvailableTools`).
- **API routes** — `app/api/chat/route.ts`, `app/api/library/videos/route.ts` and
  `.../[id]/extract/route.ts`, `app/api/library/scan/vision/route.ts`.
- **Inngest** — `inngest/functions/compile-curriculum.ts`.
- **Safety** — `lib/safety/guard.ts` (uses flashLite; independent of these guardrails).
- **Image** — `lib/services/image-generation.ts` (gemini-3-pro-image / Nano Banana Pro).
- **Client** — `components/thinkling/ThinklingChat.tsx` (`useChat`),
  `components/generators/GeneratorForm.tsx` (consumes streamUI result).
- **Prisma** — `@/generated/client` types; `@/server/db` for queries.

---

## Open questions

1. Should `pro3`/`pro` aliases and all "Gemini 3 Pro" comments be renamed to reflect 2.5-pro,
   or is a re-upgrade to Gemini 3 planned (in which case keep `pro3` as the upgrade slot)?
2. Does `gemini-3.1-pro-preview` actually process a bare YouTube URL string passed in a text prompt?
   (It supports native Video/PDF input per Google docs, but a URL-in-text is a different path.)
   If not, `extractVideoContent` is silently broken and needs the SDK's video/file part API.
3. ~~Is `text-embedding-004` the intended embedding model?~~ RESOLVED 2026-06-16: swapped to
   `gemini-embedding-2` @ 1536 dims; tables were empty so no legacy vectors exist.
4. Are `src/lib/types/tools.ts` schemas (esp. `OmniGeneratorTool` / the "unified generator
   endpoint") actually planned, or should they be deleted as dead?
5. Should the Inkling guardrails be enforced on ALL generation paths (chat, streamUI,
   master-prompt) rather than only the `PromptBuilder` class?
6. Can the dead `@ai-sdk/openai` dependency and the dead config/video helper functions be
   removed?
