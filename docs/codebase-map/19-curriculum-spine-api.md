# 19 — Curriculum Spine API & Reference Data
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|------|------|
| `src/app/api/curriculum/subjects/route.ts` | GET REST endpoint: all Subjects (id/name/code), sorted by sortOrder |
| `src/app/api/curriculum/strands/route.ts` | GET REST endpoint: Strands for a `subjectId` query param |
| `src/app/api/curriculum/topics/route.ts` | GET REST endpoint: Topics for a `strandId` query param |
| `src/app/api/curriculum/subtopics/route.ts` | GET REST endpoint: Subtopics for a `topicId` query param |
| `src/app/api/curriculum/grade-bands/route.ts` | GET REST endpoint: all GradeBands, sorted by minGrade |
| `src/app/api/curriculum/resource-kinds/route.ts` | GET REST endpoint: all ResourceKinds (+subject name), sorted by label |
| `src/app/actions/curriculum-actions.ts` | Server actions: course→books, book→chapters (TOC), subtopic→objectives |
| `src/app/actions/spine-actions.ts` | Server actions: spine cascade (subjects/strands/topics/subtopics/objectives) + topic textbook coverage |
| `src/server/queries/curriculum.ts` | Server-only query helpers: getAvailableTools, getObjectives, getSpineHierarchy, getObjective (currently uncalled) |

## 2. Purpose / intent
This area is the **read API over the Academic Spine** — the global, org-agnostic reference taxonomy `Subject → Strand → Topic → Subtopic → Objective`, plus the `GradeBand` and `ResourceKind` lookups (data model documented in `02-data-model.md`). It powers cascading dropdowns across the app: course creation (`courses/new`), course-block builders (`courses/[id]/blocks/new`, `.../blocks/[blockId]`), the generator topic pickers (`SpineBrowser`, `TopicSelector`), the library scanner (`BookScanner`), the video library, and the generator/resource pickers (`GeneratorsClient`, `ResourcePicker`). Two parallel surfaces exist for the same hierarchy: **REST routes** (consumed via `fetch`) and **server actions** (consumed via direct import). The spine itself is global reference data with no `organizationId`; only the book/course helpers in `curriculum-actions.ts` are tenant-scoped.

## 3. Architecture & key files
- **Two parallel read surfaces for the spine cascade:**
  - REST: `subjects` / `strands` / `topics` / `subtopics` routes return `{ subjects }` / `{ strands }` / etc.; `grade-bands` and `resource-kinds` are leaf lookups. All are `export const dynamic = "force-dynamic"`; subjects/topics/resource-kinds also pin `runtime = "nodejs"` (strands/subtopics/grade-bands do not).
  - Server actions: `spine-actions.ts` exposes `getSubjects/getStrands/getTopics/getSubtopics/getObjectives` returning `{ success: true, ... }`, plus `getTopicTextbookCoverage` (delegates to `getTextbooksForTopic` in `@/lib/textbook-coverage`). Zod-validates the parent id as a UUID.
- **`curriculum-actions.ts`** is a different concern: course/book joins. `getCourseBooks` (org-scoped) → `getBookChapters` (parses `Book.tableOfContents` JSON) and `getSubtopicObjectives`. These accept either a raw string id or a Zod-validated object (`typeof rawData === "string" ? ... : schema.parse(...)`).
- **`server/queries/curriculum.ts`** is a `server-only` helper module (`getAvailableTools`, `getObjectives`, `getSpineHierarchy`, `getObjective`) with rich nested includes — but **no importers** (see §5/§7). The local `getObjectives` here is a *different* signature from the one in `spine-actions.ts`.
- **Keying (resolves Q-012 in `02-`):** All spine entities key on **`id` (uuid, `@default(uuid())`)**, not `code`. `Subject.code` is a separate `@unique` human-readable code, and there is also a *legacy nullable* `Subject.uuid String? @unique` column (`prisma/schema.prisma:370-374`). Every query in this chapter selects/filters on `id` (e.g. `Strand.where.subjectId` → `Subject.id`). The `code` is returned in `select` for display but never used as a join key here.

