# 06 - AI Context Engine (Master Context, Serializer, Suggestions)

> Code-truth reference. Verified against source on 2026-06-15. Do **not** trust repo
> prose/markdown over the code; everything below cites `file:line`.

## Purpose & role in the app

The AI Context Engine is the cross-cutting service that assembles a structured
**"master context"** about a family/organization, a student, an academic objective,
the library, and the schedule, then **serializes** that structure into a plain-text
prompt block that is fed to AI generation. It is the single source of truth for
"what does Inkling (the AI) know about this family/student before it generates
content."

It has three logical layers:

1. **Aggregation** — `getMasterContext()` and its five sub-fetchers query Prisma and
   return a strongly typed `MasterContext` object (`src/lib/context/master-context.ts`).
2. **Serialization** — `serializeMasterContext()` flattens `MasterContext` into a
   token-budgeted prompt string with priority-aware truncation
   (`src/lib/context/context-serializer.ts`).
3. **UX / completeness** — completeness scoring & actionable suggestions
   (`context-suggestions.ts`, `context-types.ts`), smart defaults
   (`smart-defaults.ts`), and a family of React components that render context
   health, lineage badges, previews, and an inspector page/route.

The real "main" entry point for generation is **`buildMasterPrompt()`** in
`src/lib/utils/prompt-builder.ts` (a consumer in another subsystem), which calls
`getMasterContext` + `serializeMasterContext` and wraps the result in a task prompt.
The master context object is **also persisted as lineage** into
`Resource.generationContext` (JSON) by the generation action, and later rendered by
`ContextLineageDisplay`.

---

## File-by-file reference

### `src/lib/context/master-context.ts` — aggregation core
- **Role:** Aggregates all context sources into one `MasterContext`. This is the
  heart of the subsystem.
- **Server/client:** Server-only in practice (imports `@/server/db`). No
  `"use server"`/`"use client"` directive; it is a plain module imported by server
  components, server actions, and the inspect route.
- **Key exports:**
  - Types: `MasterContextParams`, `FamilyContext`, `StudentContext`,
    `AcademicContext`, `LibraryContext`, `ScheduleContext`, `MasterContext`
    (`:9`–`:205`).
  - `getMasterContext(params)` (`:215`) — orchestrator.
  - `getFamilyContext(orgId)` (`:264`), `getStudentContext(studentId, orgId)`
    (`:360`), `getAcademicContext(objectiveId)` (`:563`),
    `getLibraryContext(orgId, objectiveId?, courseId?)` (`:661`),
    `getScheduleContext(orgId)` (`:845`).
- **Orchestration semantics (`getMasterContext`, `:215`–`:259`):**
  - `family` and `schedule` are fetched in parallel and are **soft** — any throw is
    swallowed with `.catch(() => null)` (`:219`–`:222`).
  - `student` is **hard** only when `studentId` is provided: it is awaited without a
    catch, so a thrown error propagates (`:225`–`:227`). Note: `getStudentContext`
    itself never throws for "not found"/"wrong org" — it returns `null` (see below).
  - `academic` is hard when `objectiveId` is provided (`:230`–`:232`); again
    `getAcademicContext` returns `null` on not-found rather than throwing.
  - `library` is always attempted and soft (`:235`–`:240`).
  - `metadata.contextCompleteness` is derived purely from `!== null` checks
    (`:248`–`:256`) and `generatedAt` is stamped (`:256`).
- **Tenancy (critical):** `getMasterContext` trusts the `organizationId` it is given;
  it does **not** call auth itself. Org scoping is enforced by callers and by the
  individual fetchers:
  - `getStudentContext` re-selects `organizationId` and rejects mismatches:
    `if (!student || student.organizationId !== organizationId) return null;`
    (`:445`–`:447`). This is the only place a student is org-checked.
  - `getFamilyContext`, `getScheduleContext`, `getLibraryContext` all filter Prisma
    `where` by `organizationId` (`:267`, `:864`, book/video/resource queries).
  - **`getAcademicContext(objectiveId)` is NOT org-scoped** (`:563`–`:603`) — it does
    `findUnique({ where: { id: objectiveId } })` with no org filter. Objectives live
    on the shared Academic Spine, so this may be intentional (global standards), but
    it means any authenticated user can resolve any objective id's full hierarchy.
    See Risks.
