# Subsystem 10 — Course Builder, Blocks, Activities & Assignments

> Code-truth reference. Verified against source on 2026-06-15. The repo's prose/markdown docs are stale; everything below is cited to `file:line` in actual code. Where this doc and a comment disagree, the code wins.

## Purpose & role in the app

This subsystem is the teacher-facing **course authoring surface**. It lets a teacher (org member) create a `Course` (Subject / Strand / GradeBand metadata), build its internal structure as a tree of `CourseBlock`s (kinds `UNIT / MODULE / SECTION / CHAPTER / LESSON`), attach library/generated resources to blocks, create `Activity` rows under lesson blocks, enroll students, and "distribute" a course (auto-schedule its lessons onto a student's calendar). It also is the **consumption point for the Curriculum Compiler** (subsystem 09): a completed `CurriculumBundle` is "exploded" into a ready-to-run Unit of blocks here.

Architecturally it is a **hybrid of REST routes and server actions** (mapped below). Reads/mutations for course + block CRUD go through `/api/courses/*` route handlers; drag-reorder, resource attach/detach, delete, AI suggestion, bundle explode, and distribution go through `"use server"` actions. All paths are org-scoped via `getCurrentUserOrg()`.

---

## File-by-file reference

### Pages (App Router)

#### `src/app/courses/page.tsx` — Courses index (Server Component)
- **Role:** Lists the org's courses as cards. Entry point to the whole subsystem.
- **Server/client:** Server Component (no directive; uses `async`).
- **Auth/tenancy:** `auth()` → redirect `/login` if no session (`page.tsx:82-85`). `getCurrentUserOrg(session)` wrapped in try/catch → `/login` on failure (`:89-95`). No `organizationId` → redirect `/onboarding` (`:100-102`). **Org-scoped read** via `getOrganizationCourses(organizationId)`.
- **Prisma:** `db.course.findMany` where `organizationId`, `select courseSelect` (subject/gradeBand/strand + `_count` of students & blocks), `orderBy updatedAt desc`, `take: 100` (`:60-78`). Wrapped in `cacheQuery(...)` with `revalidate: 60`, tag `"courses"` (`:73-77`).
- **Notes:** Card shows `_count.blocks` labeled "Units" (`:167`) — mislabeled; the count is **all** blocks regardless of kind, not units. `course.subject.code` is rendered unconditionally (`:142`) — fine since `subjectId` is required.

#### `src/app/courses/new/page.tsx` — Create course form (Client Component)
- **Role:** Form to create a course; on success routes to `/courses/{id}/builder`.
- **Server/client:** `"use client"`.
- **Auth/tenancy:** None in component; relies on the POST route to enforce org. Reads from `/api/curriculum/subjects`, `/api/curriculum/grade-bands`, `/api/curriculum/strands?subjectId=` (`:42-58`) — those routes live in the Curriculum subsystem.
- **Data flow:** `POST /api/courses` with `{title, description, subjectId, strandId, gradeBandId}` (`:78-88`), then `router.push(/courses/${data.course.id}/builder)` (`:95`).
- **"new:" sentinel pattern:** Subject/Strand combobox `onCreate` sets a temp id `new:{name}` (`:150`, `:168`); the POST route materializes these into real `Subject`/`Strand` rows (see route below).
- **BUGS / drift:**
  - Submit button requires `selectedStrand` (`:200`) and the label marks **Strand as required** (`:161` "Strand *"), but the POST route treats `strandId` as optional/nullable. The form is **stricter than the backend** for no schema reason.
  - `bookId` URL param is read (`:49`) with a dead `if (bookId)` block that does nothing (`:50-52`) — half-built "create course from book" entry.
  - GradeBand is a plain `<select>` (no create), unlike Subject/Strand.

#### `src/app/courses/[id]/page.tsx` — Course detail redirect (Server Component)
- **Role:** Pure redirect: `/courses/{id}` → `/courses/{id}/builder` (`:8-9`). There is **no standalone course detail view**; the builder is the canonical course page.

#### `src/app/courses/[id]/builder/page.tsx` — Course Builder page (Server Component)
- **Role:** The main course workspace. Loads the full course tree + context sidebar and renders `<CourseBuilder>`, `<CourseDistributor>`, context badges, recommended generator tools, relevant books.
- **Server/client:** Server Component.
- **Auth/tenancy:** `auth()` → `/login` (`:25-27`); `getCurrentUserOrg()` → no org → `/courses` (`:29-32`). After fetch, **explicit tenancy check** `course.organizationId !== organizationId` → `/courses` (`:72-74`). Solid.
- **Prisma:** `db.course.findUnique({where:{id}, include: courseInclude})` where `courseInclude` pulls `subject/strand/gradeBand`, `blocks` ordered by `position asc` with nested `activities` (ordered by position) → `objectives` → `objective`, and `students` → `student` (`:34-65`). Also `db.book.findMany` (relevant books by subject/strand, `take:10`, `:94-123`) and `db.resourceKind.findMany` (available generator tools by strand/subject/global, `take:10`, `:126-136`).
- **External libs/subsystems:** `getMasterContext` + `serializeMasterContext` + `analyzeContextCompleteness` (Context subsystem) feed the sidebar and are passed to AI suggest indirectly.
- **Notes:** If `course.blocks.length === 0` it shows an "Add First Block" CTA instead of `<CourseBuilder>` (`:186-208`) — meaning **drag-and-drop builder only renders once at least one block exists**. `availableTools` and `organizationId` are passed into `CourseBuilder` (`:197-206`).

#### `src/app/courses/[id]/blocks/new/page.tsx` — Create block form (Client Component)
- **Role:** Rich form to create a `CourseBlock`. Picks kind, parent block (filtered by hierarchy rules), position (auto-calculated), and kind-specific links (Topic/Subtopic, or Book+Chapter for CHAPTER).
- **Server/client:** `"use client"`. Uses `react-hook-form` + `zodResolver(courseBlockSchema)`.
- **Auth/tenancy:** None client-side; the POST route enforces org. Loads course + blocks via `/api/courses/{id}` and `/api/courses/{id}/blocks` (`:82-89`), topics via `/api/curriculum/topics`, subtopics via `/api/curriculum/subtopics`, and books/chapters via server actions `getCourseBooks` / `getBookChapters` (Curriculum subsystem) (`:119-133`).
- **Hierarchy rules (client-only):** `getAvailableParentBlocks()` (`:189-214`): UNIT→no parent; MODULE→under UNIT; SECTION→under UNIT/MODULE; CHAPTER→under UNIT/MODULE/SECTION; LESSON→under anything. **These rules are NOT enforced by the API** — the POST route only checks the parent belongs to the same course (see below). Client-side guidance only.
- **Position model:** Auto-calculates `maxPosition+1` scoped to siblings of the chosen parent (or top-level) (`:136-155`). Note this is a **per-parent** max, but reorder/explode use **global** positions (see Data models) — an inconsistency.
- **Data flow:** `POST /api/courses/{id}/blocks` with form data plus `bookId`/`bookChapterId` from local state, and `topicId`/`subtopicId` blanked if they start with `new:` (`:160-172`). Note the `@ts-ignore` (`:168`) because the form type lacks `bookId`/`bookChapterId` even though `courseBlockSchema` includes them.
- **BUGS / drift:** `onCreate` for Topic/Subtopic creates `new:` temp ids, but the submit handler **strips them to undefined** (`:166-167`) — so creating a brand-new topic/subtopic from THIS form silently drops it. (Contrast: the API POST route *does* support `new:` topic/subtopic creation; the form just never sends it.) Comment at `:166` admits "Todo: Handle custom topic creation backend side."

#### `src/app/courses/[id]/blocks/[blockId]/page.tsx` — Edit block (Client Component)
- **Role:** Edit/delete a single block; for LESSON blocks shows an Activities panel; lists child blocks.
- **Server/client:** `"use client"`, `react-hook-form` + `zodResolver(courseBlockSchema.partial())`.
- **Auth/tenancy:** Enforced by the underlying `/api/courses/{id}/blocks/{blockId}` route.
- **Data flow:** Loads block/course/blocks on mount (`:101-123`); `PATCH` to update (`:151-160`); `DELETE` to remove (`:183-185`). DELETE handles `error.hasChildren` from the API to show "Delete child blocks first" (`:188-191`).
- **Notes:** Activities section is read-only here and labeled "coming soon" / "Activity management coming soon" (`:442-456`) but still links to the (broken — see below) `activities/new` page (`:447-449`). The kind `<select>` lets you change a LESSON to a UNIT etc. with no re-validation of existing parent/child relationships.

#### `src/app/courses/[id]/blocks/[blockId]/activities/new/page.tsx` — Create activity (Client Component)
- **Role:** Form to add an `Activity` (title, type, objective, estimatedMinutes, description) to a lesson block.
- **Server/client:** `"use client"`; local `activitySchema` (zod) — **not** in `lib/schemas` (`:17-23`).
- **Data flow:** Loads the block to read `subtopicId`, then `getSubtopicObjectives(subtopicId)` (Curriculum subsystem) to populate the objective combobox (`:52-74`). On submit, `POST /api/courses/{id}/blocks/{blockId}/activities` (`:86`).
- **CRITICAL BUG (dead endpoint):** The target route **`/api/courses/[id]/blocks/[blockId]/activities/route.ts` does not exist** (verified: no `activities` API directory or `activities/route` anywhere in `src/app/api`). So **every activity submission 404s** and shows "Failed to create activity." The code comments at `:80-85` literally admit the author never confirmed the endpoint exists. **Activity creation is non-functional.** There is no server action fallback either. The objective `new:` create path (`:158-162`) is likewise dead.

### API routes (REST)

#### `src/app/api/courses/route.ts` — `POST /api/courses`
- **Role:** Create a course. `force-dynamic`.
- **Auth/tenancy:** `auth()` → 401 (`:9-12`); `getCurrentUserOrg()` → 400 if no org (`:14-17`). Course created with `organizationId` + `createdByUserId` from session (`:92-101`). Good.
- **Prisma:** Materializes `new:` Subject (`:29-42`) and `new:` Strand (`:55-67`) — auto-generates a `code` from name + `Date.now()` slice. Verifies existing subject/strand and that strand belongs to subject (`:68-79`). Verifies gradeBand if provided (`:82-90`). Creates `Course` including subject/strand/gradeBand (`:92-107`). Returns `{course}`.
- **Notes:** No Zod validation — reads `data` raw (`:19`) and only manually checks `subjectId` (`:21-23`). `title`/`description` are not validated (empty title would persist). New `Subject` is created **globally, not org-scoped** (`Subject` has no org column) — a `new:` subject typed by one org becomes visible to all orgs. Same for `Strand`. Possible cross-tenant taxonomy pollution.

#### `src/app/api/courses/[id]/route.ts` — `GET /api/courses/{id}`
- **Role:** Fetch one course (subject/strand/gradeBand). `force-dynamic`, `runtime nodejs`.
- **Auth/tenancy:** `auth()` → 401; `getCurrentUserOrg()`; **tenancy check** `course.organizationId !== organizationId` → 404 (`:32-34`). Good. **GET only — no PATCH/PUT/DELETE here**, so there is no REST course-update endpoint; course edits (title/kind) only happen via the `updateBlock`/`deleteCourse` actions and there is no course-rename UI in this subsystem.

#### `src/app/api/courses/[id]/blocks/route.ts` — `GET` + `POST` blocks
- **Role:** `GET` lists all blocks for a course (with parentBlock/topic/subtopic), ordered by `position asc` (`:32-58`). `POST` creates a block.
- **Auth/tenancy:** Both verify `course.organizationId !== organizationId` → 404 (`:28-30`, `:90-92`). Good.
- **POST Prisma:** Validates body with `courseBlockSchema.parse` (`:95`). Verifies parent block belongs to same course (`:98-109`) — **only same-course, NOT the kind hierarchy** (a LESSON can be parented to another LESSON via API). Materializes `new:` Topic (requires `course.strandId`, `:115-134`) and `new:` Subtopic (requires a topic, `:147-169`); verifies existing topic/subtopic and that subtopic matches topic (`:171-188`). Creates `CourseBlock` with all fields incl. `bookId`/`bookChapterId` (`:191-203`). Returns `{block}`.
- **Notes:** ZodError detection uses `error.name === "ZodError"` (`:232`) — works but brittle. No tenancy check on the `topicId`/`subtopicId`/`bookId` references (they're global taxonomy / org-scoped book but unverified here).

#### `src/app/api/courses/[id]/blocks/[blockId]/route.ts` — `GET` + `PATCH` + `DELETE` block
- **Role:** Single-block read/update/delete. `force-dynamic`, `runtime nodejs`.
- **Auth/tenancy:** All three verify course org (`:28-30`, `:103-105`, `:222-224`) and block-belongs-to-course (`:70-72`, `:112-114`, `:235-237`). Good.
- **GET** includes topic/subtopic/activities(position asc)/childBlocks(position asc) (`:33-68`).
- **PATCH** validates with `courseBlockSchema.partial()` (`:117-118`). Prevents self-parenting (`:123-125`) and verifies parent in same course (`:130-139`). Conditionally updates only provided fields (`:144-155`). **Does NOT update `bookId`/`bookChapterId`/topic-create** — only kind/title/description/position/parentBlockId/topicId/subtopicId. So you cannot change a block's attached Book/Chapter via PATCH.
- **DELETE** refuses if the block has child blocks → returns `{error, hasChildren:true}` 400 (`:240-248`); otherwise deletes (cascade removes activities) (`:251-253`). Note: the schema has `parentBlock` self-relation **without** `onDelete: Cascade` (`schema.prisma:539`), so the API's manual "delete children first" guard is what prevents orphan/FK issues.

### Server actions

#### `src/app/actions/course-actions.ts` (`"use server"`)
- **`reorderBlocks(courseId, updates)`** (`:18-57`): The save target of drag-and-drop. Verifies course org (`:27-35`). Runs a `$transaction` of individual `courseBlock.update` setting `position` + `parentBlockId` for each (`:43-53`). Revalidates builder path. **Does not validate that the new positions/parents respect kind hierarchy.** Input is locally validated by `ReorderSchema` (`:10-16`) but note the action is called WITHOUT pre-parsing in `CourseBuilder` (it passes the array directly; `ReorderSchema` is defined but the function never calls `.parse`).
- **`deleteBlock(rawData)`** (`:59-93`): Parses `deleteBlockSchema`. Verifies block→course→org (`:67-86`). Deletes block. **Unlike the REST DELETE, this does NOT check for child blocks** — relies on DB. Since `parentBlock` relation is non-cascading, deleting a parent block with children here would fail at the DB level (FK), or orphan depending on constraints. Used by `CourseBuilder` trash button.
- **`updateBlock(rawData)`** (`:99-137`): Parses `updateBlockSchema`. Updates only `title` + `kind` (`:127-133`). Used for inline title edits in `CourseBuilder`. `kind` cast `as any` (`:131`).
- **`deleteCourse(rawData)`** (`:139-170`): Parses `deleteCourseSchema`, verifies org, deletes course (cascade removes blocks/students/etc.). **Revalidates `/living-library` and `/courses-old`** (`:167-168`) — NOT `/courses`. `/courses-old` is a dead path. **No UI in this subsystem calls `deleteCourse`** (no delete-course button found in the builder).
- **Auth:** Every action calls `auth()` + `getCurrentUserOrg()` and checks org ownership. Good posture.

#### `src/app/actions/course-resource-actions.ts` (`"use server"`)
- **Role:** Attach/detach a library or generated resource to a `CourseBlock`. One function per resource type.
- **Exports:** `attachBookToBlock`, `attachVideoToBlock`, `attachArticleToBlock`, `attachDocumentToBlock`, `attachResourceToBlock`, `detachResourceFromBlock`.
- **Auth/tenancy (exemplary):** `requireOrg()` (`:43-47`) + `assertBlockInOrg(blockId, org)` (`:49-55`) on every call, AND each attach verifies the **resource itself** belongs to the org (e.g. `:62-63` for book) — guards against grafting another org's resource. The header comment (`:38-47`) explains this is intentional. This is the best-secured file in the subsystem.
- **Prisma:** Sets the corresponding FK (`bookId`/`videoId`/`articleId`/`documentId`/`resourceId`) on the block; detach nulls the chosen one. Each block has **one slot per resource type** (5 nullable FK columns on `CourseBlock`).
- **Callers:** `CourseBuilder.tsx`.

#### `src/app/actions/assignments.ts` (`"use server"`)
- **`assignResourceToStudent(resourceId, studentId, type='RESOURCE'|'COURSE')`** (`:7-57`): Dual-purpose. For `COURSE`: upserts a `CourseStudent` enrollment (status `ACTIVE`) (`:20-37`). For `RESOURCE`: creates a `ResourceAssignment` connecting student + resource, `assignedByUserId` from session (`:43-51`).
- **Auth/tenancy:** `getCurrentUserOrg()`; verifies the **student** is in-org (`:12-13`), and the **course** or **resource** is in-org (`:17-18` / `:40-41`). Good.
- **Notes:** `ResourceAssignment.create` is cast `as any` (`:50`) and omits `status`/`courseId`; relies on schema default `status ASSIGNED` (`schema.prisma:808`). Revalidates `/`, `/students` (`:54-55`). Caller: `AssignResourceDialog` (used only by ParentDashboard).

### Components

#### `src/components/courses/CourseBuilder.tsx` (`"use client"`)
- **Role:** The drag-and-drop block builder. ~790 lines. Core of the subsystem.
- **Key parts:**
  - `SortableBlockItem` (`:65-373`): one row; inline title edit (Enter saves / Esc cancels, `:131-137`), resource badges per attached type (book/video/article/document/generic resource), Add Resource / Generate buttons, edit/delete icon buttons, and a hover "insert block here" `+` linking to `/blocks/new?parentId=&position=block.position+1` (`:357-370`).
  - `CourseBuilder` (`:387-787`): holds `blocks` state (seeded from `initialBlocks`), dnd-kit `DndContext` + `SortableContext` (`verticalListSortingStrategy`), `PointerSensor` + `KeyboardSensor`.
- **dnd-kit version (`@dnd-kit/core` + `/sortable` + `/utilities`).**
- **Drag model (IMPORTANT, and limited):** It is a **flat sortable list**. `handleDragEnd` (`:422-440`) does `arrayMove` then `saveOrder` (`:442-461`) which sends `{id, position: index, parentBlockId: block.parentBlockId}` — i.e. **it reindexes positions but preserves each block's existing parent**. There is **NO drag-to-nest / re-parenting**; comments at `:412-416` admit this is "Reorder-Only ... flat list" MVP. Visual indentation is purely cosmetic, derived from `kind` not actual tree depth: `depth = LESSON?2 : MODULE?1 : 0` (`:658`) and `SortableBlockItem` style `marginLeft: depth*24px` (`:100`). So SECTION/CHAPTER blocks render at depth 0 (flush with UNIT) regardless of their real parent.
- **Optimistic updates:** delete (`:463-474`), title update (`:476-487`), attach/detach resource (`:494-550`) all update local state then call the server action and `toast` on failure (revert logic is mostly TODO/absent — comments "Revert if needed").
- **AI suggest:** "Inkling Assist" button (`:626-634`) → `handleAiSuggest` (`:552-569`) dynamically imports `suggestCourseBlocks(courseId)` (subsystem 11/AI) and appends returned blocks.
- **Bundle explode integration:** `ResourcePicker.onSelectBundle` (`:688-706`) dynamically imports `explodeCurriculumBundle(bundleId, courseId)` (subsystem 09) and `window.location.reload()`s on success (`:698`).
- **Generators/Compiler:** `handlePickerGenerate` (`:571-584`) routes `"COMPILER"` to `SpecForm`/`compileCurriculumAction`, otherwise opens `GeneratorForm` with the picked `ResourceKind` and block context (`:750-769`).
- **BUGS / drift:**
  - **`ResourcePicker` is given `organizationId={courseId}`** (`:683`) — a courseId is passed where an orgId is expected. The inline comment admits the confusion. `ResourcePicker` forwards it to `getLibraryResources(organizationId)`; whether library results are correct depends on how that action interprets the arg (likely returns nothing / wrong scope). Real `organizationId` IS in props (`:387`) but used only for `GeneratorForm` (`:758`), not the picker. **Likely live bug.**
  - `reorderBlocks` is called with `position: index` (global list index) while `blocks/new` computes positions per-parent — two different position conventions coexist.
  - No re-parent on drag means the hierarchy can only be set at block-create time or via the edit page's parent dropdown.

#### `src/components/courses/CourseDistributor.tsx` (`"use client"`)
- **Role:** "Distribute Course to Student" dialog: pick student + start date, calls `distributeCourse` (subsystem: scheduling) (`:41`).
- **Notes:** Pulls students from props (the course's enrolled students). On success toasts `result.count` scheduled lessons. Thin wrapper around the scheduling action.

#### `src/components/courses/ResourcePicker.tsx` (`"use client"`)
- **Role:** Tabbed modal to pick an existing library item (Books/Videos/Articles/Documents/My Resources/Bundles) OR, in `mode="universal"`, to launch a generator ("Generate New" tab) or the Curriculum Compiler card.
- **Data:** On open, `getLibraryResources(organizationId)` (Library subsystem) + (universal) `fetch('/api/curriculum/resource-kinds')` (`:62-65`). Populates books/videos/articles/documents/resources/bundles/kinds.
- **Callbacks:** `onSelectBook/Video/Article/Document/Resource`, `onSelectBundle`, `onGenerate(kindId, kindLabel)` where kindId `"COMPILER"` is special-cased upstream.
- **Notes:** `loading` state is referenced in tab bodies (`:195` etc.) but never set true (only `isLoading` is toggled, `:57/:82`) — loading spinners never show. The bundle card reads `bundle.spec.title/topic/status` (`:336-345`) — couples picker to CurriculumBundle shape. Receives the mis-passed `courseId` as `organizationId` from `CourseBuilder` (see bug above).

#### `src/components/assignments/AssignResourceDialog.tsx` (`"use client"`)
- **Role:** Small dialog to assign a Resource or a Course to a student → `assignResourceToStudent` (`:27`).
- **Callers:** **Only `src/components/dashboard/ParentDashboard.tsx`** (`:202`, `:253`) — not used inside the course builder itself.
- **Notes:** `students: any[]`. Renders `preferredName || firstName`.

### Schemas & utilities

#### `src/lib/schemas/courses.ts`
- **`courseBlockSchema`** (`:7-17`): the single source of truth for block create/edit. `kind` enum `UNIT|MODULE|SECTION|CHAPTER|LESSON`; `title` required; `position` positive int; optional `description/parentBlockId/topicId/subtopicId/bookId/bookChapterId`. Exports `CourseBlockFormData`. Used by both block API routes and both block form pages.

#### `src/lib/schemas/actions.ts` (relevant subset)
- Houses zod schemas for the server actions: `deleteCourseSchema`, `createBlockSchema`, `updateBlockSchema`, `deleteBlockSchema`, `reorderBlocksSchema`, plus course/assignment/etc. (`:29-74`, `:127-144`).
- **Drift:** `reorderBlocksSchema` (`:65-74`) expects `{courseId, updates}` and uuid ids, but `course-actions.reorderBlocks` defines its **own** local `ReorderSchema` (`course-actions.ts:10-16`) and takes `(courseId, updates)` positionally — the schema in `actions.ts` is **unused by the actual action**. Likewise `createBlockSchema` is not used (block creation is REST + `courseBlockSchema`).

#### `src/lib/utils/course-pacing.ts`
- **Exports:** `calculateCoursePacing(classroomId, {totalWeeks, hoursPerWeek})` (`:35`), `calculatePacingFromSchedule(config, classroom?)` (`:76`), `autoFillCourseSchedule(subjectId, gradeLevel, availableWeeks)` (`:146`).
- **Role (intended):** Compute school-day counts / weekly pacing from a `Classroom` schedule + holidays, and distribute objectives across weeks by `sortOrder`.
- **Prisma:** `classroom.findUnique` w/ holidays (`:42-47`); `objective.findMany` via subtopic→topic→strand→subject (`:152-167`).
- **DEAD CODE:** Grep shows **no caller anywhere** in `src/` for any of these three functions (only internal `calculateCoursePacing`→`calculatePacingFromSchedule`). The actual lesson scheduling is done by `distributeCourse` in `server/actions/scheduling.ts`, which does **not** use this util. This file is unwired pacing logic. Also note `calculateCoursePacing` ignores `hoursPerWeek` for day math, and `daysPerWeek`/`estimatedCompletionDate` are computed but `hoursPerWeek` never factors in.

---

## Data models & tenancy

All from `prisma/schema.prisma`. Postgres column names are snake_case via `@map`.

- **`Course`** (`:478-501`): `organizationId` (`@map account_id`), `createdByUserId`, `subjectId` (required), `strandId?`, `gradeBandId?`, `title`, `description?`. Cascade-deletes from Organization. Relations: `blocks`, `students` (CourseStudent), `assessments`, `courseProgress`, `resourceAssignments`. **Tenancy column: `organizationId`.**
- **`CourseStudent`** (`:503-516`): join `@@id([courseId, studentId])`, `status: CourseStudentStatus`, `enrolledAt`, `completedAt?`. Cascade on both sides. This is how enrollment works (`assignResourceToStudent` type=COURSE writes here).
- **`CourseBlock`** (`:518-555`): `courseId`, `parentBlockId?` (self-relation `"BlockHierarchy"`, **non-cascading**), `sourceBundleId?` (links a block back to the `CurriculumBundle` it was exploded from), `kind: CourseBlockKind`, `title`, `description?`, **`position: Int`** (no default, no per-parent uniqueness), `topicId?`, `subtopicId?`, `bookChapterId?`, and **five resource-slot FKs**: `bookId?`, `videoId?`, `articleId?`, `documentId?`, `resourceId?`. Relations: `activities`, `assessments`, `childBlocks`, `scheduleItems`, `resourceAssignments`. **No `organizationId`** — tenancy is derived via `course.organizationId` (every action/route does `block→course→org`).
- **`Activity`** (`:557-576`): `courseBlockId`, `createdByUserId`, `title`, `description?`, `estimatedMinutes?`, `activityType: ActivityType`, `position`. Cascade from CourseBlock. Relations: `objectives` (ActivityObjective), `progressRecords`, `scheduleItems`, `resourceAssignments`.
- **`ActivityObjective`** (`:578-588`): join `@@id([activityId, objectiveId])`, `isPrimary`. Links an activity to curriculum `Objective`s.
- **`ResourceAssignment`** (`:799-828`): `resourceId` (required), `assignedByUserId`, optional `courseId/courseBlockId/activityId/assessmentId/studentId`, `status: AssignmentStatus @default(ASSIGNED)`, `dueDate?`, `completedAt?`. **Has no `organizationId`** — tenancy enforced at write time by verifying student+resource are in-org.
- **`StudentScheduleItem`** (`:1296+`): created by `distributeCourse` — `{organizationId, studentId, courseBlockId, date, sequenceOrder, status}`. (Owned by the Scheduling subsystem; referenced here.)
- **Enums:** `CourseBlockKind = UNIT|MODULE|SECTION|CHAPTER|LESSON` (`:987-993`). `ActivityType = READING|WRITING|DISCUSSION|PROJECT|LAB|WORKSHEET|OTHER` (`:995-1003`).

### The block position / indentation model (definitive)
- `position` is a **flat integer ordering of ALL blocks in a course** (the builder and explode-bundle both treat it as a global sequence; `blocks/new` instead computes a per-parent max — an inconsistency to be aware of).
- The tree is expressed by `parentBlockId`, but the builder **never re-parents on drag** — only `position` changes. Real hierarchy is set at create time (`blocks/new` parent dropdown) or the edit page.
- **Indentation in the builder is faked from `kind`** (`LESSON`=2, `MODULE`=1, else 0), not from `parentBlockId` depth. SECTION/CHAPTER both render at indent 0. So the visual tree can diverge from the stored `parentBlockId` tree.
- `distributeCourse` only schedules blocks with `kind === 'LESSON'`, ordered by `position asc` — so only LESSON blocks become calendar items.

---

## Entry points & end-to-end flows

1. **Create a course:** `/courses` → "Create Course" → `/courses/new` (client form) → `POST /api/courses` (materializes `new:` subject/strand) → redirect `/courses/{id}/builder`.
2. **Build structure (manual):** Builder "Add Block" / insert-`+` → `/courses/{id}/blocks/new` (client) → `POST /api/courses/{id}/blocks` (materializes `new:` topic/subtopic) → back to builder.
3. **Reorder:** Drag a row in `CourseBuilder` → `arrayMove` (optimistic) → `reorderBlocks(courseId, updates)` action → `$transaction` of position updates → revalidate.
4. **Edit/delete block:** Inline title edit → `updateBlock` action; trash icon → `deleteBlock` action; or full edit at `/courses/{id}/blocks/{blockId}` → `PATCH`/`DELETE` REST.
5. **Attach a resource:** Builder "Add Resource" → `ResourcePicker` modal → `getLibraryResources` → pick → `handleResourceSelected` → `attach{Book|Video|Article|Document|Resource}ToBlock` action → block FK set.
6. **Explode a compiled bundle (subsystem 09 → here):** `ResourcePicker` "My Bundles" tab → `onSelectBundle` → `explodeCurriculumBundle(bundleId, courseId)` creates a UNIT + "Unit Materials" MODULE (one LESSON per artifact, each carrying one `resourceId`) + "Daily Lessons" MODULE (`durationDays` LESSON rows) appended after the last block by global `position`. Idempotent via `sourceBundleId`+kind UNIT. `window.location.reload()` to refresh.
7. **AI suggest blocks:** "Inkling Assist" → `suggestCourseBlocks(courseId)` → `getMasterContext`+`generateObject` (Gemini flash) → creates 3–5 UNIT/MODULE blocks at the tail.
8. **Enroll a student:** `assignResourceToStudent(courseId, studentId, 'COURSE')` upserts `CourseStudent` (via `AssignResourceDialog` on ParentDashboard, or distribution implies enrollment is separate).
9. **Distribute a course:** Builder sidebar `CourseDistributor` → pick student+date → `distributeCourse` → fetch LESSON blocks (position asc) + student's classroom/holidays → compute next N school days → `studentScheduleItem.createMany`.
10. **Add an activity (BROKEN):** Edit-block page (LESSON) → "Add Activity" → `/courses/{id}/blocks/{blockId}/activities/new` → `POST .../activities` → **404, endpoint missing.**

---

## External dependencies & services

- **dnd-kit** (`@dnd-kit/core`, `/sortable`, `/utilities`) — drag-and-drop in `CourseBuilder`.
- **react-hook-form** + **@hookform/resolvers/zod** + **zod** — block & activity & course forms.
- **Prisma** (`@/server/db`, generated client `@/generated/client`) — all persistence.
- **NextAuth** (`@/auth`) + `getCurrentUserOrg` (`@/lib/auth-helpers`) — auth/tenancy.
- **Vercel AI SDK** (`ai` `generateObject`) + `@/lib/ai/config` `models.flash` — `suggestCourseBlocks` (Gemini flash).
- **sonner** — toasts. **date-fns** — distribution date math. **@phosphor-icons/react** — icons.
- **Next cache:** `cacheQuery` (`@/lib/utils/prisma-cache`) on the index; `revalidatePath`/`revalidateTag` in actions; `unstable_cache` in scheduling.
- **Context subsystem:** `getMasterContext`, `serializeMasterContext`, `analyzeContextCompleteness`, `ContextBadges`, `ContextCompleteness`.

---

## Auth / security posture

- **Every** REST route and server action authenticates (`auth()` / `getCurrentUserOrg()`) and verifies the target `Course`'s `organizationId` matches the caller before mutating. Block ops resolve org via `block → course → organizationId`. **Tenancy is consistently enforced.**
- **Best-in-class:** `course-resource-actions.ts` and `assignments.ts` additionally verify the *attached resource / student* belongs to the org (defends against grafting another org's data). `explode-bundle.ts` verifies BOTH the bundle's and the destination course's org (`:67`).
- **Client forms carry no auth** (expected) — they rely entirely on the route/action. Acceptable since all mutating endpoints enforce server-side.
- **Gaps / weaker spots:**
  - `POST /api/courses` does **no Zod validation** (raw `data`), only a manual `subjectId` check; empty/oversized `title` would persist.
  - `new:` Subject/Strand (course route) and `new:` Topic/Subtopic (block route) create **global, non-org-scoped taxonomy rows** — one org's typed-in taxonomy is visible to all orgs (cross-tenant catalog pollution, not data leak).
  - `reorderBlocks` updates positions/parents with no per-block org re-check beyond the course-level check (acceptable since all blocks are scoped to the verified course, but it never validates the `updates` ids actually belong to that course — a caller could pass another course's block id and it would be updated, since `update where:{id}` isn't scoped to `courseId`). **Potential IDOR in `reorderBlocks`** (and similarly the REST `PATCH`/`DELETE` verify the block belongs to the course, but `reorderBlocks` does not).

---

## Risks, drift, dead-code & half-built

1. **Activity creation is fully broken** — `activities/new` POSTs to a non-existent `/api/courses/[id]/blocks/[blockId]/activities` route. No endpoint, no server-action fallback. (HIGH — user-visible failure.)
2. **`ResourcePicker` receives `courseId` as `organizationId`** in `CourseBuilder` (`CourseBuilder.tsx:683`) — library resource fetch is mis-scoped; the real `organizationId` prop exists but is unused for the picker. (HIGH — likely empty/incorrect resource lists.)
3. **No drag-to-nest / re-parenting** — builder is a flat reorder only; indentation is faked from `kind`, so the visual tree can lie about the real `parentBlockId` tree. (MEDIUM — UX/correctness.)
4. **Position model inconsistency** — `blocks/new` uses per-parent `max+1`; `reorderBlocks` and `explode-bundle` use global indices. Mixed conventions can produce duplicate/overlapping positions. (MEDIUM.)
5. **`reorderBlocks` IDOR** — updates `courseBlock` by id without scoping to `courseId`; a crafted payload could reposition another course's blocks (the course-level org check doesn't cover the individual block ids). (MEDIUM — security.)
6. **`new:` topic/subtopic dropped by the create-block form** — `blocks/new` strips `new:` ids to `undefined` before POST, so custom topics typed there are silently lost, even though the API supports creating them. (MEDIUM — feature gap / drift vs. UI affordance.)
7. **`course-pacing.ts` is dead code** — none of its three exports are called anywhere; real scheduling lives in `scheduling.ts`. (LOW — cleanup.)
8. **`deleteCourse` is dead/unwired and revalidates wrong paths** — no UI invokes it; it revalidates `/living-library` and `/courses-old` (a non-existent route) instead of `/courses`. (LOW.)
9. **Schema drift in `actions.ts`** — `reorderBlocksSchema`/`createBlockSchema` don't match the actual action signatures; `reorderBlocks` defines its own local schema and never `.parse`s. (LOW.)
10. **`POST /api/courses` lacks Zod validation**; `new:` taxonomy is global. (LOW–MEDIUM.)
11. **Index card mislabels block count as "Units"** while counting all block kinds. (COSMETIC.)
12. **Create-course form requires Strand** but backend treats it as optional — over-strict form. (COSMETIC/UX.)
13. **`ResourcePicker` `loading` state never set true** — its loading placeholders are dead branches. (COSMETIC.)
14. **`window.location.reload()` after bundle explode** — full reload instead of state refresh (comment admits "brute force"). (LOW.)
15. **Edit-block kind change is unvalidated** — switching a LESSON to UNIT etc. doesn't reconcile existing parent/child relationships. (LOW.)

---

## Cross-links to other subsystems

- **09 Curriculum Compiler / Bundles:** `explode-bundle.ts` consumes `CurriculumBundle` + its `Resource` artifacts; `ResourcePicker` "Generate New"/Compiler card → `SpecForm` + `compileCurriculumAction`; `CourseBlock.sourceBundleId` ties blocks back to a bundle.
- **Curriculum / Academic Spine:** `/api/curriculum/{subjects,strands,grade-bands,topics,subtopics,resource-kinds}` routes; server actions `getCourseBooks`, `getBookChapters`, `getSubtopicObjectives` (`@/app/actions/curriculum-actions`); models `Subject/Strand/Topic/Subtopic/Objective/GradeBand/ResourceKind`.
- **Library:** `getLibraryResources` (`@/app/actions/resource-library-actions`) feeds `ResourcePicker`; `Book/VideoResource/Article/DocumentResource/Resource` models are the attachable resource slots.
- **Generators (Creation Station):** `GeneratorForm` (`@/components/generators/GeneratorForm`) launched from the builder with block context; recommended-tools links to `/creation-station/{id}?courseId=`.
- **Context engine:** `getMasterContext` / `serializeMasterContext` / `analyzeContextCompleteness` used by the builder page and `suggestCourseBlocks`.
- **Scheduling:** `distributeCourse` (and the rest of `server/actions/scheduling.ts`) writes `StudentScheduleItem`; consumed by the calendar/dashboard subsystems.
- **AI:** `suggest-blocks.ts` uses `@/lib/ai/config` `models.flash` + Vercel AI SDK.
- **Dashboard:** `AssignResourceDialog` is consumed by `ParentDashboard` to assign courses/resources to students.
- **Assessments / Students:** Builder sidebar links to `/courses/{id}/assessments` and `/courses/{id}/students` (those pages are owned by other subsystems).

---

## Open questions

1. Was the `activities` REST route deleted or never built? There is a complete client form for it — was activity creation ever functional, or is it vestigial scaffolding?
2. Is the `ResourcePicker organizationId={courseId}` a known live bug or does `getLibraryResources` coincidentally tolerate a courseId? (Needs runtime check of that action's signature.)
3. Is the global (non-org-scoped) creation of `new:` Subject/Strand/Topic/Subtopic intended (shared catalog) or an oversight? It conflicts with the otherwise strict per-org tenancy.
4. Should `course-pacing.ts` be wired into `distributeCourse` (which currently hardcodes `schoolDaysOfWeek = [1..5]` and ignores the util), or deleted?
5. Is drag-to-nest planned? The flat-list + kind-based fake indentation is explicitly an "MVP" per the in-file comments.
6. Why does `deleteCourse` revalidate `/courses-old` (a dead route) and never `/courses`, and why is it unwired to any UI?