## 4. Data flow
Cascading-dropdown trace (REST path), e.g. course creation:
1. Client `courses/new/page.tsx:42-43` `fetch("/api/curriculum/subjects")` and `.../grade-bands`.
2. `subjects/route.ts:9-18` → `db.subject.findMany({ select:{id,name,code}, orderBy:{sortOrder:"asc"} })` → `NextResponse.json({ subjects })`.
3. On subject select, `courses/new/page.tsx:58` `fetch("/api/curriculum/strands?subjectId=...")`.
4. `strands/route.ts:7-11` reads `searchParams.get("subjectId")`; 400 if missing; else `db.strand.findMany({ where:{subjectId}, select:{id,name,code,subjectId}, orderBy:{sortOrder:"asc"} })`.
5. Topics/Subtopics follow identically (`topics/route.ts` keyed on `strandId`; `subtopics/route.ts` keyed on `topicId`), each 400-ing on missing parent id.

Server-action path (generators), e.g. `SpineBrowser.tsx`:
1. `SpineBrowser.tsx:74` `getSubjects()` → `spine-actions.ts:23-31` `db.subject.findMany({ orderBy:{sortOrder}, select:{id,name,code}, take:100 })` → `{ success:true, subjects }`.
2. `getStrands({subjectId})` (`:94`) → `spine-actions.ts:33-44` Zod-parses to UUID, `findMany({ where:{subjectId}, take:100 })`.
3. → `getTopics` (`:111`) → `getSubtopics` (`:127`) → `getObjectives` (`:150`, `take:200`). On topic select, `SpineBrowser.tsx:133` also calls `getTopicTextbookCoverage({topicId})` → `spine-actions.ts:94-98` → `getTextbooksForTopic`.

Block builder / books trace:
1. `courses/[id]/blocks/new/page.tsx:122` `getCourseBooks(courseId)` → `curriculum-actions.ts:20-51`: `getCurrentUserOrg()` gate; `db.course.findFirst({ where:{id,organizationId} })`; then `db.book.findMany({ where:{ organizationId, OR:[{subjectId},{strandId}] }, take:50 })`.
2. `:129` `getBookChapters(bookId)` → `curriculum-actions.ts:53-78`: org-scoped book lookup, parses `tableOfContents` JSON (`as any[]`) into `{id,label}` chapters.
3. `activities/new/page.tsx:65` `getSubtopicObjectives(subtopicId)` → `curriculum-actions.ts:80-93`: `db.objective.findMany({ where:{subtopicId}, take:200 })`. **No auth gate, no Zod on the string branch** (see §7).

## 5. Status table