- **Prisma models touched:** `Organization` → `classrooms` (`Classroom`) →
  `instructors` (`Instructor`), `holidays` (`Holiday`); `Student` → `learnerProfile`
  (`LearnerProfile`), `courseEnrollments` (`CourseEnrollment` → `Course` → `Subject`,
  `Strand`), `activityProgress`, `assessmentAttempts`, `courseProgress`,
  `personalizedResources` (`Resource` → `ResourceKind`); `Objective` →
  `subtopic`→`topic`→`strand`→`subject`; `Book`, `VideoResource`, `Resource`,
  `Course`.
- **Notable correctness/quality issues IN CODE:**
  - **`whatStudentsCall` is dead/hardcoded:** `FamilyContext.instructors[].whatStudentsCall`
    is always set to `null` with a comment that the field "doesn't exist in schema"
    (`:346`). Confirmed: no `whatStudentsCall` exists on `Instructor` in
    `prisma/schema.prisma`. The serializer never reads it anyway.
  - **`bookPreferences` is hollow:** `getStudentContext` fetches matching book **ids**
    only (`:498`–`:509`) then maps them to `{ id, title: "", subject: "" }` with the
    comment "Would need to fetch full book data" (`:551`–`:555`). So
    `StudentContext.bookPreferences` always has empty titles/subjects. The serializer
    does not render `bookPreferences`, so this is currently invisible but is a
    half-built field.
  - **`environment` "parse" is a no-op cast:** `environmentPreferences` is a Prisma
    `Json?` column; the `try/catch` at `:321`–`:327` just does a type assertion
    (`as`) — there's no real parsing, the catch can never fire, and a malformed JSON
    shape would silently flow through.
  - **`currentObjectives` ignores `complexity`/`gradeLevel`:** the student-scoped
    objective select (`:452`–`:474`) omits those fields even though the academic
    select includes them; student objectives are listed by `code`/`text`/subject/strand
    only.
  - **Heavy use of `as any`** to recover nested-select types (`:540`, `:612`, `:691`,
    `:874`, `:895`) — fragile against schema changes; type safety is effectively
    bypassed for the hierarchy walks.
  - **`getMasterContext` ignores `courseBlockId`, `bookId`, `videoId`, `articleId`,
    `documentId`** entirely. They exist on `MasterContextParams` (`:13`–`:18`) and are
    passed through by `buildMasterPrompt`/`generate-tool`, but nothing in this file
    reads them. Library relevance is driven only by `objectiveId`/`courseId`. So
    "generate from this specific book/video" does **not** narrow the master context to
    that resource.
  - **`learningDifficulties` is stored as a CSV string** and split on commas
    (`:519`–`:521`); the `StudentContext` type advertises `string[] | null` but the
    underlying column is a single string.

### `src/lib/context/context-serializer.ts` — MasterContext → prompt string
- **Role:** Converts `MasterContext` into a single prompt-ready string with section
  ordering, optional detail, token estimation, and priority-aware truncation.
- **Server/client:** Pure function module, no DB, no directives. Safe to call
  anywhere server-side; used by server components and `buildMasterPrompt`.
- **Key exports:** `SerializationOptions` (`:17`), `serializeMasterContext(context, options)`
  (`:30`). All section serializers (`serializeFamilyContext`, `serializeStudentContext`,
  `serializeAcademicContext`, `serializeLibraryContext`, `serializeScheduleContext`)
  and helpers (`estimateTokenCount`, `truncateContext`, `getSectionType`,
  `truncateText`, `formatDate`, `formatTime`) are **module-private** (not exported).
- **Behavior:**
  - Default options: `maxTokens = 2000` (`:24`), `includeDetails = true`,
    `prioritize = ["academic","student","family","library","schedule"]` (`:37`),
    `modelType = "flash"` (`:39`).
  - Sections are emitted in `prioritize` order, joined by `\n\n` (`:44`–`:74`).
  - **Philosophy injection:** `serializeFamilyContext` looks up the family's
    `educationalPhilosophy` in `PHILOSOPHY_PROMPTS` (from
    `@/lib/constants/educational-philosophies`) and inlines the full pedagogical
    method block (`:106`–`:109`). This is the bridge between the family's chosen
    philosophy enum and concrete AI instructions (Charlotte Mason / Classical /
    Montessori / Unschooling, etc.).
  - **Token budget & truncation:** `estimateTokenCount` uses the rough `chars/4`
    heuristic (`:323`). If over budget, `truncateContext` (`:330`) splits the text
    into sections, classifies each line's section via `getSectionType` (`:412`),
    sorts sections by the caller's priority order, and greedily keeps high-priority
    sections, truncating the first one that overflows and dropping the rest.
