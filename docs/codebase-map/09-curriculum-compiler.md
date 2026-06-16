# 09 — Curriculum Compiler & Inngest Pipeline

> Code-truth reference. Verified against source on 2026-06-15. Where this doc and any prose/README disagree, the code wins. All `file:line` citations are to the commit checked out at writing.

## Purpose & role in the app

The **Curriculum Compiler** is QuillNext's headline bulk curriculum compiler. A teacher fills out a short `CurriculumSpec` (subject, topic, reading level, duration in days, a few engineering constraints). The app persists the spec + an empty `CurriculumBundle` shell, then fires an **Inngest** background event. A durable Inngest function generates a coordinated set of teaching artifacts as inline `Resource` rows (Teacher Guide, Student Packet, Slides, Reading Anthology, Graphic Organizers), runs a **verification gate** that hashes each artifact and asks an LLM to QA the real generated content against the spec, writes a computed **Release Manifest** resource, and marks the bundle `COMPLETED` or `FAILED`.

A completed bundle can then be **"exploded"** into a teacher's `Course`: `explode-bundle.ts` materializes the bundle into a `UNIT` block tree (a "Unit Materials" module with one lesson per artifact, plus a "Daily Lessons" module with one lesson per day).

A second loop ("Patch" workflow) lets a user file a defect report against a `COMPLETED` bundle; that creates a child bundle (lineage via `parentBundleId`, carrying `feedback`) and re-runs the same Inngest function, injecting the defect text into every generation prompt.

The contract that ties the whole subsystem together is a set of **lowercase, underscore `resource_kind` codes** (`teacher_guide`, `student_packet`, `slides`, `reading_anthology`, `graphic_organizers`, `release_manifest`) shared identically across the YAML seed, the Inngest compiler, the explode action, and the UI.

---

## File-by-file reference

### `src/lib/constants/curriculum-kinds.ts` — the shared code contract
- **Role:** Single source of truth for the six canonical `ResourceKind.code` values. Plain module, no directives, importable from client and server.
- **Key export:** `CURRICULUM_KIND_CODES` (`teacher_guide`, `student_packet`, `slides`, `reading_anthology`, `graphic_organizers`, `release_manifest`) and the derived type `CurriculumKindCode` (`curriculum-kinds.ts:10-19`).
- **Notes:** The header comment (`curriculum-kinds.ts:1-9`) states these MUST match the slugs produced by `prisma/seed-generator-content-types.ts` from the "Universal Tools & Templates → Curriculum Design" YAML block, and the codes queried by `compile-curriculum.ts`. **Verified true** — see "The lowercase code contract" below. Imported by `explode-bundle.ts` and `BundleView.tsx`. **Drift caveat:** the Inngest compiler (`compile-curriculum.ts`) hardcodes these same strings as string literals instead of importing this constant, so the casing CAN still drift on the compiler side (see Risks).

### `src/app/creation-station/compiler/SpecForm.tsx` — the spec input form
- **Role / directive:** `"use client"` form component. Collects the `CurriculumSpec` fields and calls `onSubmit`.
- **Key export:** `SpecForm({ onSubmit, isLoading, initialContext })` (`SpecForm.tsx:45`).
- **Validation:** zod schema (`SpecForm.tsx:22-33`): `subject` (min 2), `topic` (min 5), `readingLevel` (min 1), `durationDays` coerced number **1–20**, and a `constraints` object of four booleans: `noDevices`, `lowPrep`, `groupWork`, `visualAid`.
- **Auth/tenancy:** none — pure UI; tenancy is enforced downstream in the server action.
- **Notes / drift:** Only **two** of the four constraint checkboxes are actually rendered — `noDevices` and `lowPrep` (`SpecForm.tsx:139-178`). `groupWork` and `visualAid` exist in the schema/defaults (`visualAid` defaults `true`) but have **no UI control**, so they are submitted at their default values and never editable. `initialContext` prop (`SpecForm.tsx:38-42`) is defined and wired into `defaultValues` but **no caller passes it** (`CreationStationClient` renders `<SpecForm onSubmit isLoading />` only — `CreationStationClient.tsx:86`), so it is dead. `zodResolver(...) as any` and `field: any` casts throughout suppress type-checking.