| Unit | Status | Evidence |
|------|--------|----------|
| `subjects/route.ts` GET | DONE | Consumed by `courses/new:42`, `BookScanner.tsx:82`; returns live `db.subject.findMany` (`route.ts:9`) |
| `strands/route.ts` GET | DONE | Consumed by `VideosClient:68`, `courses/new:58`, `BookScanner:91`; `route.ts:14` |
| `topics/route.ts` GET | DONE | Consumed by `blocks/[blockId]/page:129`, `blocks/new:95`; `route.ts:16` |
| `subtopics/route.ts` GET | DONE | Consumed by `blocks/[blockId]/page:139`, `blocks/new:109`; `route.ts:14` |
| `grade-bands/route.ts` GET | DONE | Consumed by `courses/new:43`; `route.ts:7` |
| `resource-kinds/route.ts` GET | DONE | Consumed by `GeneratorsClient:83`, `ResourcePicker:64`; try/catch wrapped (`route.ts:7-21`) |
| `getCourseBooks` | DONE | `blocks/new:122`; org-scoped, validated (`curriculum-actions.ts:20`) |
| `getBookChapters` | DONE | `blocks/new:129`; org-scoped (`curriculum-actions.ts:53`) |
| `getSubtopicObjectives` | PARTIAL | `activities/new:65`; works but no auth gate + Zod skipped on string input (`curriculum-actions.ts:80-83`) |
| `getSubjects` (spine-actions) | DONE | `TopicSelector:35`, `SpineBrowser:74` (`spine-actions.ts:23`) |
| `getStrands/getTopics/getSubtopics` (spine-actions) | DONE | `TopicSelector:40/48/56`, `SpineBrowser:94/111/127` (`spine-actions.ts:33/46/59`) |
| `getObjectives` (spine-actions) | DONE | `TopicSelector:64`, `SpineBrowser:150` (`spine-actions.ts:72`) |
| `getTopicTextbookCoverage` | DONE | `SpineBrowser:133` (`spine-actions.ts:94`) |
| `getAvailableTools` (queries/curriculum) | DEAD | Zero importers repo-wide outside def (`queries/curriculum.ts:9`); only doc reference in `11-thinkling-chat.md` |
| `getObjectives` (queries/curriculum) | DEAD | Zero importers; shadowed-name helper (`queries/curriculum.ts:86`) |
| `getSpineHierarchy` (queries/curriculum) | DEAD | Zero importers (`queries/curriculum.ts:134`) |
| `getObjective` (queries/curriculum) | DEAD | Zero importers (`queries/curriculum.ts:193`) |

## 6. Integration points
- **Importers out (consumers):**
  - REST routes via `fetch`: `courses/new/page.tsx`, `courses/[id]/blocks/new/page.tsx`, `courses/[id]/blocks/[blockId]/page.tsx`, `components/library/BookScanner.tsx`, `living-library/videos/VideosClient.tsx`, `creation-station/GeneratorsClient.tsx`, `components/courses/ResourcePicker.tsx`.
  - `spine-actions.ts` via import: `components/generators/TopicSelector.tsx`, `components/generators/SpineBrowser.tsx`.
  - `curriculum-actions.ts` via import: `courses/[id]/blocks/new/page.tsx`, `courses/[id]/blocks/[blockId]/activities/new/page.tsx`.
  - `server/queries/curriculum.ts`: NONE (dead module).
- **Imports in:** `@/server/db` (`db`); `zod`; `@/lib/auth-helpers` (`getCurrentUserOrg`, only in `curriculum-actions.ts`); `@/lib/textbook-coverage` (`getTextbooksForTopic`, in `spine-actions.ts`); `next/server` (`NextRequest`/`NextResponse`); `server-only` (in `queries/curriculum.ts`).
- **Prisma models used:** `Subject`, `Strand`, `Topic`, `Subtopic`, `Objective`, `GradeBand`, `ResourceKind`, `Course`, `Book` (see `02-data-model.md`).
- **Env vars:** none directly. **External APIs:** none. **Inngest jobs:** none.
- **Keys:** spine entities keyed on `id` (uuid); `Subject.code`/`GradeBand.code`/`ResourceKind.code` are `@unique` secondary codes (`prisma/schema.prisma:371,472,636`).

## 7. Findings

