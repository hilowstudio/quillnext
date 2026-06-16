# 07 — Academic Spine & Curriculum Reference APIs

> Code-truth reference. Verified against source on 2026-06-15. The repo's prose/markdown docs
> are known stale; **this document trusts the code only** and cites `path:line` for load-bearing
> facts. Where it disagrees with `.cursor/*` docs, the code wins.

## Purpose & role in the app

The **Academic Spine** is QuillNext's canonical 5-level curriculum taxonomy:

```
Subject  >  Strand  >  Topic  >  Subtopic  >  Objective
```

plus two satellite reference tables: **GradeBand** (grade-range labels for courses) and
**ResourceKind** (the catalog of generator/output types, optionally scoped to a Strand or Subject).
Per the seed (`prisma/migrations/00000000000001_init/migration.sql`) the Objective table holds on
the order of ~26k rows — the spine is large, static reference data.

This subsystem is the **read layer** over that spine. It does three jobs:

1. **REST reference APIs** under `/api/curriculum/*` — six `GET` endpoints that let client
   components lazily walk the hierarchy (subject -> strands -> topics -> subtopics) and fetch the
   GradeBand and ResourceKind catalogs. Used by course creation, block creation, the library
   book scanner, video tagging, and the generators UI.
2. **Server Actions** (`spine-actions.ts`, `curriculum-actions.ts`) — `"use server"` functions
   that do the same hierarchy walk plus objective lookups and book/TOC helpers, invoked directly
   from client components (RSC action transport) instead of via `fetch`.
3. **Server-only query helpers** (`src/server/queries/curriculum.ts`) — richer, deeply-included
   queries (full nested hierarchy, single objective with full ancestry, smart tooling). **As of
   this writing these have no callers** (see Risks).

The spine is **global, cross-tenant reference data**: none of the spine models carry an
`organizationId`, and every read here is unscoped by org. That is by design (see Auth posture).

`educational-philosophies.ts` is a sibling constant — not part of the spine hierarchy — that maps
the `EducationalPhilosophy` enum to pedagogy prompt fragments consumed by the AI/context engine.

---

## File-by-file reference

### `src/server/queries/curriculum.ts` — server-only spine query helpers

- **Directive:** `import "server-only"` (`:1`) — hard server boundary; importing from a client
  component is a build error. Not a `"use server"` action module (cannot be called over the action
  transport); meant to be called from other server code (RSC, route handlers, other actions).
- **Prisma:** uses `db` from `@/server/db` (`:2`). Touches `ResourceKind`, `Objective`, `Subject`,
  `Strand`, `Topic`, `Subtopic`.
- **Exports:**
  - `getAvailableTools({ strandId?, subjectId?, includeGeneric=true })` (`:9-80`) — "Smart Tooling".
    Three `resourceKind.findMany` queries: strand-specialized (`isSpecialized:true`, `:17-34`),
    subject-level (`isSpecialized:false`, `:37-50`), and generic (`strandId:null, subjectId:null`,
    `:53-64`). De-dupes by id via a `Map` (`:67-70`). Returns `{ tools, recommended, allTools }`
    where `recommended` = the specialized tool ids and **`allTools` = only the generic tools**
    (`:78`) — note the misleading name; `allTools` is *not* the full deduped set (`tools` is).
  - `getObjectives({ subjectId, gradeLevel?, strandId?, topicId? })` (`:86-128`) — objective
    lookup by walking *up* the relation from objective -> subtopic -> topic -> strand -> subject
    (`:94-106`), with optional `gradeLevel` exact filter (`:105`). Includes the full ancestry chain
    (`:107-121`); ordered by `sortOrder` (`:122-124`). **Name-collides** with the `getObjectives`
    server action in `spine-actions.ts`, but has a totally different signature/shape.
  - `getSpineHierarchy({ subjectId? })` (`:134-187`) — if `subjectId` given, returns one subject
    with the **entire** nested tree (strands -> topics -> subtopics -> objectives), each level
    `orderBy sortOrder` (`:137-169`). Otherwise returns **all** subjects with only their strands
    (shallow, `:173-184`). Comment claims "with caching" (`:137`, `:172`) but **no cache wrapper
    is present** — these are plain Prisma reads (doc-drift / aspirational comment).
  - `getObjective(objectiveId)` (`:193-218`) — single objective with full ancestry include;
    **throws** `Error("Objective ... not found")` if missing (`:213-215`). Comment says "Used for
    prompt building".
