# 08 — Generators / Inkling Toolkit (Creation Station, single-resource AI generation)

> Code-truth reference. Verified against source on 2026-06-15. Repo prose/markdown docs are stale — everything below is cited to `file:line`.

## Purpose & role in the app

The "Inkling Toolkit" / **Creation Station** is QuillNext's single-resource AI generation product: a parent/teacher picks ONE source (a book, video, course, free topic, URL, file, or YouTube playlist) plus ONE generator template ("ResourceKind") and the platform produces ONE saved `Resource` (markdown or structured JSON), persisted org-scoped and rendered in the Living Library.

There are **two distinct, parallel generation engines** living under the same `/creation-station` umbrella, which is the single most important thing to understand about this subsystem:

1. **"Quick Create" tab** (`GeneratorsClient` → `generateResource` → `generateResourceCore`): the source-centric flow. Builds a prompt with the `PromptBuilder` class (`src/lib/ai/prompt-builder.ts`), runs `generateText`/`generateObject`, saves a `Resource`. This is also the code path the **bulk Curriculum Compiler (subsystem 09)** reuses by calling `generateResourceCore` directly.
2. **`/creation-station/[id]` per-generator page** (`GeneratorForm` → `generateLearningTool`): the context-centric "Generative UI" flow. Builds a prompt with `buildMasterPrompt` + `getMasterContext` (`src/lib/utils/prompt-builder.ts`, `src/lib/context/*`) and **streams React components** via `streamUI`. Only its `generateQuiz`/`generateWorksheet` tools persist a `Resource`.

These two engines do not share prompt building, model selection, context loading, or persistence call sites — only the `Resource`/`ResourceKind` Prisma models. Treat them as siblings, not layers.

The contrast with **subsystem 09 (Curriculum Compiler)**: the Compiler produces a *bundle* of multiple linked resources (Teacher Guide → Student Packet → Slides → Reading Anthology → Organizers) inside an Inngest background worker, but it does so by repeatedly calling **this subsystem's** `generateResourceCore`. So the Inkling Toolkit core is the shared single-resource primitive; the Compiler is an orchestrator on top of it.

---

## File-by-file reference

### Routes & page shells

#### `src/app/creation-station/page.tsx` — server component (no directive; async RSC)
- Role: the `/creation-station` landing page. Auth + tenancy gate, loads recent bundles, renders `CreationStationClient`.
- Auth/tenancy: `auth()` → redirect `/login` if no user (`page.tsx:8-11`); `getCurrentUserOrg()` → redirect `/onboarding` if no org (`page.tsx:13-16`). **Org-scoped.**
- Prisma: `db.curriculumBundle.findMany` filtered by `spec.organizationId`, includes `spec` + `resources.resourceKind`, `take: 10` (`page.tsx:18-28`). This is Compiler data, not Quick-Create data — the landing page leads with the Compiler.
- Note: passes `bundles as any` and types the prop as `any` (`page.tsx:30`) — type hole.

#### `src/app/creation-station/CreationStationClient.tsx` — `"use client"`
- Role: tab shell. Two tabs: **"Curriculum Compiler"** (`SpecForm` + `BundleView`, subsystem 09) and **"Quick Create"** (`GeneratorsClient`, this subsystem). `defaultValue="compiler"` (`CreationStationClient.tsx:72`).
- Calls `compileCurriculumAction` (subsystem 09) on compiler submit (`:44`), then does a hard `window.location.reload()` (`:53`) to refresh server data — acknowledged as a hack in the inline comments (`:49-52`).
- Note: branding mismatch — header says "Creation Station" here (`:66`) while `GeneratorsClient` *also* renders its own "Creation Station" `<h1>` (`GeneratorsClient.tsx:206`), so the Quick Create tab shows the title twice.

#### `src/app/creation-station/GeneratorsClient.tsx` — `"use client"` (the Quick Create UI)
- Role: the full single-resource wizard. Source-type tabs → source input → template (ResourceKind) picker → instructions → Generate.
- Loads the generator catalog client-side via `fetch("/api/curriculum/resource-kinds")` (`:80-85`) — **un-authenticated public GET** (see route below).
- Source types come from `SourceType` union: `BOOK | VIDEO | COURSE | TOPIC | URL | FILE | YOUTUBE_PLAYLIST` (`generator-actions.ts:5`).
- Source selection: BOOK/VIDEO/COURSE use the `ResourcePicker` modal (`:214-240`); TOPIC uses `TopicSelector`; URL uses `UrlInput`; YOUTUBE_PLAYLIST uses `YouTubeImport`.
- Calls `getSourceMetadata(sourceId, sourceType)` to fetch `{subjectId, strandId}` and **client-side filters** the kind list (`filteredKinds`, `:122-137`) so only subject/strand-matching templates show.
- Submit (`handleGenerate`, `:139-181`): client validation, then `generateResource(effectiveSourceId, sourceType, selectedKindId, instructions, additionalData)` (`:161`). `effectiveSourceId` falls back to the url / `"topic"` / `"file"` literal when no library ID exists (`:159`).
- On success links to **`/living-library/resource/${result.resourceId}`** (`:418`) — note this is NOT `/creation-station/[id]`.