- **Notable issues IN CODE:**
  - **`modelType` is accepted but never used** (`:22`, `:39`) — declared in
    `SerializationOptions`, threaded through `buildMasterPrompt`, but the serializer
    never branches on it. Dead knob; token budgeting is identical for pro3/flash/
    flash-lite.
  - **`getSectionType` is brittle string-matching** (`:412`–`:429`). It keys off
    English header substrings ("ACADEMIC CONTEXT", "Learning Objective", etc.). It
    also references markers that the serializers never emit — e.g.
    `"Communication Style"` (`:416`) — leftover from the older `prompt-builder`
    format. Any header wording change silently breaks priority-aware truncation
    (lines fall through to `"other"` → `priority = -1` from `indexOf`, sorting them
    **first**, ahead of real sections).
  - **`priority = priorities.indexOf(sectionType)` returns `-1` for `"other"`**
    (`:355`); `-1` sorts before `0`, so unclassified/blank lines get the **highest**
    retention priority during truncation. Minor but counter-intuitive.
  - Library section caps: books `slice(0, includeDetails ? 5 : 3)`, videos
    `slice(0, includeDetails ? 3 : 2)`, summaries truncated to 150 chars
    (`:253`–`:276`).

### `src/lib/context/context-suggestions.ts` — completeness scoring + suggestions
- **Role:** Scores context completeness 0–100 across 5 pillars and returns prioritized,
  actionable `ContextSuggestion[]` (deep links to fix gaps).
- **Server/client:** Server module (imports `@/server/db` and `getMasterContext`).
- **Key export:** `analyzeContextCompleteness(organizationId, options?)` (`:11`).
  Re-exports `ContextSuggestion` type from `context-types` (`:4`–`:6`).
- **Scoring (`maxScore = 5`, `:49`):** one point each for family, student, academic,
  library, schedule.
  - **family:** `+1` if `masterContext.family` present; else "Complete Family Blueprint"
    → `/onboarding` (`:52`–`:66`).
  - **student:** if `options.studentId` given, `+1` when student resolves, plus a
    suggestion to complete the personality assessment when `personalityData` missing
    (`:69`–`:83`); if no `studentId`, `+1` when org has ≥1 student via
    `db.student.count` else "Add your students" (`:96`–`:114`).
  - **academic:** if `objectiveId` given, `+1` when academic resolves; else `+1` when
    org has ≥1 course via `db.course.count` else "Create your course list"
    (`:117`–`:150`).
  - **library:** `+1` when `db.book.count > 0`; if also `courseId` given, counts
    subject/strand-relevant books and suggests scanning if zero (`:153`–`:204`).
  - **schedule:** `+1` if `masterContext.schedule` present else "Complete Schedule
    Setup" → `/onboarding?step=2` (`:207`–`:220`).
  - Returns `Math.round((score/5)*100)` and suggestions sorted high→low priority
    (`:222`–`:230`).
- **Null-org path:** if `organizationId` is `null`, returns
  `{ completeness: 0, suggestions: [Complete Family Blueprint → /onboarding] }`
  (`:22`–`:38`). This is why the param type is `string | null`.
- **Notes / drift:**
  - Completeness here is **independent of** `MasterContext.metadata.contextCompleteness`.
    The booleans in metadata count `library` true only when the resolved
    `LibraryContext` is non-null (objective/course-driven), whereas this scorer counts
    library by raw `book.count`. Two different "library complete" definitions exist.
  - Several `actionUrl`s are deep links (`/onboarding`, `/students`, `/courses`,
    `/living-library/scan`, `/students/{id}/assessment`,
    `/onboarding?step=2`) — verify these routes still exist (route repointing was a
    recent commit theme; not validated here).

### `src/lib/context/context-types.ts` — shared suggestion type + impact copy
- **Role:** Defines the `ContextSuggestion` interface (`:2`–`:11`) and
  `getContextImpactDescription(category)` (`:16`), a pure lookup of human-readable
  impact strings per pillar.