- **Callers:** Grep across `src/**/*.{ts,tsx}` finds **zero importers** of any of these four
  functions. They are defined and exported but unwired (see Risks & `05-ai-core.md:187`).

### `src/app/actions/spine-actions.ts` — spine hierarchy server actions

- **Directive:** `"use server"` (`:1`) — every export is a callable Server Action.
- **Validation:** Zod (`:4`). Four schemas requiring a UUID: `getStrandsSchema.subjectId` (`:6`),
  `getTopicsSchema.strandId` (`:10`), `getSubtopicsSchema.topicId` (`:14`),
  `getObjectivesSchema.subtopicId` (`:18`). All `z.string().uuid()`.
- **Prisma:** `db` from `@/server/db` (`:3`). Touches `Subject`, `Strand`, `Topic`, `Subtopic`,
  `Objective`.
- **Exports (all return `{ success: true, <list> }`):**
  - `getSubjects()` (`:22-30`) — no args; `select {id,name,code}`, `orderBy sortOrder`,
    `take:100` (`:24-28`).
  - `getStrands(rawData)` (`:32-43`) — parses `{subjectId}`, filters by it, `take:100`.
  - `getTopics(rawData)` (`:45-56`) — parses `{strandId}`, `take:100`.
  - `getSubtopics(rawData)` (`:58-69`) — parses `{topicId}`, `take:100`.
  - `getObjectives(rawData)` (`:71-82`) — parses `{subtopicId}`, `select {id,text,code}`,
    `take:200` (`:79`).
- **Notes:** Comments at `:23,35,48,61,74` say defensive try/catch was deliberately removed so
  "schema changes fail explicitly" — so a Zod or DB error rejects the action (surfaces to the
  client promise). No auth/org check anywhere (see Auth posture).
- **Caller:** `src/components/generators/TopicSelector.tsx:9` imports all five. This is the
  primary spine-walk consumer for the generators flow.

### `src/app/actions/curriculum-actions.ts` — book/TOC + subtopic-objective server actions

- **Directive:** `"use server"` (`:1`). Zod (`:4`).
- **Schemas:** `getCourseBooksSchema.courseId` (`:7`), `getBookChaptersSchema.bookId` (`:11`),
  `getSubtopicObjectivesSchema.subtopicId` (`:15`) — all UUID-validated, **but** each action
  accepts a bare string *or* an object and only validates in the object branch (see notes).
- **Prisma:** `db` (`:3`). Touches `Course`, `Book`, `Objective`.
- **Exports:**
  - `getCourseBooks(rawData)` (`:19-44`) — accepts `courseId` as string or `{courseId}`
    (`:20-22`). Looks up the course's `subjectId`/`strandId` (`:24-27`), returns `{books:[]}` if
    the course is missing (`:29`), else `book.findMany` where `subjectId OR strandId` matches
    (`:31-41`), `take:50`. **Tenancy gap:** the book query is **not** filtered by the course's
    `organizationId`, so it can return books belonging to *other* orgs that share the subject/
    strand. `Book` is org-scoped (`schema.prisma` `Book.organizationId @map("account_id")`,
    `:652`) but this query ignores it.
  - `getBookChapters(rawData)` (`:46-67`) — accepts `bookId` string or `{bookId}`. Reads
    `tableOfContents` (Json) and maps it to `{id,label}` chapter stubs (`:61-65`). Casts TOC to
    `any[]` with a comment admitting the shape is assumed (`:58-59`) — fragile if the TOC JSON
    isn't an array of `{id|label|title}`.
  - `getSubtopicObjectives(rawData)` (`:69-82`) — accepts `subtopicId` string or `{subtopicId}`;
    `objective.findMany` by `subtopicId`, `select {id,text,code}`, `orderBy sortOrder`, `take:200`.
    Functionally identical to `spine-actions.getObjectives` but returns `{objectives}` (no
    `success` wrapper) — **duplicate logic across two action files** (see Risks).