##### BUGS / half-built in GeneratorsClient (cite):
- **FILE source is a dead stub.** The card body renders the literal text `"File upload coming soon..."` (`:311`) instead of the real `FileUpload` component (which exists in `SimpleInputs.tsx` and is imported at `:18` but never used). So `fileContent` can never be populated, yet the submit button only requires `file` to be set, and `handleGenerate` validates `fileContent` (`:145`) — FILE generation is effectively unreachable from the UI.
- **`YOUTUBE_PLAYLIST` has no template list path.** The Template picker `filteredKinds` logic and the `hasSource` guard (`:194-200`) never include `YOUTUBE_PLAYLIST`, so even after importing a playlist the source is "incomplete" for the summary/guard logic, even though the source-type tab exists.
- **URL filter quirk:** when `sourceType==="TOPIC"` but a stale `sourceId` lingers, `fetchMetadata` early-returns and clears metadata (`:88-104`) — generally OK but relies on effect ordering.
- The `WizardStep` type is declared but unused (`:32`).
- The Template picker renders `kind.subject.name` as a badge but the `kind.label`/`kind.description` are the meaningful fields; the label is never shown as the title — only the subject badge + description (`:341-345`). Selecting a template is by description only, which is confusing.

#### `src/app/creation-station/[id]/page.tsx` — server component (async RSC)
- Role: the **per-ResourceKind generator page** (the "specialized tool" page), reached by `/creation-station/<resourceKindId>?studentId=…&objectiveId=…&courseId=…&bookId=…&videoId=…`.
- Auth/tenancy: `auth()`→`/login`, `getCurrentUserOrg()`→`/onboarding` (`:24-33`). **Org-scoped for context lookups** but note: it does **NOT** verify the `ResourceKind` belongs to the org (ResourceKinds are global/shared — see model). `db.resourceKind.findUnique({where:{id}})` (`:36-46`); redirect to `/creation-station` if missing (`:48-50`).
- Loads `getMasterContext` + `serializeMasterContext` (2000-token preview) (`:70-76`), `analyzeContextCompleteness` suggestions (`:79`), `getSmartDefaults` (`:86`), and fetches `student/objective/book/video` for sidebar display (all org-relevant, but the student/objective/book/video `findUnique` here are **not org-filtered** — `:94-148` — they trust the URL params; the master-context layer is org-scoped but these display fetches are an IDOR-shaped read of titles/names).
- Renders `GeneratorForm` (the streaming form) plus context sidebar. Shows an explicit AI disclosure badge "Content will be generated by AI (Google Gemini) — review before use" (`:160-163`).
- Callers of this route: `SmartDefaultsSuggestions.tsx:45,54` and `courses/[id]/builder/page.tsx:292` (course builder "create tool" links). It is NOT linked from the Quick Create tab.

#### `src/app/api/curriculum/resource-kinds/route.ts` — Route handler `GET`, `force-dynamic`
- Role: returns the entire `ResourceKind` catalog as JSON (`{kinds}`), `include subject.name`, ordered by label (`:8-17`).
- **Auth/tenancy: NONE.** No `auth()`, no org filter. Any unauthenticated caller can enumerate the full generator catalog. Low severity (catalog is global, non-tenant data — see model), but it is an unauthenticated public endpoint and the only loader for the Quick Create template list.

### Server actions

#### `src/app/actions/generate-resource.ts` — `"use server"`
- Role: the **browser-facing auth wrapper**. `generateResource(sourceId, sourceType, resourceKindId, instructions?, additionalData?)`.
- Auth: `auth()` → throw "Unauthorized" if no `user.id` (`:24-25`); `getCurrentUserOrg(session)` → throw if no org (`:27-28`). Then delegates to `generateResourceCore` with resolved `organizationId`/`userId` (`:30-38`).
- `revalidatePath("/living-library")` after generation (`:40`).
- Signature is intentionally positional to keep existing callers (Creation Station) unchanged (`:13-15` comment).