### `src/app/creation-station/compiler/BundleView.tsx` — the recent-compilations list + refine dialog
- **Role / directive:** `"use client"`. Renders the list of recent bundles with status badges, per-artifact links, and a "Report Defect / Refine" dialog.
- **Key exports:** `BundleView({ bundles })` (`BundleView.tsx:45`); plus internal `RefineBundleDialog`, `StatusBadge`, `ArtifactIcon`.
- **Behavior:**
  - Renders nothing when `bundles.length === 0` (`BundleView.tsx:46`).
  - Status badges (`StatusBadge`, `BundleView.tsx:170-178`) map `COMPILING`→"Building", `COMPLETED`→"Ready", anything else→"Failed".
  - On `FAILED`, surfaces `bundle.failureReason` in a red box (`BundleView.tsx:78-82`).
  - Each artifact links to `/living-library/resource/${res.id}` (`BundleView.tsx:92`) — cross-link to the resource viewer subsystem.
  - `ArtifactIcon` (`BundleView.tsx:180-187`) switches on `res.resourceKind.code` using `CURRICULUM_KIND_CODES` — correctly imports the shared constant.
  - **Refine action:** the "Report Defect / Refine" button appears only when `status === "COMPLETED"` (`BundleView.tsx:71-73`); the dialog calls `patchCurriculumAction(bundleId, feedback)` (`BundleView.tsx:120`).
- **Auth/tenancy:** none in the component; the list it receives is already org-scoped by the page (`creation-station/page.tsx:18-28`), and `patchCurriculumAction` re-checks tenancy server-side.
- **Notes:** `release_manifest` artifacts ARE rendered as chips here (the list includes every resource on the bundle), but `ArtifactIcon` has no case for it so it falls to the default `FileText` icon. The `Bundle` interface here declares `failureReason?` (`BundleView.tsx:13`) but the page's `Bundle` interface in `CreationStationClient.tsx:13-30` does NOT — both are cast with `as any` so it compiles regardless.

### `src/app/creation-station/page.tsx` — server page (entry point)
- **Role / directive:** Server Component (default; uses `auth()`/`db`). Route `/creation-station`.
- **Flow (`page.tsx:7-31`):** `auth()` → redirect `/login` if unauthenticated; `getCurrentUserOrg()` → redirect `/onboarding` if no org; fetch up to **10** most-recent bundles **scoped by `spec.organizationId`** (`page.tsx:18-28`) including `spec` and `resources.resourceKind`; render `CreationStationClient` with `organizationId` + `initialBundles`.
- **Auth/tenancy:** Fully gated. Tenancy enforced via `where: { spec: { organizationId } }`.
- **Notes:** `initialBundles={bundles as any}` cast (`page.tsx:30`).

### `src/app/creation-station/CreationStationClient.tsx` — client shell
- **Role / directive:** `"use client"`. Tabs UI: "Curriculum Compiler" (SpecForm + BundleView) and "Quick Create" (`GeneratorsClient`).
- **Key export:** default `CreationStationClient({ organizationId, initialBundles })` (`CreationStationClient.tsx:37`).
- **Compile handler (`handleCompile`, `CreationStationClient.tsx:41-61`):** calls `compileCurriculumAction(values)`; on success toasts and **`window.location.reload()`** to pull fresh server data (no optimistic update). On error, toasts + `console.error`.
- **Notes:** Not in the "files you own" list but is the host that wires SpecForm/BundleView to the compile action; documented as the immediate caller.

### `src/app/actions/compile-curriculum-action.ts` — compile & patch server actions
- **Role / directive:** `"use server"`. Two exported server actions.
- **`compileCurriculumAction(data)` (`compile-curriculum-action.ts:9-56`):**
  1. `auth()` → throw `"Unauthorized"` if no `session.user.id` (`:16-17`).
  2. `getCurrentUserOrg()` → throw `"No organization found"` if no org (`:19`).
  3. Create `CurriculumSpec` with `organizationId`, `title = "${subject}: ${topic}"`, and the spec fields incl. `constraints` JSON (`:23-33`).
  4. Create `CurriculumBundle` shell with `status: "COMPILING"` (`:36-41`).
  5. `inngest.send({ name: "curriculum/compile", data: { specId, bundleId, organizationId, userId } })` (`:44-52`).
  6. `revalidatePath("/creation-station")`; return `{ success, bundleId }`.
- **`patchCurriculumAction(parentBundleId, feedback)` (`compile-curriculum-action.ts:58-96`):**
  1. Same auth + org checks.
  2. **Tenancy guard:** load parent bundle with `spec.organizationId`; throw if not found or `parent.spec.organizationId !== organizationId` (`:66-71`).
  3. Create a **child** bundle reusing `parent.specId`, setting `parentBundleId` + `feedback`, `status: "COMPILING"` (`:74-81`).
  4. Send the **same** `curriculum/compile` event with the new `bundleId` (`:84-92`).
  5. Revalidate + return.
- **Auth/tenancy:** `compileCurriculumAction` derives `organizationId` from the session so a user can only create specs for their own org. `patchCurriculumAction` additionally verifies the parent bundle belongs to the caller's org. `data.constraints` is typed `any` (`:14`) — passed straight into Prisma JSON unvalidated at this layer (the form's zod schema is the only validation, and it can be bypassed by calling the action directly).
- **Prisma models:** `CurriculumSpec` (create), `CurriculumBundle` (create / findUnique).