- **Callers:** `src/app/courses/[id]/blocks/new/page.tsx:14` (`getCourseBooks`, `getBookChapters`)
  and `src/app/courses/[id]/blocks/[blockId]/activities/new/page.tsx:14`
  (`getSubtopicObjectives`).

### `src/app/api/curriculum/subjects/route.ts` — GET all subjects

- `export const dynamic = "force-dynamic"` (`:2`), `runtime = "nodejs"` (`:6`). `db` (`:4`).
- `GET()` (`:8-21`): `subject.findMany select {id,name,code} orderBy sortOrder`. Returns
  `{subjects}`. No params, no auth. **No `take` bound** (unbounded; fine for ~handful of subjects).

### `src/app/api/curriculum/strands/route.ts` — GET strands by subject

- `dynamic="force-dynamic"` (`:2`). **No explicit `runtime`** (unlike its siblings — minor
  inconsistency). `GET(request)` (`:6-30`): reads `subjectId` query param (`:8`), 400s if absent
  (`:10-12`), else `strand.findMany where {subjectId} select {id,name,code,subjectId} orderBy
  sortOrder`. Returns `{strands}`. No `take` bound.

### `src/app/api/curriculum/topics/route.ts` — GET topics by strand

- `dynamic="force-dynamic"` (`:2`), `runtime="nodejs"` (`:6`). `GET(request)` (`:8-32`): requires
  `strandId` param (400 otherwise, `:12-14`); `topic.findMany where {strandId} select
  {id,name,code,strandId} orderBy sortOrder`. Returns `{topics}`. No `take` bound.

### `src/app/api/curriculum/subtopics/route.ts` — GET subtopics by topic

- `dynamic="force-dynamic"` (`:2`). No `runtime`. `GET(request)` (`:6-30`): requires `topicId`
  (400 otherwise, `:10-12`); `subtopic.findMany where {topicId} select {id,name,code,topicId}
  orderBy sortOrder`. Returns `{subtopics}`. No `take` bound.

### `src/app/api/curriculum/grade-bands/route.ts` — GET grade bands

- `dynamic="force-dynamic"` (`:2`). `GET()` (`:6-21`): `gradeBand.findMany select
  {id,name,code,minGrade,maxGrade} orderBy minGrade asc`. Returns `{gradeBands}`. No params,
  no auth, no `take`.

### `src/app/api/curriculum/resource-kinds/route.ts` — GET resource kinds catalog

- `dynamic="force-dynamic"` (`:2`). `GET()` (`:6-22`): `resourceKind.findMany include
  {subject:{select:{name:true}}} orderBy label asc`. Returns `{kinds}`. **The only route with a
  try/catch** (`:7-21`) — logs and returns a 500 `{error}` on failure. Returns the *whole*
  ResourceKind table (no filtering by strand/subject) — clients filter client-side.

### `src/lib/constants/educational-philosophies.ts` — pedagogy prompt fragments

- **Not** part of the spine hierarchy; included here because the prompt asked.
- Imports the `EducationalPhilosophy` enum from `@/generated/client` (`:1`).
- **Export:** `PHILOSOPHY_PROMPTS: Record<string, string>` (`:7-130`) — maps each enum member to a
  multi-line markdown prompt fragment ("PEDAGOGICAL METHOD: …" with bullet guidance on Living
  Books, the Trivium, hands-on Montessori, etc.). Injected into AI generation context to steer
  tone/method.
- **Enum coverage:** the constant keys every one of the 17 `EducationalPhilosophy` enum values
  (`schema.prisma:925-943`): TRADITIONAL_SCHOOL_AT_HOME, VIRTUAL_ONLINE, CLASSICAL,
  CHARLOTTE_MASON, UNIT_STUDIES, MONTESSORI, UNSCHOOLING, WALDORF, ECLECTIC,
  THOMAS_JEFFERSON_EDUCATION, ROADSCHOOLING, WORLDSCHOOLING, GAMESCHOOLING, REGGIO_EMILIA,
  WILD_AND_FREE, PROJECT_BASED_LEARNING, OTHER. **Full coverage — no missing enum member.**
- **Smell:** every key is written as `(EducationalPhilosophy as any).MEMBER` (`:8`, `:17`, …).
  The `as any` casts defeat type-checking; if an enum member were renamed/removed, the object would
  silently get an `undefined` key instead of a compile error. The map type is `Record<string,
  string>` rather than `Record<EducationalPhilosophy, string>`, so exhaustiveness is not enforced.