#### `src/app/actions/generate-resource-core.ts` — **NOT `"use server"`** (plain module)
- Role: the **session-less core generator**. Identity (`organizationId`, `userId`) is a required param, never derived here. Comment at `:31-37` is explicit: not a server action so it is never exposed unauthenticated. Called by (a) `generate-resource.ts` and (b) the Inngest compiler (`compile-curriculum.ts:72`).
- Signature: `generateResourceCore({organizationId, userId, sourceId, sourceType, resourceKindId, instructions?, additionalData?})` (`:15-29, :38`).
- Flow:
  1. Fetch `ResourceKind` (`label, description, contentType, requiresVision`) (`:42-52`).
  2. Fetch the user's first `Classroom` (`createdByUserId === userId`) for philosophy/faith persona (`:55-58`). **Note: classroom lookup is by user, not org — picks an arbitrary classroom the user created.**
  3. Optionally fetch `Student` from `additionalData.studentId` (`:61-66`) — **NOT org-filtered** (`findUnique` by id only).
  4. `ingestionTier = requiresVision ? "DEEP_VISION" : "TEXT_ONLY"` (`:69`).
  5. **Source resolution & org checks** (`:80-175`):
     - BOOK: `db.book.findUnique`, **enforces `book.organizationId === organizationId`** (`:86`). Context = title + summary + ToC.
     - VIDEO: `db.videoResource.findUnique`, **enforces org** (`:100`). Context = title + extractedSummary + extractedKeyPoints.
     - COURSE: `db.course.findUnique`, **enforces org** (`:118`) + course blocks.
     - TOPIC: context = `additionalData.topicText || sourceId` (no DB; `:132-136`).
     - URL: context = the URL with a note that the model will "attempt to access knowledge about this URL" — **no actual fetch/scrape happens here** (`:137-142`). The URL is not retrieved; the model is just told the URL string.
     - FILE: context = `additionalData.fileContent` (`:143-147`). Relies entirely on caller-supplied text (and the UI never supplies it — see GeneratorsClient bug).
     - YOUTUBE_PLAYLIST: DEEP_VISION tier just **prompt-instructs** the model to "watch/search" (no grounding tool actually wired — see `:157-161` admitting this); TEXT_ONLY tier calls `getPlaylistDetails` (`youtube-actions`) for metadata (`:163-174`).
  6. **Prompt** via `PromptBuilder` (`src/lib/ai/prompt-builder.ts`): `.setIdentity()` (default `INKLING_BASE_PERSONALITY`), `.setStudentContext(student)`, `.setFamilyContext(classroom)`, `.setTask(...)`, `.setSourceContent(context)`, `.setUserInstructions(instructions)` (`:179-190`).
  7. **Model + output branch by `contentType`** (`:196-241`):
     - `QUIZ` → `generateObject({model: models.pro3, schema: QuizSchema})`, `storageType="JSON"`.
     - `WORKSHEET` → `generateObject({model: models.pro3, schema: WorksheetSchema})`, `storageType="JSON"`.
     - everything else → `generateText({model: modelToUse /* flash, or pro for playlist deep-vision */})` with a single `generate_image` tool (Nano Banana / Imagen) (`:218-238`), `storageType="MARKDOWN"`.
     - **Half-built:** `maxSteps` for the tool loop is commented out "due to type definition mismatch" (`:237`), so the image tool can be *called* by the model but the multi-step continuation that would normally follow tool calls is disabled — image generation via this tool is effectively unreliable.
  8. **Persist** `db.resource.create` (`:244-257`): `organizationId`, `createdByUserId=userId`, `resourceKindId`, derived `title`/`description`, `storageType`, `content = JSON object | {markdown: text}`, `generatedFromBookId`, `generatedFromVideoId`, `generationContext`. Returns `{success: true, resourceId}`.
  - **Note:** only `generatedFromBookId`/`generatedFromVideoId` lineage is set here; COURSE/TOPIC/URL/FILE/PLAYLIST lineage lives only in the freeform `generationContext` JSON. `generatedForStudentId` is **never** written by this core even when `additionalData.studentId` is passed (drift vs. `generate-tool.tsx`, which does write it).

#### `src/app/actions/generate-tool.tsx` — `"use server"` (the streaming Generative-UI engine)
- Role: `generateLearningTool(params)` — streams React components for the `/creation-station/[id]` page.
- Auth: **derives identity from session** via `getCurrentUserOrg()` (`:49`) and the inline comment (`:47-48`) documents that this was a fixed IDOR — `params.organizationId` is now ignored for writes/context.
- Flow: `getMasterContext(...)` for lineage (`:53-63`) → `buildMasterPrompt(...)` (`src/lib/utils/prompt-builder.ts`) (`:66-77`) → `getTaskTypeFromToolType(toolType)` maps the ResourceKind `code` to an `AITaskType` (`:79-80, :247-269`) → `getModelForTaskWithVideoCheck(taskType, userPrompt)` auto-upgrades to Pro if a YouTube URL is detected (`:84`).
- `streamUI({model, prompt, text, tools})` (`:87-239`): plain text streams into a `<div className="prose">`; two tools — `generateQuiz` and `generateWorksheet` — each yield a loading component, then **persist a `Resource`** (`db.resource.create`, `storageType:"JSON"`, `content: tool data`) IF `resourceKindId` was passed, with full lineage (`generatedForStudentId/Book/Video/Article/Document`, `generationContext: masterContext`) (`:121-137`, `:199-215`), then return the final interactive card.
- **Important divergences from `generateResourceCore`:**
  - Different Zod shapes: the inline `generateQuiz`/`generateWorksheet` schemas here (`:98-108`, `:178-187`) are **not** the `QuizSchema`/`WorksheetSchema` in `src/lib/ai/schemas.ts` that the core uses. Two incompatible quiz/worksheet JSON shapes can both end up in `Resource.content`.
  - Persistence is best-effort: save failures are swallowed (`catch` only `console.error`, "Don't fail the generation if saving fails", `:138-141`, `:216-218`). The streamed UI can succeed while nothing is saved.
  - Markdown/plain-text generations from this path are **never saved** — only the two structured tools persist. So most `/creation-station/[id]` generations are ephemeral.