### `src/inngest/client.ts` — Inngest client
- **Role:** Creates the shared `inngest` client: `new Inngest({ id: "quillnext", schemas: schema })` (`client.ts:5`). App ID `quillnext`. Imported by every producer (actions) and the function definitions.

### `src/inngest/types.ts` — event schema
- **Role:** Typed event registry via `EventSchemas().fromRecord<Events>()` (`types.ts:33`).
- **Events (`types.ts:27-31`):** `resource/process.document`, `chat/message.sent`, and **`curriculum/compile`**.
- **`CurriculumCompileEvent` payload (`types.ts:18-25`):** `{ specId, bundleId, organizationId, userId }` — note `organizationId`/`userId` are carried **on the event** precisely because Inngest workers have no request session (this is how tenancy survives into the worker).

### `src/inngest/functions/compile-curriculum.ts` — the durable compile pipeline (heart of the subsystem)
- **Role:** `inngest.createFunction(...)` named **`compile-curriculum`**, triggered by `event: "curriculum/compile"` (`compile-curriculum.ts:43-58`).
- **Session-less core adapter (`compile-curriculum.ts:65-80`):** Defines a local `generateResource(...)` that calls **`generateResourceCore`** directly, injecting the event's `organizationId`/`userId`. This is the key "session-less" hop — the worker never calls the browser-facing `generateResource` server action (which would need a session); it calls the un-`"use server"` core with identity that was verified when the event was enqueued. Comment at `:62-64` documents this.
- **Step graph (each `step.run(...)` is a durable, independently-retried, memoized Inngest step):**
  1. **`fetch-context` (`:83-88`):** load `CurriculumSpec` + `CurriculumBundle`. Throws **`NonRetriableError`** if either missing (no point retrying).
  2. **`generate-teacher-guide` (`:91-122`):** find `ResourceKind` code `teacher_guide` (NonRetriable if absent). Build prompt from `readingLevel`, `durationDays`, `constraints`; if `bundle.feedback` present, append a "CRITICAL: this is a refinement… you MUST fix this" instruction. Call `generateResource(specId, "TOPIC", kind.id, prompt, { topicText })`. On success, link the new `Resource` to the bundle via `resource.update({ curriculumBundleId })`. Throws plain `Error("Failed to generate TG")` on failure (retriable). TG is described as "The Source of Truth"; all later artifacts are nominally "derived from TG" via prompt text only.
  3. **`generate-student-packet` (`:125-152`):** code `student_packet` (NonRetriable if absent). Prompt references the Teacher Guide; injects feedback if present. Links result to bundle. Throws on failure (retriable).
  4. **`generate-slides` (`:155-181`):** code `slides`. **If kind not found, returns (skips) silently** (`:158`) — slides are optional. Links result to bundle on success; no throw.
  5. **`generate-reading-anthology` (`:184-213`):** prefers code `reading_anthology`, **falls back to `article`** (`:186-187`); returns `null` if neither exists. On success links to bundle AND overrides `title: "Reading Anthology"`. Optional (returns null, never throws).
  6. **`generate-organizers` (`:216-244`):** prefers `graphic_organizers`, **falls back to `worksheet`** (`:217-218`); returns null if neither. On success links + sets `title: "Charts & Organizers"`. Optional.
  7. **`run-verification-gate` (`:250-365`):** the QA gate (detailed below).
  8. **`finalize-bundle` (`:368-375`):** updates the bundle to `COMPLETED` (clearing `failureReason`) if `verification.gatePassed`, else `FAILED` with `failureReason = "Verification gate failed: ${summary}"` truncated to 1000 chars.
- **Return value (`:377`):** `{ success: true, bundleId, verified }`.