- **Server/client:** Pure, isomorphic (no imports). Imported by both server
  (`context-suggestions` re-export) and client (`ContextCompleteness.tsx`).
- **Notes:** `ContextSuggestion.type` union is `"missing" | "enhancement" |
  "opportunity"`, but `analyzeContextCompleteness` only ever emits `"missing"` and
  `"opportunity"` — `"enhancement"` is never produced (though the
  `ContextCompleteness` UI has a code path for it).

### `src/lib/context/smart-defaults.ts` — auto-suggested student/objectives
- **Role:** Heuristic defaults for generator forms: auto-pick a student and suggest
  objectives based on course/org.
- **Server/client:** Server module (`@/server/db`).
- **Key export:** `getSmartDefaults(organizationId, courseId?)` (`:6`).
  - With `courseId`: loads course + enrolled students; auto-selects the student if
    exactly one is enrolled (`:39`–`:41`); fetches up to 10 objectives from the
    course's strand/subject (`:44`–`:74`).
  - Without `courseId`: if the org has exactly one student, suggest that student
    (`:81`–`:90`).
- **Notes / issues:**
  - **Not org-scoped on the course path:** the `courseId` branch does
    `db.course.findUnique({ where: { id: courseId } })` with **no** `organizationId`
    filter (`:26`), and likewise dereferences `course.students[0].studentId` without
    confirming those students belong to the caller's org. A caller passing another
    org's `courseId` could surface that course's student id / objectives. The
    org-scoped branch (no course) is fine.
  - `defaults.suggestedObjectives = objectives as any` (`:77`) bypasses typing.
  - Output type is declared inline; objective shape mirrors what
    `SmartDefaultsSuggestions` consumes.

### `src/app/context/page.tsx` — Context Inspector page (server component)
- **Role:** Server-rendered "Context Inspector" page at route `/context`. Builds the
  master context for the current org (optionally narrowed by `studentId`/`objectiveId`/
  `courseId` query params), serializes it, computes completeness, and hands everything
  to client components.
- **Server/client:** Server component (default export `async`).
- **Auth & tenancy:** Calls `auth()` and redirects to `/login` if no session
  (`:18`–`:21`); resolves `organizationId` via `getCurrentUserOrg()` and redirects to
  `/onboarding` if none (`:27`–`:30`). **Org comes from the session, never from query
  params** — params only supply `studentId/objectiveId/courseId` for narrowing
  (`:23`–`:25`). Properly tenant-safe.
- **Flow:** `getMasterContext` (`:33`) → `analyzeContextCompleteness` (`:41`) →
  `serializeMasterContext` with `maxTokens: 10000` for a fuller preview (`:48`) →
  renders `<ContextCompleteness>` + `<ContextInspectorClient>`.
- **Notes:** Imports `Card*` from ui but the card components are unused in JSX
  (minor dead import).

### `src/app/api/context/inspect/route.ts` — JSON inspect endpoint (POST)
- **Role:** `POST /api/context/inspect` returns the raw `MasterContext` JSON for the
  params in the request body. Used by the standalone `ContextInspector` client
  component.
- **Server/client:** Route handler. `export const dynamic = "force-dynamic"` (`:2`).
- **Auth & tenancy — SECURITY ISSUE:** It checks only that a session **exists**
  (`auth()`, 401 if not, `:9`–`:12`), then does
  `const params = await request.json(); const context = await getMasterContext(params);`
  (`:14`–`:15`). **`organizationId` is taken directly from the request body, not the
  session.** Any authenticated user can POST an arbitrary `organizationId` (and
  `studentId`) and receive that org's family/student/library/schedule context — a
  cross-tenant IDOR. The student fetcher's `organizationId` check does **not** protect
  here because the attacker also controls `organizationId` (passing a matching pair
  passes the check). Contrast with `src/app/actions/generate-tool.tsx:47`–`:49`, which
  was explicitly hardened ("never trust params.organizationId (IDOR)") — that fix was
  **not** applied to this route. See Risks.

### `src/components/context/ContextInspector.tsx` — manual inspector form (client)
- **Role:** `"use client"` form with raw `organizationId`/`studentId`/`objectiveId`
  inputs that POSTs to `/api/context/inspect` and dumps the JSON response
  (`:9`–`:97`).