#### `src/app/actions/generator-actions.ts` — `"use server"`
- Role: `SourceType` type export (`:5`) + `getSourceMetadata(sourceId, sourceType)` (`:7-36`).
- Returns `{subjectId, strandId}` for BOOK/VIDEO/COURSE (else empty). Used by `GeneratorsClient` to filter the template list.
- **Auth/tenancy: NONE.** No `auth()`, no org check — a plain `findUnique` by id (`:13-32`). Leaks `subjectId`/`strandId` for any resource id cross-org. Low severity (those are non-sensitive taxonomy ids) but it is an unauthenticated server action reachable by id.

#### `src/app/actions/resource-library-actions.ts` — `"use server"` (library + delete)
- Role: shared Living-Library data/CRUD. Owns:
  - `getLibraryResources(organizationId)` (`:14-118`): `unstable_cache` (1h, tag `library-${org}`) fetching books/videos/articles/documents/courses/**resources**/bundles, all `where organizationId`/`spec.organizationId`, `take` bounded. The `resources` slice (`:84-99`) is the generated-resource list this subsystem produces. **Tenancy caveat:** `organizationId` is a *caller-supplied argument*, not derived from session inside this function — callers must pass the authenticated org. The cache key is org-scoped so cross-org cache bleed is avoided, but the function itself does no auth.
  - `addArticle` (`:120-158`): server-side cheerio scrape → `Article` row. (Library ingest, adjacent to but not part of generation.)
  - `addDocuments` (`:160-228`): Firebase upload + `DocumentResource` row + Inngest `resource/process.document` dispatch.
  - `deleteBook/Video/Article/Document/**GeneratedResource**` (`:234-258`) → `deleteResource(id, model)` (`:260-291`): **properly auth'd** — `auth()`, `getCurrentUserOrg()`, verifies `resource.organizationId === organizationId` before delete (`:261-285`), then revalidates. `deleteGeneratedResource` is the one used by `GeneratedResourceCard`.
- Note: `deleteResourceSchema` requires `z.string().uuid()` (`:230-232`) — `Resource.id` is `uuid()` so OK.

### Components — generators

#### `src/components/generators/GeneratorForm.tsx` — `"use client"`
- Role: the form for `/creation-station/[id]`. Single textarea → `generateLearningTool({...contextParams, toolType: resourceKindCode, resourceKindId})` (`:55-68`); renders `result.value` (the streamed RSC node) into a card (`:71, :122-130`).
- Passes the whole `contextParams` (incl. `organizationId`) but the action ignores `organizationId` for security (see generate-tool).
- Uses `alert()` for validation/errors (`:47, :73`) — UX smell, not a bug.

#### `src/components/generators/SimpleInputs.tsx` — `"use client"`
- Exports `UrlInput` (used) and `FileUpload` (imported by GeneratorsClient but **never rendered** — dead in practice; see FILE bug). `FileUpload` accepts `.txt,.md,.pdf` (`:33-37`).

#### `src/components/generators/SourceTypeSelector.tsx` — `"use client"`
- 7-way tab selector for `SourceType` (BOOK/VIDEO/COURSE/TOPIC/URL[label "Article"]/FILE/YOUTUBE_PLAYLIST) (`:16-45`). Pure UI.

#### `src/components/generators/TopicSelector.tsx` — `"use client"`
- 3-mode topic input: **SPINE** (cascading Subject→Strand→Topic→Subtopic→Objective selects via `spine-actions`), **FREE** text, **STANDARD** code (`:90-153`).
- Emits `onTopicChange(fullTopic, {subjectId, strandId})` in SPINE mode (`:81`) — this is how the Quick Create flow gets subject/strand metadata for template filtering when no library source exists.
- **Bug smell:** several effects set state then immediately clear dependent arrays in the same effect (e.g. `:38-43` sets strands then `setStrands([])`), relying on async resolution order; brittle cascade. STANDARD mode passes a bare `Standard: <code>` string with no metadata.