Q-19-001  [MED]  Entire Academic-Spine REST surface is UNAUTHENTICATED — path:`src/app/api/curriculum/subjects/route.ts:8`, `strands/route.ts:6`, `topics/route.ts:8`, `subtopics/route.ts:6`, `grade-bands/route.ts:6`, `resource-kinds/route.ts:6`
  Evidence: None of the six GET handlers call `auth()`/`getCurrentUserOrg()` or any session check; they query and return spine/grade-band/resource-kind data directly. (Spine data is global reference, not tenant data, so this is exposure of the curriculum taxonomy, not cross-tenant leakage.) The middleware does NOT cover these: `src/proxy.ts:96` matcher is `["/((?!api|_next/static|_next/image|assets|favicon.ico).*)"]`, which explicitly EXCLUDES `/api/*` (so `proxy()`'s `auth()` redirect at `src/proxy.ts:49-52` never runs for `/api/curriculum/*`). These endpoints are therefore reachable unauthenticated (see `04-security-auth-tenancy.md`).
  Impact: The full curriculum taxonomy (subjects/strands/topics/subtopics, grade bands, resource kinds incl. subject names) is readable by any unauthenticated caller. Low data sensitivity but a confirmed attack-surface/enumeration note (no middleware backstop).
  Status: documented (not fixed)

Q-19-002  [LOW]  `getSubtopicObjectives` lacks an auth gate and skips Zod when passed a string — path:`src/app/actions/curriculum-actions.ts:80-86`
  Evidence: Unlike its siblings `getCourseBooks`/`getBookChapters` (which call `getCurrentUserOrg()` at `:23`/`:55`), `getSubtopicObjectives` has no session check. When `rawData` is a string it bypasses `getSubtopicObjectivesSchema` entirely (`typeof rawData === "string" ? rawData : schema.parse(...)`), and the live caller passes a raw string (`activities/new/page.tsx:65`), so the UUID validation never runs.
  Impact: Inconsistent with the file's own security comments; a malformed/non-UUID id reaches Prisma unvalidated. Objectives are global reference data so no tenant leak, but the validation drift is a footgun.
  Status: documented (not fixed)

Q-19-003  [MED]  `server/queries/curriculum.ts` is entirely dead code (4 exported helpers, 0 importers) — path:`src/server/queries/curriculum.ts:9,86,134,193`
  Evidence: Grep for `getAvailableTools`, `getSpineHierarchy`, `getObjective`, and the module path `queries/curriculum` returns no importers anywhere in `src/` (only a documentation cross-reference in `11-thinkling-chat.md`). The spine cascade is served instead by `spine-actions.ts` and the REST routes; smart-tooling resolution is served by `resource-kinds/route.ts` + `getAvailableTools` is unused.
  Impact: ~219 lines of unmaintained query logic (with heavy nested includes) presented as live infrastructure; drift risk and reader confusion. If a feature needs `getSpineHierarchy`-style nested reads it should adopt or delete this module.
  Status: documented (not fixed)

Q-19-004  [LOW]  Duplicated spine-read logic across REST routes and `spine-actions.ts` (and dead `queries/curriculum.ts`) — path:`src/app/api/curriculum/strands/route.ts:14` vs `src/app/actions/spine-actions.ts:37`
  Evidence: Three independent implementations of "list strands for a subject" exist: the REST route (`strands/route.ts:14`), the server action (`spine-actions.ts:33`), and the dead helper (`queries/curriculum.ts:134` hierarchy). Same for topics/subtopics/objectives. The REST routes do NOT bound results (`take`), while the actions cap at `take:100`/`200`.
  Impact: Three places to keep in sync (select fields, ordering, bounds). The unbounded REST `findMany` calls have no `take` ceiling (`subjects/route.ts:9`, `strands:14`, `topics:16`, `subtopics:14`, `grade-bands:7`, `resource-kinds:8`), unlike the actions — minor unbounded-result/perf risk if reference tables grow.
  Status: documented (not fixed)

Q-19-006  [LOW]  Inconsistent route hardening (runtime pin + try/catch) across sibling endpoints — path:`src/app/api/curriculum/resource-kinds/route.ts:7` vs `strands/route.ts:6`
  Evidence: Only `subjects`, `topics`, and `resource-kinds` set `export const runtime = "nodejs"`; `strands`, `subtopics`, `grade-bands` omit it. Only `resource-kinds/route.ts:7-21` wraps the query in try/catch returning a 500; the other five let exceptions propagate (default 500).
  Impact: Cosmetic inconsistency / copy-paste drift; behavior differs only in error-body shape and runtime selection. No functional bug.
  Status: documented (not fixed)