- **Notes:** Exposes the IDOR above directly in the UI (lets a user type any org id).
  **No call sites found** — only self-references in grep; appears to be an unused/dev
  component. Distinct from `ContextInspectorClient` (the one actually rendered by
  `/context`).

### `src/components/context/ContextInspectorClient.tsx` — inspector view (client)
- **Role:** `"use client"` UI rendered by `/context`. Tabs between **Preview**
  (serialized string), **Raw JSON** (`masterContext`), and **Structured** (per-pillar
  cards) (`:26`–`:187`), plus client-side **Download as Text / JSON** export
  (`:191`–`:228`).
- **Inputs:** receives `masterContext`, `contextPreview`, and ids as props from the
  server page; recomputes a local `contextCompleteness` boolean map from
  `masterContext.* !== null` (`:28`–`:34`) — duplicating the metadata the engine
  already produces.
- **Notes:** Imports `LibraryClient` (`:6`) but never uses it (dead import). Pure
  presentational; no auth/DB.

### `src/components/context/ContextCompleteness.tsx` — context "health" gauge (client)
- **Role:** `"use client"` gauge + 5-pillar checklist with Framer Motion ring,
  per-pillar status (complete/partial/missing) derived from the suggestion list, and
  "Fix" deep links. Rendered on `/context` and elsewhere.
- **Inputs:** `{ completeness: number; suggestions: ContextSuggestion[] }`. Uses
  `getContextImpactDescription` from `context-types` (`:26`, `:194`).
- **Status logic (`getPillarStatus`, `:49`–`:65`):** `missing` → red, `enhancement`
  or `opportunity` → "partial"/yellow, none → complete/green. Since the scorer never
  emits `"enhancement"`, partial states come only from `"opportunity"` suggestions.
- **Pillar labels are renamed for users** (`:67`–`:73`): family→"School Context",
  student→"Student Profile(s)", academic→"Set Courses", library→"Living Library",
  schedule→"Schedule".
- **Note:** This is the **`src/components/context/`** ContextCompleteness — a distinct
  component from the same-named one under `src/app/students/[id]/_components/` (below).
  Two unrelated implementations share the name.

### `src/components/context/ContextBadges.tsx` — lineage badges (client)
- **Role:** `"use client"` pill badges summarizing what a generation was scoped to
  (student / objective→subject>strand / book / video / course) (`:41`–`:108`).
  Returns `null` if nothing is set.
- **Notes:** Takes already-shaped objects (not `MasterContext`). Used in generator
  pages. Sibling to `ContextLineageDisplay` (richer variant).

### `src/components/context/ContextLineageDisplay.tsx` — full lineage panel (client)
- **Role:** `"use client"` panel that renders linked badges (student/objective/book/
  video/course) and, when `showFullContext` and `generationContext` are present, an
  expandable `<details>` dump of the stored generation context
  (`:44`–`:153`). Falls back to "Generated using Family Blueprint only" when no parts.
- **Key consumer:** `src/components/resources/GeneratedResourceCard.tsx:112` passes
  `generationContext={JSON.stringify(resource.generationContext, ...)}` — i.e. this is
  what renders the **persisted** `MasterContext` lineage stored on each generated
  `Resource`.

### `src/components/context/ContextPreview.tsx` — serialized-string preview (client)
- **Role:** `"use client"` collapsible `<pre>` viewer for any serialized context
  string (`:13`–`:54`). Generic; takes `contextString`. Empty-state copy nudges
  onboarding.

### `src/components/context/ContextSuggestionsInline.tsx` — top suggestions (client)
- **Role:** `"use client"` card showing up to `maxSuggestions` (default 3)
  **high-priority** suggestions with impact text and action buttons (`:13`–`:55`).
  Returns `null` if none high-priority.
- **Note:** imports `ContextSuggestion` type from `context-suggestions` (`:6`) rather
  than `context-types`, but it's the same re-exported type.

### `src/components/context/SmartDefaultsSuggestions.tsx` — quick-default CTAs (client)
- **Role:** `"use client"` card that turns `getSmartDefaults` output into 1–2
  deep-link buttons into the generator (`/creation-station/{generatorId}?...`) to
  personalize-for-student or link-to-objective (`:29`–`:85`). Returns `null` if a
  default is already selected / none available.