### Components — resources (rendering)

#### `src/components/resources/GeneratedResourceCard.tsx` — `"use client"` (no directive line but uses hooks → client)
- Role: card for a generated `Resource` in library lists. Shows title, "AI-Generated" badge, kind label + created date, **View** → `/living-library/resource/${resource.id}` (`:74`), and a **Delete** confirm dialog → `deleteGeneratedResource({id})` (`:37`).
- Renders `ContextLineageDisplay` from `resource.generationContext` (`:112-122`).
- Typed `resource: any` (`:27`).

#### `src/components/resources/MarkdownContent.tsx` — `"use client"`
- Role: renders generated markdown via `react-markdown` + `remark-gfm` + `remark-breaks` (`:11-17`). Used by the resource detail view. (Raw markdown rendered without an explicit sanitizer — react-markdown is safe-by-default for HTML, but note no `rehype-raw`, so embedded HTML is ignored.)

### Resource viewer (cross-subsystem but the render target)

#### `src/app/living-library/resource/[id]/page.tsx` — server component
- Role: the detail view linked by every "View Resource" CTA in this subsystem.
- Auth/tenancy: `auth()`→`/login` (`:22`), `getCurrentUserOrg()`, and a soft `notFound = !resource || resource.organizationId !== organizationId` (`:31`) — **org-scoped read.**
- Render branch: if `storageType==="MARKDOWN"` and `content.markdown` is a string → `MarkdownContent`; otherwise dumps `JSON.stringify(content)` in a `<pre>` (`:55-68`). So **JSON quiz/worksheet resources are shown as raw JSON** — there is no interactive renderer at this route for the structured shapes produced by either engine.

---

## Data models & tenancy

From `prisma/schema.prisma`:

### `ResourceKind` (`schema.prisma:630-648`, table `resource_kinds`)
- The generator *catalog*. Fields: `code` (unique slug), `label`, `description?`, `strandId?`, `subjectId?`, `isSpecialized`, `requiresVision`, `contentType: ResourceContentType`.
- **NOT tenant-scoped** — global/shared across all orgs. This is why the resource-kinds API and `getSourceMetadata` having no org filter is low-severity.
- `requiresVision` drives `ingestionTier` in the core; `contentType` drives the QUIZ/WORKSHEET-vs-markdown branch.
- `code` is what `generate-tool.tsx` maps to an `AITaskType`, and what the Compiler looks up (`teacher_guide`, `student_packet`, `slides`, `reading_anthology`/`article`, `graphic_organizers`/`worksheet`).

### `Resource` (`schema.prisma:731-765`, table `resources`)
- The generated artifact. `organizationId` (`@map account_id`), `createdByUserId`, `resourceKindId`, `title`, `description?`, `storageType: ResourceStorageType`, `content: Json?`, `metadata: Json?`.
- Lineage FKs: `generatedForStudentId?`, `generatedFromBookId?`, `generatedFromVideoId?`, `generatedFromArticleId?`, `generatedFromDocumentId?`, `generationContext: Json?`, plus `curriculumBundleId?` (set only by the Compiler).
- **Tenant-scoped** via `organizationId` (cascade on org delete). All reads in this subsystem filter by org (page-level), deletes verify org.

### Enums
- `ResourceContentType` (`schema.prisma:1029-1037`): `WORKSHEET, TEMPLATE, PROMPT, GUIDE, QUIZ, RUBRIC, OTHER`. Only QUIZ/WORKSHEET trigger structured `generateObject` in the core; the rest → markdown.
- `ResourceStorageType` (`schema.prisma:1052-1059`): `TEXT, MARKDOWN, HTML, JSON, PDF_URL, DOCX_URL`. The core only ever writes `MARKDOWN` or `JSON`.

### `CurriculumBundle` / `CurriculumSpec` (`schema.prisma:767-797`)
- Owned by subsystem 09 (Compiler). The landing page reads bundles; `Resource.curriculumBundleId` links generated resources back to a bundle.

### Catalog source of truth
- ResourceKinds are seeded from `prisma/data/GENERATOR_CONTENT_TYPES.YAML` (787 lines) by `prisma/seed-generator-content-types.ts` (run via `npm run db:seed:generators`). They are **intentionally NOT** seeded by the main `prisma/seed.ts` (`seed.ts:312-314`).
- YAML structure: top-level **subject** keys (e.g. `Bible & Theology`, `Mathematics`, `Science & Nature`, plus a special `Universal Tools & Templates`) → **strand** keys → list of generator **names**. ~13 subject groups; hundreds of generators total.
- The seeder (`seed-generator-content-types.ts`):
  - `deleteMany({})` then rebuild — destructive, "provisioning only" (`:42-43` comment; unsafe once real `Resource` rows reference kinds).
  - `code = slugify(name)` (`:219-225`); `contentType = inferContentType(name)` by keyword (worksheet/template/prompt/guide/quiz/rubric/else OTHER, `:227-236`); `requiresVision = needsVision(name)` by visual keywords (`:238-245`).
  - Fuzzy subject/strand matching; unmatched strands → `strandId=null` but still created (`:144-149`).