- **Consumers** (cross-subsystem): `src/lib/context/context-serializer.ts:9,107-108` (injects the
  fragment when a philosophy is set), `src/lib/ai/prompt-builder.ts:3,68,80` (defaults to
  `PHILOSOPHY_PROMPTS["ECLECTIC"]` when unknown), `src/app/actions/generate-resource-core.ts:5`.

---

## Data models & tenancy

Prisma models touched (all in `prisma/schema.prisma`):

| Model | Lines | Key fields | Org-scoped? |
|-------|-------|-----------|-------------|
| `Subject` | `366-384` | `code @unique`, `name`, `sortOrder`; relations: strands, books, courses, resourceKinds | **No** — global |
| `Strand` | `386-408` | `subjectId`, `code`, `shortCode?`, `sortOrder`; `@@unique([subjectId,code])` | **No** |
| `Topic` | `410-427` | `strandId`, `code`, `sortOrder`; `@@unique([strandId,code])` | **No** |
| `Subtopic` | `429-446` | `topicId`, `code`, `sortOrder`; `@@unique([topicId,code])` | **No** |
| `Objective` | `448-464` | `subtopicId`, `code @unique`, `text`, `complexity?`, `gradeLevel?`, `sortOrder` (~26k rows) | **No** |
| `GradeBand` | `466-476` | `code @unique`, `name`, `minGrade`, `maxGrade` | **No** |
| `ResourceKind` | `630-648` | `code @unique`, `label`, `strandId?`, `subjectId?`, `isSpecialized`, `requiresVision`, `contentType` | **No** |
| `Book` | `650+` | `organizationId @map("account_id")`, `subjectId`, `strandId?`, `tableOfContents` (Json) | **Yes** |
| `Course` | `478+` | `subjectId`, `strandId?`, `gradeBandId?` (read in `getCourseBooks`) | Yes (not enforced here) |

**Tenancy summary:** The spine itself is intentionally **cross-tenant global reference data** —
no spine model has an `organizationId`. `Book` and `Course` *are* org-scoped, and the one place
this subsystem touches them (`getCourseBooks`) **does not apply the org filter**, which is the main
tenancy gap to flag.

The five levels form a strict parent chain via FK (`subjectId`/`strandId`/`topicId`/`subtopicId`),
each with a `sortOrder` used for deterministic ordering, and a `code`/`shortCode`/`uuid` for stable
external identity. `Objective.code` and `Subject.code` are globally unique; the intermediate levels
are unique only within their parent (`@@unique([parentId, code])`).

---

## Entry points & end-to-end flows

### Flow A — Cascading spine selector in the generators UI (server actions)

`TopicSelector.tsx` (client, `"use client"` `:1`) drives a 5-step cascade entirely via Server
Actions from `spine-actions.ts`:

1. On mount: `getSubjects()` -> populates Subject `<Select>` (`:35`).
2. On subject change: `getStrands({subjectId})` (`:40`).
3. On strand change: `getTopics({strandId})` (`:48`).
4. On topic change: `getSubtopics({topicId})` (`:56`).
5. On subtopic change: `getObjectives({subtopicId})` (`:64`).
6. The selected names are joined into a `Subject > Strand > Topic > Subtopic > Objective: …`
   string and bubbled up via `onTopicChange(fullTopic, {subjectId, strandId})` (`:78-81`), which
   downstream generators use as the topic/context for AI content generation.

Each action: `zod.parse(rawData)` -> single `db.<model>.findMany` -> `{success, list}` -> client
state. No org/auth gate at any step.

### Flow B — Course creation (REST)

`src/app/courses/new/page.tsx`:
1. On mount: parallel `fetch("/api/curriculum/subjects")` + `fetch("/api/curriculum/grade-bands")`
   (`:42-43`) populate the subject and grade-band dropdowns.
2. On subject change: `fetch("/api/curriculum/strands?subjectId=…")` (`:58`).
3. Submit `POST /api/courses` with `{subjectId, strandId, gradeBandId}` (`:78-88`), then redirect
   to the course builder (`:95`).