### `src/app/students/[id]/_components/AIContextPreview.tsx` — student page preview (server)
- **Role:** Server component (no `"use client"`) that renders the serialized context
  preview for a single student with a `data:` download link (`:8`–`:36`).
- **Consumer:** `src/app/students/[id]/page.tsx:117`, fed by
  `serializeMasterContext(masterContext, { prioritize: ["student","academic",...] })`
  where `masterContext` comes from `getStudentMasterContext` (a `cache()`-wrapped
  `getMasterContext`, see cross-links).

### `src/app/students/[id]/_components/ContextCompleteness.tsx` — student-local completeness (server)
- **Role:** **Different** completeness widget (server component) specific to the
  student profile page. Computes a 4-factor score (personality profile, learning
  style, enrolled courses, relevant books) directly from a `StudentWithRelations`
  object — **not** from the engine's `analyzeContextCompleteness` (`:9`–`:24`).
- **Note:** Naming collision with `src/components/context/ContextCompleteness.tsx`.
  This one ignores the 5-pillar org model entirely and uses its own ad-hoc rubric.
  Doc-drift risk: two "completeness" definitions for students.

---

## Data models & tenancy

**Prisma models read by the engine** (all via `@/server/db`, the Prisma client from
`@/generated/client`):

| Context | Models / relations |
|---|---|
| Family | `Organization` → `Classroom` (name, description, `educationalPhilosophy(+Other)`, `faithBackground(+Other)`, school-year dates, `schoolDaysOfWeek`, daily times, **`environmentPreferences` Json**) → `Instructor`, `Holiday` |
| Student | `Student` (firstName/lastName/preferredName/currentGrade/birthdate/`learningDifficulties` CSV/`organizationId`) → `LearnerProfile` (`personalityData`, `learningStyleData`, `interestsData` — all Json) → `CourseEnrollment`→`Course`→`Subject`/`Strand`; `ActivityProgress` (COMPLETED), `AssessmentAttempt` (GRADED), `CourseProgress`, `Resource` (personalizedResources)→`ResourceKind` |
| Academic | `Objective` → `Subtopic` → `Topic` → `Strand` → `Subject` (id/code/name + objective complexity/gradeLevel/sortOrder) |
| Library | `Book` (org-scoped, `extractionStatus = EXTRACTED`), `VideoResource` (org-scoped, EXTRACTED), `Resource` (course-assigned) → `ResourceKind` |
| Schedule | `Classroom` (most recent by `createdAt`) + `Holiday`; derives `currentWeek`/`totalWeeks` from school-year dates |

**Tenancy model:** the engine itself takes `organizationId` as a trusted input.
Correct enforcement lives in the **callers** that derive org from the session
(`getCurrentUserOrg`) and in per-fetcher `where: { organizationId }` filters. The two
gaps are: (a) `getAcademicContext` is global (objective id only), and (b) the
`/api/context/inspect` route trusts a body-supplied `organizationId` (cross-tenant
IDOR). `getSmartDefaults`'s course path is also unscoped.

---

## Entry points & end-to-end flows

**Flow A — AI generation (primary, the real consumer):**
`generate-tool` server action (`src/app/actions/generate-tool.tsx`) →
`getCurrentUserOrg()` (org from session, params.organizationId explicitly ignored,
`:47`–`:49`) → `getMasterContext({...ids})` for lineage (`:53`) →
`buildMasterPrompt({...})` (`src/lib/utils/prompt-builder.ts:236`) which internally
calls `getMasterContext` **again** + `serializeMasterContext` (default 2000 tokens) and
wraps it in the "You are an expert educator…" task prompt → `streamUI` to the AI model
→ on tool output, `db.resource.create({ ..., generationContext: masterContext })`
persists the master context as JSON lineage (`:135`). Later, `GeneratedResourceCard`
renders that lineage via `ContextLineageDisplay`.
> Note: in this path `getMasterContext` runs **twice** (once for lineage, once inside
> `buildMasterPrompt`) — redundant DB work per generation.

**Flow B — Context Inspector page:** user visits `/context` →
`src/app/context/page.tsx` (auth + org from session) → `getMasterContext` +
`analyzeContextCompleteness` + `serializeMasterContext(maxTokens:10000)` →
`ContextCompleteness` gauge + `ContextInspectorClient` (Preview/Raw/Structured tabs +
downloads).