- The `Universal Tools & Templates → Curriculum Design` group is exactly the Compiler's kinds: `Teacher Guide, Student Packet, Reading Anthology, Graphic Organizers, Slides, Release Manifest` (`GENERATOR_CONTENT_TYPES.YAML:1-8`).

---

## Entry points & end-to-end flows

### Flow A — Quick Create (source → single resource) [primary]
1. User opens `/creation-station`, clicks **Quick Create** tab → `GeneratorsClient`.
2. Client `fetch("/api/curriculum/resource-kinds")` loads the global catalog (unauth GET).
3. User picks a source type, selects a source (`ResourcePicker` / `TopicSelector` / `UrlInput` / `YouTubeImport`), and a template; `getSourceMetadata` filters templates.
4. Submit → **`generateResource`** (`"use server"`, auth + org) → **`generateResourceCore`** (session-less).
5. Core resolves source content (org-checked for BOOK/VIDEO/COURSE), builds prompt with `PromptBuilder`, runs `generateObject` (QUIZ/WORKSHEET → Gemini 2.5 Pro) or `generateText` (else → Gemini 2.5 Flash, with Nano-Banana image tool).
6. `db.resource.create` (org-scoped) → returns `resourceId`; wrapper `revalidatePath("/living-library")`.
7. UI links to **`/living-library/resource/<id>`** → markdown rendered via `MarkdownContent`, or raw JSON `<pre>` for structured content.

### Flow B — Specialized tool page (context → streamed UI) [secondary]
1. From `SmartDefaultsSuggestions` or the **course builder** (`courses/[id]/builder`), navigate to `/creation-station/<resourceKindId>?studentId=…&objectiveId=…&courseId=…`.
2. RSC page loads master context, context suggestions, smart defaults, renders `GeneratorForm`.
3. Submit → **`generateLearningTool`** (`"use server"`, session-derived org/user) → `buildMasterPrompt` + `getMasterContext` → `streamUI` with Gemini (Pro if YouTube URL detected).
4. Streamed text renders live; if the model calls `generateQuiz`/`generateWorksheet` AND `resourceKindId` is present, a `Resource` (`storageType:"JSON"`, full lineage) is created best-effort.
5. The interactive component renders inline in the form card. **Markdown-only outputs are not persisted.**

### Flow C — Compiler reuse (subsystem 09 → this core)
- `src/inngest/functions/compile-curriculum.ts` defines a local `generateResource` adapter (`:65-80`) that calls **`generateResourceCore`** directly with the org/user carried on the Inngest event, generating each bundle artifact as a `Resource` with `sourceType:"TOPIC"`, then sets `curriculumBundleId` (`:103-233`). This is the only non-browser caller and the reason `generateResourceCore` is deliberately session-less and not `"use server"`.

---

## External dependencies & services

- **Vercel AI SDK** (`ai`, `@ai-sdk/google`, `@ai-sdk/rsc`): `generateText`, `generateObject`, `tool`, `experimental_generateImage`, `streamUI`.
- **Google Gemini** (`@ai-sdk/google`): models in `src/lib/ai/config.ts` — `pro3`/`pro` = `gemini-2.5-pro`, `flash` = `gemini-2.5-flash`, `flashLite` = `gemini-2.5-flash-lite`, `imagen` = `imagen-3.0-generate-001`. API key shim maps `GEMINI_API_KEY`→`GOOGLE_GENERATIVE_AI_API_KEY` (`config.ts:3-6`).
  - **Doc-drift / model history:** comments throughout say "Gemini 3 Pro" but `pro3` was repointed to `gemini-2.5-pro` after `gemini-3-pro-preview` was retired (`config.ts:10`). The `AITaskType` map (`config.ts:59-85`) and `getTaskTypeFromToolType` (`generate-tool.tsx:247-269`) still describe a 3-tier "Gemini 3 Pro for video" story that is now all 2.5.