#### The verification gate (`run-verification-gate`, `:250-365`)
- Looks up the `release_manifest` `ResourceKind` (`:251`).
- Pulls **every** generated `Resource` for the bundle **excluding** any with code `release_manifest` (`:254-265`), selecting `storageType`, `content`, and `resourceKind.{code,label}`.
- **Real integrity check:** for each artifact, `extractContentText` (`:34-41`) pulls the meaningful text (`content.markdown` for `MARKDOWN`, else `JSON.stringify`); builds an `artifactReport` with byte size and a **SHA-256** of the content (`:268-278`, helper `sha256` at `:28-30`, `extractContentText` at `:34-41`).
- **Structural gate (`:286-291`):** Teacher Guide and Student Packet text must each be **≥ 200 chars** (`MIN_CHARS`). These two are the only hard structural requirements.
- **Qualitative gate (`:295-319`):** calls `generateObject` with `models.pro3` against `VerificationVerdictSchema` (`:12-26`), feeding the model the spec plus **truncated real content** (TG first 8000 chars, SP first 6000). The model returns `releaseRecommended`, `readingLevelOk`, `durationCoverageOk`, `grayscaleSafe`, a `summary`, and a `defects[]` array. System prompt instructs it to set `releaseRecommended=false` **only** for severe, clearly release-blocking problems (off-topic, wildly wrong reading level, violated hard constraint); minor/stylistic issues must not block. **Fault-tolerant:** if the model call throws, `qa = { unavailable, error }` and **QA does NOT block** (`qaBlocking` stays false) — only structural failures block in that case.
- **Gate decision (`:321-326`):** `blockingReasons[]` accumulates: TG missing/empty, SP missing/empty, and (if `qaBlocking`) the QA summary. `gatePassed = blockingReasons.length === 0`.
- **Manifest (`:328-359`):** builds a JSON object (`schemaVersion: 1`, `buildId = bundleId`, `generatedAt`, echoed `spec`, `artifacts` report, `checks`, `qa`, `gate: { result, blockingReasons }`) and persists it as a new `Resource` of kind `release_manifest` (storageType `JSON`) **only if the `release_manifest` ResourceKind exists** (`:346-359`). Note this `Resource.create` sets `organizationId` + `createdByUserId: userId` from the event (the per-step artifact resources got their org/user via `generateResourceCore`).
- **Returns** `{ gatePassed, summary }` to the finalize step.

- **Failure handling / `onFailure` (`:48-56`):** When Inngest exhausts retries, `onFailure` digs the original `bundleId` out of `event.data.event.data.bundleId` (the wrapped `inngest/function.failed` event) and sets the bundle `status: "FAILED"` with the truncated error as `failureReason`, so a bundle never hangs on `COMPILING`. The `.update(...).catch(...)` swallows secondary failures with a console error.
- **Idempotency posture:** Each `step.run` is memoized by Inngest, so a re-run resumes from the last completed step rather than regenerating earlier artifacts. However, the steps are **not** internally idempotent against partial state — e.g. a re-entry into `run-verification-gate` would create a **second** `release_manifest` Resource (it never dedupes manifests; it only excludes them from the artifact query). The artifact-generation steps create fresh `Resource` rows each time they actually execute. End-to-end idempotency of *adding to a course* is enforced separately in `explode-bundle.ts` (see below).
- **External libs:** `inngest` (`NonRetriableError`), `ai` (`generateObject`), `zod`, `crypto` (`createHash`), `@/lib/ai/config` (`models.pro3`).

### `src/app/api/inngest/route.ts` — Inngest HTTP endpoint
- **Role:** `serve({ client: inngest, functions: [processDocument, scanMessage, compileCurriculum] })` exporting `GET, POST, PUT` (`route.ts:7-14`). This is the webhook Inngest's executor calls to drive each step. **`compileCurriculum` is registered here** — without this, the event would be sent but never executed.
- **Auth/tenancy:** The route itself has no app-level auth (standard for Inngest — it's protected by Inngest's signing key / `INNGEST_SIGNING_KEY` env, not by `auth()`).