**Flow C — Inspect API:** `ContextInspector` client form (or any caller) →
`POST /api/context/inspect` with a JSON body → returns raw `MasterContext`.
**Tenancy-unsafe** (org from body).

**Flow D — Generator page setup:** `creation-station/[id]/page.tsx` →
`getMasterContext` (preview), `serializeMasterContext` (2000), `analyzeContextCompleteness`
(suggestions), `getSmartDefaults` → renders `ContextBadges`, `ContextSuggestionsInline`,
`SmartDefaultsSuggestions`.

**Flow E — Student profile:** `students/[id]/page.tsx` →
`getStudentMasterContext` (cached `getMasterContext`) → `serializeMasterContext`
(student-first priority) → `AIContextPreview`; plus student-local `ContextCompleteness`.

**Flow F — Dashboards / course builder / blueprint / grading:** `dashboard.ts`
(`getParentDashboardData`) calls `analyzeContextCompleteness`; `courses/[id]/builder`,
`blueprint`, `grading/[id]` all call `getMasterContext` + `serializeMasterContext`.

---

## External dependencies & services

- **Prisma 7** via `@/server/db` (`db`) and `@/generated/client` (`Prisma`,
  `EducationalPhilosophy` enum). Postgres/pgvector underneath, though this subsystem
  does not itself use vectors.
- **AI:** indirect. The engine produces *text*; the actual model call is in
  `generate-tool.tsx` via `@ai-sdk/rsc` `streamUI` and `@/lib/ai/config`
  (`getModelForTaskWithVideoCheck`). No AI SDK import in the context engine itself.
- **`@/lib/constants/educational-philosophies`** (`PHILOSOPHY_PROMPTS`) — pedagogy
  prompt blocks injected by the serializer.
- **NextAuth** via `@/auth` (`auth()`) and `@/lib/auth-helpers` (`getCurrentUserOrg`)
  — used by the page and route, not by the lib functions.
- **UI:** Next.js App Router server/client components, `@phosphor-icons/react`,
  `framer-motion`, local `@/components/ui/*` (Card/Button/Badge/Input/Label/Tooltip).

---

## Auth / security posture

- **`/context` page:** safe — session-gated, org from `getCurrentUserOrg`, query
  params only narrow scope.
- **`/api/context/inspect`:** **authenticated but not authorized per-tenant.** Org id
  is read from the request body → cross-tenant IDOR. Highest-severity item in this
  subsystem. Fix: derive `organizationId` from `getCurrentUserOrg()` and ignore the
  body's org (mirror `generate-tool.tsx:47`–`:49`), and validate `studentId` belongs
  to that org.
- **`getAcademicContext`:** not org-scoped (objective ids are global Spine data) —
  acceptable if objectives are intended to be shared, but worth an explicit decision.
- **`getSmartDefaults` (course path):** not org-scoped; can leak another org's enrolled
  student id / objectives if `courseId` is attacker-controlled. Current UI passes
  trusted ids, but the function is unsafe by itself.
- **Library/data fetchers:** correctly `where: { organizationId }`.
- **No PII redaction:** serialized context (names, grades, learning difficulties,
  personality data) is emitted verbatim into prompts sent to the AI provider and is
  also downloadable client-side from the inspector. Expected for the feature, but note
  the data sensitivity.

---

## Risks, drift, dead-code & half-built

1. **IDOR in `/api/context/inspect`** (`route.ts:14`–`:15`) — body-supplied
   `organizationId` → cross-tenant data exposure. The codebase already knows this
   class of bug (see the explicit IDOR fix in `generate-tool.tsx`) but did not patch
   the route or its `ContextInspector` UI. **Highest priority.**
2. **`ContextInspector.tsx` is unused dev tooling** that surfaces the IDOR in the UI
   (manual org-id input). No render sites found. Candidate for deletion.
3. **`getMasterContext` runs twice per generation** (lineage + inside
   `buildMasterPrompt`) — duplicate DB load.
4. **Ignored params:** `courseBlockId/bookId/videoId/articleId/documentId` are part of
   `MasterContextParams` and threaded everywhere but never consume in
   `getMasterContext`. "Generate from this book/video" does not actually focus the
   context on that resource. Half-built.