- **Nano Banana / Imagen 3** image generation: `src/lib/services/image-generation.ts` → `generateNanoBananaImage` returns base64 (no blob storage — embedded as data URL in markdown; `:18-20` admits this is a stopgap).
- **YouTube**: `getPlaylistDetails` (`youtube-actions`) for playlist metadata; `getModelForTaskWithVideoCheck` regex-detects YouTube URLs (`config.ts:135-138`).
- **Zod** schemas: `src/lib/ai/schemas.ts` (`QuizSchema`, `WorksheetSchema`) used by the core; separate inline schemas in `generate-tool.tsx`.
- **PromptBuilder(s)**: `src/lib/ai/prompt-builder.ts` (class, used by core) vs `src/lib/utils/prompt-builder.ts` (`buildMasterPrompt`, used by streaming path).
- **Personality/guardrails**: `src/lib/constants/ai-guardrails.ts` (`INKLING_BASE_PERSONALITY`, `INKLING_ETHICAL_GUIDELINES`), `src/lib/constants/educational-philosophies.ts` (`PHILOSOPHY_PROMPTS`).
- **cheerio** (article scraping in `resource-library-actions.addArticle`), **Firebase admin** + **Inngest** (document ingest), **date-fns**, **react-markdown / remark-gfm / remark-breaks**, **sonner** (toasts), **@phosphor-icons/react**.
- **Prisma 7 / Postgres+pgvector** via `@/server/db`.

---

## Auth / security posture

| Surface | Auth | Org scope | Notes |
|---|---|---|---|
| `generate-resource.ts` (`generateResource`) | ✅ `auth()` | ✅ `getCurrentUserOrg` | Correct wrapper. |
| `generate-resource-core.ts` | ⛔ none (by design) | ✅ trusts passed org; **enforces org on BOOK/VIDEO/COURSE source reads** | Not `"use server"`; never exposed directly. Student fetch (`:61-66`) NOT org-checked. |
| `generate-tool.tsx` (`generateLearningTool`) | ✅ `getCurrentUserOrg` | ✅ ignores `params.organizationId` (fixed IDOR, `:47-49`) | Save is best-effort/swallowed. |
| `generator-actions.ts` (`getSourceMetadata`) | ⛔ none | ⛔ none | Unauth server action; leaks subject/strand ids by resource id. Low severity. |
| `api/curriculum/resource-kinds` | ⛔ none | n/a (global catalog) | Unauth public GET of full catalog. Low severity. |
| `resource-library-actions.deleteResource` | ✅ `auth()` | ✅ verifies `organizationId` match | Correct. |
| `resource-library-actions.getLibraryResources` | ⛔ (relies on caller-passed org) | ✅ all queries filtered by passed org | No internal auth; caller must pass authed org. |
| `creation-station/page.tsx`, `[id]/page.tsx`, `living-library/resource/[id]` | ✅ `auth()`+org | ✅ | `[id]` page's display fetches of student/objective/book/video are by-id only (not org-filtered) — low-severity read IDOR of names/titles. |

Overall: the **write paths are well-guarded** (org enforced on source content and on the resource owner). The soft spots are unauth metadata/catalog reads and a couple of by-id `findUnique` reads on the per-generator page that trust URL params for display-only data.

---

## Risks, drift, dead-code & half-built

1. **FILE source is non-functional from the UI.** GeneratorsClient renders `"File upload coming soon..."` (`GeneratorsClient.tsx:311`) instead of the imported `FileUpload`; `fileContent` is never set, so FILE generation can't run. `SimpleInputs.FileUpload` is dead. (Also the `useEffect` FileReader at `:110-118` never fires because no file input is shown.)
2. **YOUTUBE_PLAYLIST is half-wired.** Source-type tab and import UI exist, the core has a branch, but `hasSource`/template-filter logic never accounts for it, and DEEP_VISION "grounding" is only a prompt instruction — no actual `googleSearchRetrieval` tool is attached (`generate-resource-core.ts:157-161`).
3. **URL source does not fetch the URL.** The core just tells the model the URL string and hopes the model "knows" it (`generate-resource-core.ts:137-142`). No scrape/grounding — output quality for URL is unverifiable. (Contrast: `resource-library-actions.addArticle` *does* scrape with cheerio, but that path is library ingest, not generation.)
4. **Two divergent quiz/worksheet JSON schemas.** Core uses `src/lib/ai/schemas.ts` (`QuizSchema`/`WorksheetSchema` with `questions[]`/`sections[]`); `generate-tool.tsx` uses inline schemas (`questions[]` with `options/correctAnswer`, `problems[]`). Both land in `Resource.content` as `storageType:"JSON"`, so the data model holds incompatible shapes for the "same" content type.
5. **No interactive renderer for JSON resources.** `living-library/resource/[id]/page.tsx:55-68` dumps non-markdown content as raw `JSON.stringify`. Every QUIZ/WORKSHEET generated (from either engine) renders as a JSON blob to the user.
6. **Streaming engine persistence is silent-fail and partial.** `generate-tool.tsx` swallows save errors (`:138-141, :216-218`) and never persists markdown-only outputs — most `/creation-station/[id]` generations are ephemeral, and a "successful" generation may save nothing.
7. **`generateResourceCore` ignores `additionalData.studentId` for lineage.** It loads the student for prompt context but never writes `generatedForStudentId` on the created `Resource` (`:244-257`), unlike `generate-tool.tsx`. Quick-Create resources lose student lineage.
8. **Image tool effectively disabled.** `maxSteps` commented out (`generate-resource-core.ts:237`) means the model can call `generate_image` but the agentic continuation is off; images returned as base64 data URLs (no blob storage) bloat the markdown.
9. **Model doc-drift.** Pervasive "Gemini 3 Pro / only model that processes YouTube" comments (`config.ts`, `generate-tool.tsx`) describe a retired model; everything is now Gemini 2.5 (`config.ts:10`). `PERSONALITY_PROFILING`/`LEARNING_STYLE_ANALYSIS` were silently downgraded to Flash (`config.ts:62-63`).
10. **Destructive catalog seeder.** `seed-generator-content-types.ts:42` `deleteMany({})` on every run; safe only before any `Resource`/`BookGeneratedMaterial` references exist. Re-seeding in prod would orphan `resourceKindId` FKs.
11. **Branding/title duplication & `defaultValue="compiler"`.** Quick Create shows "Creation Station" twice; the landing tab defaults to the Compiler, so the single-resource toolkit is the *secondary* tab. The doc-named brand "Inkling Toolkit" does not appear in code (the persona "Inkling" does, via `INKLING_BASE_PERSONALITY`).
12. **`getSourceMetadata` / resource-kinds GET unauth** (see Auth table) — low severity but real.
13. **`page.tsx` types bundles as `any`** and `GeneratedResourceCard`/`ContextLineageDisplay` are typed `any` — weak typing around the persisted shape.