### `src/app/actions/explode-bundle.ts` — materialize a bundle into a Course
- **Role / directive:** `"use server"`. Exports `explodeCurriculumBundle(bundleId, courseId)` (`explode-bundle.ts:39`).
- **`MATERIAL_ORDER` (`:31-37`):** canonical artifact order using `CURRICULUM_KIND_CODES` — TG, SP, Slides, Reading Anthology, Graphic Organizers. **`release_manifest` is intentionally excluded** (it's build scaffolding, not classroom material — comment `:30`).
- **Flow:**
  1. `auth()` + `getCurrentUserOrg()` (`:40-44`).
  2. Load bundle (with `spec` + `resources.resourceKind`) and course (`id`, `organizationId`) in parallel (`:47-59`).
  3. Throw if bundle or course missing (`:61-62`).
  4. **Multi-tenant guard (`:67-69`):** both `bundle.spec.organizationId` AND `course.organizationId` must equal the caller's org, else `"Unauthorized"`. (Comment notes this prevents grafting another org's unit or targeting another org's course.)
  5. **Status gate (`:71-73`):** bundle must be `COMPLETED`.
  6. **Idempotency (`:76-82`):** if a `CourseBlock` with `kind: "UNIT"` and matching `sourceBundleId` already exists on the course, throw `"This curriculum unit has already been added to this course."`
  7. **Resolve materials (`:85-96`):** map `MATERIAL_ORDER` → the matching resource by code → `{ resourceId, title }`. **Safety net:** if zero canonical matches but the bundle still has resources, attach all of them by their own titles (prevents an empty unit on code drift).
  8. **Position math (`:105-118`):** find the course's current max `position`; positions are **globally sequential** (the builder renders a flat list ordered by `position`, indentation derived from `kind`). Lays out: UNIT, "Unit Materials" MODULE + one LESSON per artifact, then "Daily Lessons" MODULE + one LESSON per day.
  9. **Atomic write (`$transaction`, `:121-182`):** creates the UNIT block (with `sourceBundleId`), the materials MODULE + lesson blocks (each lesson carries `resourceId` = artifact, since inline `Resource`s can only occupy the `resourceId` slot — see comment block `:9-26`), and the daily MODULE + `durationDays` LESSON blocks titled `Day N: ${topicLabel}`. Every created block stamps `sourceBundleId` for idempotency/lineage.
  10. `revalidatePath` for `/courses/${courseId}` and `.../builder`; returns `{ success, unitId, materialCount, days }`.
- **Auth/tenancy:** Strong — dual-org check + status gate + idempotency.
- **Prisma models:** `CurriculumBundle`, `Course`, `CourseBlock` (findFirst/create/createMany).
- **Key design note (`:9-26`):** Each compiled artifact is an **inline `Resource`** (markdown/JSON) with no Book/Video/Article/Document record, and a `CourseBlock` exposes one slot per resource type where inline Resources can only use `resourceId`; therefore **each artifact gets its own block**. The comment explicitly records that the previous implementation read `tg.book`/`sp.document`/`ra.article` (always null for inline resources) so 4 of 5 artifacts "silently vanished" — this is fixed code, but the comment is the only record of that prior bug.

### `src/app/actions/suggest-blocks.ts` — AI course-outline suggester (adjacent, not core pipeline)
- **Role / directive:** `"use server"`. Exports `suggestCourseBlocks(courseId)` (`suggest-blocks.ts:28`).
- **Flow:** `auth()` (note: checks `session?.user`, not `session.user.id`, `:30`) + `getCurrentUserOrg()`. Load course with last block, `subject`, `strand`, `gradeBand`; **tenancy check** `course.organizationId !== organizationId` → throw (`:49-51`). Build `getMasterContext` + `serializeMasterContext` (max 4000 tokens, "flash" profile). `generateObject` with `models.flash` returns 3–5 `{ title, kind: UNIT|MODULE, description? }` blocks (`:80-93`). Create them sequentially with `position = lastPosition + 1 + i` (`:96-114`). Revalidate builder; return `{ success, blocks }`.
- **Relationship to subsystem:** This is a sibling "AI builds course structure" feature in the same family but is **NOT** part of the compile→explode pipeline (it never touches `CurriculumSpec`/`CurriculumBundle`/Inngest). Called from `CourseBuilder.tsx:556-557`. Documented here because it lives in the owned file list; treat as adjacent.
- **External libs:** `ai` (`generateObject`), `@/lib/context/master-context`, `@/lib/context/context-serializer`, `models.flash`.

---

## Data models & tenancy

(From `prisma/schema.prisma`.)

- **`CurriculumSpec` (`schema.prisma:767-781`):** `organizationId`, `title`, `subject`, `topic`, `durationDays` (default 1), `readingLevel`, `constraints` (Json, required), `bundles[]`. **Tenant key = `organizationId`** (this model directly carries org).
- **`CurriculumBundle` (`schema.prisma:783-797`):** `specId`→`spec`, `parentBundleId` (lineage, **no FK relation defined** — just a nullable String), `feedback` (defect report driving a patch), `status` (**plain `String`**, values `"COMPILING" | "COMPLETED" | "FAILED"` — not a DB enum), `failureReason` (nullable, truncated worker error), `resources[]`, `createdAt`. **Has no own `organizationId`** — tenancy is reached **through `spec.organizationId`** everywhere (page query, picker query, patch/explode guards).
- **`Resource` (`schema.prisma:731-765`):** `organizationId`, `createdByUserId`, `resourceKindId`, `title`, `storageType` (`MARKDOWN`/`JSON`), `content` (Json), and the optional **`curriculumBundleId`** FK (`:761-762`) that links a generated artifact to its bundle. Compiled artifacts are inline Resources (no Book/Video/Article/Document backing). Tenant key = `organizationId`.
- **`ResourceKind` (`schema.prisma:630-648`):** `code` (`@unique`), `label`, `description`, `contentType` (enum), `requiresVision`, optional `subjectId`/`strandId`. The `code` column is the join point for the whole code contract. **Global, not org-scoped** (provisioned by seed).
- **`CourseBlock` (`schema.prisma:518-555`):** `courseId`, `parentBlockId` (self-relation "BlockHierarchy"), **`sourceBundleId`** (`:522`, used for explode idempotency/lineage), `kind` (`CourseBlockKind` enum: `UNIT | MODULE | SECTION | CHAPTER | LESSON`, `:987-993`), `title`, `position` (Int, **globally sequential**), and single-slot attachment FKs `bookId`/`videoId`/`articleId`/`documentId`/**`resourceId`**. Tenancy via parent `Course.organizationId`.

**Tenancy summary:** Every entry point resolves the caller's org via `getCurrentUserOrg()` (which reads `User.organizationId`, `auth-helpers.ts:9-30`). Bundle queries are scoped through `spec.organizationId`. The worker has no session, so the org/user travel **on the Inngest event** and are propagated into `generateResourceCore` and the manifest `Resource.create`. `explode-bundle` performs a dual-org check (bundle's org AND course's org). `CurriculumBundle.status` and `Resource.storageType` checks (≥200 chars) form the structural gate.

---

## Entry points & end-to-end flows

### Flow A — Compile a new bundle (primary)
1. **User** opens `/creation-station` → `page.tsx` gates auth/org, loads 10 recent org bundles, renders `CreationStationClient` (`page.tsx:7-31`).
2. **User** fills `SpecForm` → submits → `handleCompile` → `compileCurriculumAction(values)` (`CreationStationClient.tsx:44`).
3. **Server action** authenticates, creates `CurriculumSpec` + `CurriculumBundle{status:COMPILING}`, sends `curriculum/compile` event with `{specId, bundleId, organizationId, userId}` (`compile-curriculum-action.ts:23-52`); revalidates; client does `window.location.reload()`.
4. **Inngest** delivers the event to `/api/inngest` (`route.ts`), which runs `compileCurriculum`:
   - `fetch-context` → `generate-teacher-guide` → `generate-student-packet` → `generate-slides` → `generate-reading-anthology` → `generate-organizers` (each calling `generateResourceCore`, creating an inline `Resource`, linking `curriculumBundleId`).
   - `run-verification-gate` hashes artifacts, runs the LLM QA, writes the `release_manifest` Resource, computes PASS/FAIL.
   - `finalize-bundle` sets the bundle `COMPLETED` or `FAILED`.
   - On exhausted retries, `onFailure` marks the bundle `FAILED`.
5. **User** reloads `/creation-station`; `BundleView` shows the bundle status + artifact chips linking to `/living-library/resource/{id}`.

### Flow B — Patch / refine a completed bundle
1. In `BundleView`, the "Report Defect / Refine" dialog (only on `COMPLETED`) → `patchCurriculumAction(parentBundleId, feedback)` (`BundleView.tsx:120`).
2. Action verifies parent's org, creates a child `CurriculumBundle{parentBundleId, feedback, status:COMPILING}` reusing the parent's `specId`, fires the **same** `curriculum/compile` event (`compile-curriculum-action.ts:58-96`).
3. The Inngest function runs identically, but `bundle.feedback` causes a "CRITICAL: refinement… you MUST fix this" clause to be appended to every artifact prompt and the QA prompt context.

### Flow C — Explode a completed bundle into a Course
1. In **`CourseBuilder`**, the `ResourcePicker` "My Bundles" tab lists bundles (fetched via `getLibraryResources`, scoped by `spec.organizationId`, `resource-library-actions.ts:100-102`).
2. Selecting a bundle → `onSelectBundle` → confirm → dynamic-imports and calls `explodeCurriculumBundle(bundleId, courseId)` (`CourseBuilder.tsx:688-706`).
3. The action dual-checks org, requires `COMPLETED`, guards against duplicate insertion (`sourceBundleId`), and atomically builds the UNIT/MODULE/LESSON tree (`explode-bundle.ts:39-187`); page reloads to show new blocks.

---

## External dependencies & services

- **Inngest** (`inngest`, `inngest/next`): durable step functions, `NonRetriableError`, event schemas. App id `quillnext`. HTTP endpoint at `/api/inngest`. Relies on `INNGEST_SIGNING_KEY`/`INNGEST_EVENT_KEY` env (standard Inngest setup; not asserted in these files).
- **Vercel AI SDK** (`ai`): `generateObject` (QA verdict, suggest-blocks), `generateText`/`tool` (inside `generateResourceCore`).
- **Google Gemini** (`@ai-sdk/google` via `@/lib/ai/config`): `models.pro3` = `gemini-2.5-pro` (QA gate, structured gen), `models.flash` = `gemini-2.5-flash` (suggest-blocks, default text gen). **Note (`ai/config.ts:10`):** `pro3` was `gemini-3-pro-preview` but was retired by Google ~2026-06 and remapped to `gemini-2.5-pro` because the retirement "broke all `generateObject` paths" — relevant because the QA gate depends on `models.pro3.generateObject`.
- **zod:** `VerificationVerdictSchema`, `SpecForm` schema, suggest-blocks schema.
- **Node `crypto`:** SHA-256 artifact hashing in the gate.
- **Prisma** (`@/server/db`, client at `@/generated/client`): all persistence.
- **`generateResourceCore`** (`src/app/actions/generate-resource-core.ts`): the shared content generator. Uses `PromptBuilder` (Inkling 2.0 persona), pulls the creator's `Classroom` for family/philosophy context, optional `Student` context, and can call `generate_image` (Nano Banana) for markdown artifacts. The compiler passes `sourceType: "TOPIC"` for **all** artifacts (comment `compile-curriculum.ts:106`: "Fallback to TOPIC for now since SPEC isn't in SourceType enum yet").

---

## Auth / security posture

- **All four server actions** (`compileCurriculumAction`, `patchCurriculumAction`, `explodeCurriculumBundle`, `suggestCourseBlocks`) begin with `auth()` + `getCurrentUserOrg()` and derive `organizationId` from the session — clients cannot spoof another org's id into a create.
- **Cross-org reads are blocked:** patch verifies parent bundle org; explode verifies BOTH bundle and course org; suggest verifies course org.
- **Session-less core is deliberately not a server action:** `generateResourceCore` is intentionally NOT `"use server"` (`generate-resource-core.ts:31-37`), so it can't be invoked unauthenticated over the network; identity is always passed by a trusted caller (browser wrapper authenticates; Inngest forwards the event-carried, enqueue-time-verified org/user).
- **Inngest event trust model:** The org/user on `curriculum/compile` are written by the authenticated action; the worker trusts them. Anyone able to forge an event to `/api/inngest` could supply an arbitrary `organizationId`/`userId`. This is gated only by Inngest's signing key, not by app auth — standard but worth noting.
- **`generateResourceCore` source-ownership checks:** for BOOK/VIDEO/COURSE it verifies `organizationId` matches; for `TOPIC` (what the compiler always uses) there is no external object to check, so no additional check applies.
- **Input validation gap:** `compileCurriculumAction(data)` types `constraints: any` and `data` is unvalidated server-side (only the client zod schema guards it). A direct action call could pass arbitrary JSON / out-of-range `durationDays`, which then drives `explode-bundle`'s day-loop (`Array.from({length: duration})`).

---

## Risks, drift, dead-code & half-built

1. **Compiler hardcodes the code strings instead of importing `CURRICULUM_KIND_CODES`.** `compile-curriculum.ts` queries `"teacher_guide"`, `"student_packet"`, `"slides"`, `"reading_anthology"`, `"graphic_organizers"`, `"release_manifest"` as **string literals** (`:93,126,156,186,217,251,280-281`), while `explode-bundle.ts` and `BundleView.tsx` import the constant. The `curriculum-kinds.ts:1-9` comment claims the constant exists "so the casing can't drift apart again," but the compiler is the most code-truth-critical consumer and does **not** use it — casing CAN still drift on the producing side.
2. **`SpecForm` constraints partially unwired.** `groupWork` and `visualAid` are in the zod schema/defaults but have no rendered control (`SpecForm.tsx:139-178`); they always submit at defaults (`visualAid:true`, `groupWork:false`). The constraints object flows verbatim into prompts and the manifest, so the model sees constraints the user can't actually set.
3. **`SpecForm.initialContext` is dead.** Defined and wired to defaults (`SpecForm.tsx:38-60`) but no caller passes it.
4. **No live progress / polling.** After compile, the UI just `window.location.reload()`s (`CreationStationClient.tsx:53`); there's no subscription to bundle status. A `COMPILING` bundle only updates when the user manually reloads. `BundleView` shows a spinner for `COMPILING` with zero resources but never refreshes itself.
5. **`CurriculumBundle.status` is a free `String`, not an enum** (`schema.prisma:791`). Typo-prone; the gate writes exact literals and the UI string-matches them. `parentBundleId` is a bare String with **no FK** (`:788`), so lineage integrity is unenforced at the DB.
6. **Possible duplicate `release_manifest` on step re-entry.** The gate excludes manifests from the artifact query but never dedupes before creating a new one (`:346-359`); if `run-verification-gate` re-executes after a partial failure, a second manifest Resource can be created. Likewise artifact-gen steps create new Resources on each actual execution.
7. **`generate-slides`/`reading_anthology`/`graphic_organizers` silently no-op** when their `ResourceKind` is missing or returns null. A bundle can be marked `COMPLETED` with only TG+SP. Functionally acceptable (gate only requires TG+SP) but means "Slides" etc. can silently never appear with no surfaced reason.
8. **QA fault-tolerance can pass weak content.** If `models.pro3.generateObject` throws, qualitative QA is marked `unavailable` and does NOT block (`:317-319`); only the ≥200-char structural check stands between a broken bundle and `COMPLETED`. Given the recent `pro3` model retirement (`ai/config.ts:10`), this is a live concern.
9. **`durationDays` capped at 20 in the form but unbounded in the action/explode.** The zod cap (`SpecForm.tsx:26`) is client-only; `explode-bundle` will happily create `durationDays` day-lesson blocks for any value passed directly to the action.
10. **`suggestCourseBlocks` auth slightly weaker** than its siblings — checks `session?.user` not `session?.user?.id` (`suggest-blocks.ts:30`); benign given org check follows, but inconsistent.
11. **`SECTION`/`CHAPTER` block kinds unused by explode.** Explode only emits `UNIT`/`MODULE`/`LESSON`, which is fine, but the builder's flat-position model means a bad max-position read could collide positions (handled here via `lastBlock.position + 1`).
12. **Type-safety escape hatches:** `as any` casts on bundles in `page.tsx:30`, `CreationStationClient`, and `SpecForm`'s `field: any`/`zodResolver as any` hide schema mismatches (the two `Bundle` interfaces differ on `failureReason`).

---

## Cross-links to other subsystems

- **Resource generation core** — `src/app/actions/generate-resource-core.ts` (session-less) and its browser wrapper `src/app/actions/generate-resource.ts`. The compiler depends entirely on `generateResourceCore` for every artifact. Persona/context come from `PromptBuilder`, `Classroom`, `Student`.
- **Course Builder** — `src/components/courses/CourseBuilder.tsx` is the consumer of both `explodeCurriculumBundle` (`:688-706`) and `suggestCourseBlocks` (`:556-557`), via `ResourcePicker` (`src/components/courses/ResourcePicker.tsx`) which lists bundles from `getLibraryResources`.
- **Resource library** — `src/app/actions/resource-library-actions.ts` `getLibraryResources` returns org-scoped `bundles` (via `spec.organizationId`, `:100-102`) for the picker. **Note:** it does NOT filter by `status: COMPLETED`, so the picker can show in-progress/failed bundles; the COMPLETED gate is enforced only in `explode-bundle`.
- **Living Library / Resource viewer** — `src/app/living-library/resource/[id]/page.tsx` is where artifact chips in `BundleView` link (`/living-library/resource/{id}`).
- **Seed / provisioning** — `prisma/seed-generator-content-types.ts` + `prisma/data/GENERATOR_CONTENT_TYPES.YAML` create the six `ResourceKind` rows that the compiler queries by code. Verified below.
- **Other Inngest functions** (siblings, not owned): `src/inngest/functions/process-document.ts`, `src/inngest/functions/safety-scan.ts` — registered alongside `compileCurriculum` in `route.ts`.
- **Model config** — `src/lib/ai/config.ts` (`models.pro3`, `models.flash`).

### The lowercase code contract (verified)
`prisma/data/GENERATOR_CONTENT_TYPES.YAML:1-8` lists under `Universal Tools & Templates → Curriculum Design`: `Teacher Guide`, `Student Packet`, `Reading Anthology`, `Graphic Organizers`, `Slides`, `Release Manifest`. The seeder's `slugify` (`seed-generator-content-types.ts:219-225`) lowercases and replaces non-alphanumerics with `_`, yielding exactly: `teacher_guide`, `student_packet`, `reading_anthology`, `graphic_organizers`, `slides`, `release_manifest` — **matching `CURRICULUM_KIND_CODES` and the literals in `compile-curriculum.ts`.** The seeder `deleteMany({})`s all `ResourceKind`s first (`seed-...:42`), so this seed must run for the compiler to find its kinds; if it hasn't, `generate-teacher-guide`/`generate-student-packet` throw `NonRetriableError` and the bundle fails immediately.

---

## Open questions

1. **Is the Inngest endpoint signature-verified in prod?** `route.ts` shows no app auth; security depends on `INNGEST_SIGNING_KEY` being set. The env wiring isn't in the owned files — confirm it's configured, since the event carries the org/user used for all writes.
2. **Should the bundle picker hide non-`COMPLETED` bundles?** `getLibraryResources` returns all bundles; only `explode-bundle` enforces COMPLETED. Users can select a FAILED/COMPILING bundle and only learn it's unusable on error.
3. **Is the `release_manifest` ResourceKind guaranteed present?** The gate persists the manifest only `if (manifestKind)`. If the seed's `release_manifest` row is missing, the compile still succeeds but no manifest is written — intended, or a silent gap?
4. **Why does the compiler not import `CURRICULUM_KIND_CODES`?** Appears to be an oversight given the constant was created expressly to prevent drift. Should the literals be replaced with the constant?
5. **Will the `pro3 → gemini-2.5-pro` remap silently degrade QA?** The gate's qualitative judgment depends on `models.pro3`; the model was just swapped. No tests in the owned files exercise the gate.
6. **`SourceType` enum lacks `SPEC`.** The compiler comments note it "falls back to TOPIC for now" (`compile-curriculum.ts:106`). Is adding a `SPEC` source type planned, and would it change how artifacts derive from the spec vs. free-text topic?