5. **`bookPreferences` half-built** — ids only, empty title/subject, never serialized
   (`master-context.ts:498`–`:555`).
6. **`whatStudentsCall` dead field** — always `null`, no schema backing
   (`master-context.ts:346`).
7. **`environmentPreferences` "parse" is a no-op cast** — false sense of validation
   (`:321`–`:327`).
8. **`modelType` serializer option is dead** — accepted, threaded, never used
   (`context-serializer.ts`).
9. **`getSectionType` truncation is brittle** — relies on exact English header
   strings, references a `"Communication Style"` marker that is never emitted, and
   sorts `"other"` (`-1`) ahead of real sections. Token-overflow behavior is
   unpredictable.
10. **Two competing "completeness" definitions:** engine's 5-pillar
    `analyzeContextCompleteness` vs the student-page 4-factor
    `students/[id]/_components/ContextCompleteness.tsx`; and the library pillar is
    counted differently in `metadata.contextCompleteness` (resolved LibraryContext)
    vs the scorer (raw `book.count`).
11. **Name collisions:** two `ContextCompleteness` components in different dirs;
    `ContextInspector` vs `ContextInspectorClient`. Confusing for maintainers.
12. **`ContextSuggestion.type === "enhancement"` is never produced** by the scorer,
    though UI handles it — dead branch / latent feature.
13. **Pervasive `as any`** in hierarchy walks — type safety bypassed; schema changes
    won't be caught at compile time.
14. **Dead imports:** `LibraryClient` in `ContextInspectorClient.tsx:6`; `Card*` in
    `context/page.tsx`.
15. **`calculateAge` in `prompt-builder.ts:294` is unused** (defined, never called) —
    student birthdate is fetched but age is not actually injected.

---

## Cross-links to other subsystems

- **Prompt building / AI generation** (`src/lib/utils/prompt-builder.ts`): the real
  orchestrator (`buildMasterPrompt`, plus legacy `buildSpineAwarePrompt`,
  `buildPersonalizedPrompt`, `buildFamilyContextPrompt`, deprecated
  `buildCompletePrompt`). Consumes `getMasterContext` + `serializeMasterContext`.
- **Generation action** (`src/app/actions/generate-tool.tsx`): persists
  `MasterContext` into `Resource.generationContext`; org-hardened entry point.
- **Resources UI** (`src/components/resources/GeneratedResourceCard.tsx`): renders
  persisted lineage via `ContextLineageDisplay`.
- **Student queries** (`src/server/queries/students.ts`): `getStudentMasterContext`
  = `cache(getMasterContext)`; supplies `students/[id]` page + `AIContextPreview`.
- **Dashboards** (`src/server/queries/dashboard.ts`): `getParentDashboardData` uses
  `analyzeContextCompleteness`.
- **Other generation pages** consuming the engine: `creation-station/[id]`,
  `courses/[id]/builder`, `blueprint`, `grading/[id]`.
- **Academic Spine** (Subject/Strand/Topic/Subtopic/Objective): the data source for
  `getAcademicContext` and library relevance.
- **Onboarding / Blueprint**: populates `Classroom.educationalPhilosophy`,
  `faithBackground`, `environmentPreferences`, schedule — the family/schedule inputs.
- **Living Library**: `Book`/`VideoResource`/`Resource` extraction (`extractionStatus`)
  feeds `getLibraryContext`.
- **Educational philosophies constant** (`src/lib/constants/educational-philosophies.ts`):
  `PHILOSOPHY_PROMPTS` injected by the serializer.

---

## Open questions

1. Is `getAcademicContext` being global (no org filter) intentional because objectives
   are shared Spine data, or should it be tenant-checked?
2. Are the resource-specific params (`bookId`, `videoId`, etc.) meant to focus the
   master context on a single resource? If so, `getLibraryContext`/`getMasterContext`
   need to actually consume them.
3. Which "completeness" rubric is canonical — the 5-pillar engine scorer or the
   student-page 4-factor widget? They can disagree.
4. Is `ContextInspector.tsx` (and the public-ish `/api/context/inspect` shape) intended
   to ship, or is it dev-only tooling that should be removed/locked down?
5. Should `serializeMasterContext` actually vary by `modelType` (token budget per
   pro3/flash/flash-lite), as the option implies?
6. Are all suggestion `actionUrl`s still valid routes after the recent route
   repointing work?