### Flow C — Course block creation (REST + actions)

`src/app/courses/[id]/blocks/new/page.tsx` and `.../[blockId]/page.tsx`:
- `fetch("/api/curriculum/topics?strandId=…")` for the course's strand (`new/page.tsx:95`),
  then `fetch("/api/curriculum/subtopics?topicId=…")` (`:109`). Supports synthetic `new:` topic
  ids for not-yet-persisted topics (`:106-107`).
- `getCourseBooks(courseId)` + `getBookChapters(bookId)` server actions populate book/chapter
  pickers (`:122,129`).
- Activity creation page uses `getSubtopicObjectives` to list objectives for tagging
  (`.../activities/new/page.tsx:14`).

### Flow D — Other REST consumers

- `src/components/library/BookScanner.tsx:68,77` — subjects + strands for classifying scanned
  books.
- `src/app/living-library/videos/VideosClient.tsx:57` — strands for tagging videos.
- `src/components/courses/ResourcePicker.tsx:64` and
  `src/app/creation-station/GeneratorsClient.tsx:81` — `/api/curriculum/resource-kinds` to render
  the generator/output-type catalog.

### Flow E — Pedagogy injection (constant)

`PHILOSOPHY_PROMPTS[philosophy]` is read by `context-serializer.ts` and `prompt-builder.ts` and
spliced into the AI Master Context so generated content matches the family's chosen method. See
`06-context-engine.md` / `05-ai-core.md` for the downstream pipeline.

---

## External dependencies & services

- **Prisma 7** via `@/server/db` (`db`), Postgres through `@prisma/adapter-pg` (`PrismaPg`) with
  `ssl.rejectUnauthorized:false` (`src/server/db.ts:8-11`). Singleton on `globalThis` in non-prod
  (`:21-27`).
- **Zod** for action input validation (`spine-actions.ts`, `curriculum-actions.ts`).
- **Next.js** route handlers (`NextResponse`, `NextRequest`) and Server Actions.
- **Generated Prisma client** `@/generated/client` for the `EducationalPhilosophy` enum.
- **No external HTTP services, AI calls, storage, or caching layers** are invoked by any file in
  this subsystem — these are pure DB reads. (Comments mentioning "with caching" in
  `curriculum.ts` are not backed by any cache code.)

---

## Auth / security posture

- **No authentication or org scoping anywhere in this subsystem.** None of the six REST routes,
  none of the server actions, and none of the server-query helpers call `getCurrentUserOrg`, an
  `auth()`/session check, or any tenancy filter. Verified: there is **no application
  `src/middleware.ts`** (only `node_modules`/build copies exist), so the `/api/curriculum/*` routes
  have no middleware gate either.
- **Why this is acceptable for the spine:** the Subject/Strand/Topic/Subtopic/Objective/GradeBand/
  ResourceKind tables are **global, non-tenant reference data** with no per-org secrets. Exposing
  the curriculum taxonomy to any caller leaks no customer data. This is a deliberate "global
  reference route" pattern. The routes are also `force-dynamic` so they always hit the DB live.
- **Caveats / where the open posture bites:**
  - `getCourseBooks` (`curriculum-actions.ts:19-44`) crosses into org-scoped data (`Book`,
    `Course`) **without** verifying the caller owns the course or filtering books by
    `organizationId`. A user who can supply any `courseId` (and the action is callable as a Server
    Action with arbitrary input) can enumerate book titles/TOCs of *other* organizations that share
    a subject/strand. This is the one genuine **IDOR / cross-tenant read** in the subsystem.
  - All inputs are UUID-validated (good — prevents malformed-id injection), but validation is the
    *only* gate; there is no rate limiting or `take` bound on several routes (`subjects`, `strands`,
    `topics`, `subtopics`, `grade-bands` have no `take`). Spine cardinality keeps payloads small in
    practice, but `resource-kinds` and unbounded subtopic/objective lists could grow.

---

## Risks, drift, dead-code & half-built

1. **Dead/unwired server-query module.** All four exports of `src/server/queries/curriculum.ts`
   (`getAvailableTools`, `getObjectives`, `getSpineHierarchy`, `getObjective`) have **zero
   importers** in `src/`. They duplicate functionality that the *action* files actually wire up.
   Either aspirational (planned RSC usage) or abandoned. `05-ai-core.md:187` independently flags
   `getAvailableTools` as unwired. Treat the whole file as currently dead code.