---

## Cross-links to other subsystems

- **09 — Curriculum Compiler (bulk):** `src/app/creation-station/compiler/*`, `src/app/actions/compile-curriculum-action.ts`, `src/inngest/functions/compile-curriculum.ts`. Consumes `generateResourceCore` (this subsystem's primitive). `CurriculumSpec`/`CurriculumBundle` models; `Resource.curriculumBundleId`.
- **05 — AI Core:** `src/lib/ai/config.ts` (models/task map), `src/lib/ai/schemas.ts`, `src/lib/ai/prompt-builder.ts`, `src/lib/constants/ai-guardrails.ts`, `educational-philosophies.ts`, `src/lib/services/image-generation.ts`.
- **06 — Context Engine:** `src/lib/context/master-context.ts`, `context-serializer.ts`, `context-suggestions.ts`, `smart-defaults.ts`, `src/lib/utils/prompt-builder.ts` (`buildMasterPrompt`) — used by the `/creation-station/[id]` streaming path and the per-generator page sidebar.
- **Living Library:** `src/app/living-library/page.tsx`, `src/app/living-library/resource/[id]/page.tsx` (render target), `src/components/library/ResourceList.tsx`, `src/components/resources/GeneratedResourceCard.tsx`. `getLibraryResources` lives in `resource-library-actions.ts`.
- **Courses:** `src/components/courses/ResourcePicker.tsx` (source picker used by Quick Create), `src/app/courses/[id]/builder/page.tsx:292` (links to `/creation-station/[id]` tools), `CourseBuilder.tsx`.
- **Academic Spine:** `src/app/actions/spine-actions.ts` (`getSubjects/Strands/Topics/Subtopics/Objectives`) — feeds `TopicSelector`.
- **YouTube ingest:** `src/components/creation/YouTubeImport.tsx`, `src/lib/api/youtube.ts`, `src/app/actions/youtube-actions.ts` (`getPlaylistDetails`).
- **Document ingest:** Inngest `resource/process.document`, `src/lib/firebase-admin.ts`.

---

## Open questions

1. Is the `/creation-station/[id]` streaming path (Flow B) considered current, or superseded by Quick Create (Flow A)? They duplicate the entire prompt/model/persistence stack with incompatible quiz/worksheet schemas — which is canonical?
2. Should JSON (quiz/worksheet) resources have a real interactive viewer at `living-library/resource/[id]`, or are these shapes intended for some consumer not yet built (assignments?) — `ResourceAssignment` exists but no renderer was found.
3. Is FILE/URL/YOUTUBE_PLAYLIST generation intended to ship? All three are stubs or non-fetching; if not shipping, the source-type tabs are misleading.
4. The catalog (`ResourceKind`) is global, but generation always feeds the kind's `label`/`description` as the task — are the hundreds of YAML-derived "generators" actually distinct prompts, or is the only real differentiation `contentType` (QUIZ/WORKSHEET vs markdown) + label text? (Code suggests the latter — there are no per-kind prompt templates.)
5. Does anything consume `Resource.metadata`? It is in the schema but never written by either engine.
6. The Compiler passes `sourceType:"TOPIC"` with `sourceId = specId` (a `CurriculumSpec` id) — confirm no place treats that spec id as a real source id (it currently only flows into the TOPIC branch, which ignores it in favor of `topicText`).