2. **Cross-tenant book leak in `getCourseBooks`** (see Auth posture) — missing `organizationId`
   filter and missing ownership check. Highest-severity item here.
3. **Duplicate objective-fetch logic.** `spine-actions.getObjectives` and
   `curriculum-actions.getSubtopicObjectives` do the same query with different return shapes
   (`{success,objectives}` vs `{objectives}`). Plus a *third*, differently-shaped `getObjectives`
   in `queries/curriculum.ts`. Three functions named/aliased "objectives", easy to confuse.
4. **Misleading return field.** `getAvailableTools` returns `allTools` = generic tools only
   (`curriculum.ts:78`), not the full deduped set (`tools`). Any future caller will likely misuse
   it.
5. **Doc-drift comments.** `getSpineHierarchy`/`getAvailableTools` repeatedly comment "with
   caching" / "this data rarely changes" (`curriculum.ts:16,36,52,137,172`) but **no caching
   exists** — plain live Prisma reads. Misleading to a maintainer.
6. **`as any` enum casts** in `educational-philosophies.ts` defeat type safety and exhaustiveness;
   a renamed enum member would silently produce an `undefined` key rather than a compile error.
7. **Fragile TOC parsing.** `getBookChapters` casts `tableOfContents` to `any[]` and assumes
   `{id|label|title}` shape (`curriculum-actions.ts:58-65`); non-array or differently-shaped JSON
   yields empty/garbage chapters with no error.
8. **Route inconsistency.** `strands` and `subtopics` routes omit `export const runtime = "nodejs"`
   that `subjects`/`topics` declare; only `resource-kinds` has error handling. Cosmetic but
   indicates copy-paste drift across the six routes.
9. **`TopicSelector` reset ordering** (`TopicSelector.tsx:41,49,57,65`): each cascade `useEffect`
   fires the async fetch and then *synchronously* resets sibling lists to `[]`. It works because
   the fetch's `.then` resolves after the synchronous reset, but the pattern is confusing and a
   reorder would wipe freshly-fetched data.

---

## Cross-links to other subsystems

- **AI Core / Generators** (`05-ai-core.md`): consumes the topic string produced by
  `TopicSelector`, and `PHILOSOPHY_PROMPTS` feeds generation prompts. ResourceKind catalog
  (`/api/curriculum/resource-kinds`) defines the generator/output types the AI core produces.
- **Context Engine** (`06-context-engine.md`): `context-serializer.ts:107-108` injects
  `PHILOSOPHY_PROMPTS` into the Master Context.
- **Courses & Course Builder**: `courses/new`, `courses/[id]/blocks/new`,
  `.../blocks/[blockId]/...` are the main UI consumers of both the REST routes and the server
  actions (Flows B/C). `getCourseBooks`/`getBookChapters` bridge into the **Library/Books**
  subsystem (`Book`, `tableOfContents`).
- **Library** (`BookScanner.tsx`, `living-library/videos`): classify books/videos against the
  spine via the subjects/strands routes.
- **DB/Seeds** (`03-db-seeds-scripts.md`): the spine + ResourceKind rows are populated by seeds /
  the init migration (`prisma/migrations/00000000000001_init/migration.sql`), the source of the
  ~26k objectives.

---

## Open questions

1. Is `src/server/queries/curriculum.ts` intended to be wired into RSC/generators (so the
   action-file duplicates can be retired), or is it abandoned? It is currently 100% dead.
2. Is the unauthenticated exposure of the entire curriculum taxonomy an intentional product
   decision (global reference), or should `/api/curriculum/*` at least require an authenticated
   session even though no tenant data is involved?
3. Should `getCourseBooks` enforce the caller's org and filter `Book` by `organizationId`? (Treat
   as a confirmed bug pending product/security sign-off, not a true open question.)
4. The "with caching" comments imply a planned cache layer that was never built — was a caching
   strategy (e.g. `unstable_cache`/ISR) intended for this rarely-changing spine data?
5. Should the three `getObjectives`-family functions be consolidated into one canonical helper to
   remove the naming/shape ambiguity?
