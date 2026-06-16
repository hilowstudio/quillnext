# 14 — Dashboards & Home (parent / student)

> Code-truth reference. Verified against source on 2026-06-15. Trust this over any
> prose/markdown in `.cursor/` or READMEs. Cite lines are `path:line`.

## Purpose & role in the app

This subsystem owns the **authenticated landing experience** and the **two dashboard
surfaces** a family sees:

1. **Parent dashboard** — the org-owner / teacher control center rendered at `/`
   (`src/app/page.tsx` → `ParentDashboard`). Surfaces a hard-coded "Daily Liturgy"
   card, quick-create generators, the **student profile switcher** ("Who is learning
   today?"), a context-completeness meter, quick-action links, and the 5 most recent
   resources / courses.
2. **Student dashboard** — a per-child view of that child's courses, individual
   resource assignments, and family-discipleship widget. It is rendered **two
   different, unrelated ways** (this is the single most important architectural fact
   of the subsystem):
   - **`/` with `?studentId=<id>`** → `StudentDashboard` (the rich client component).
   - **`/student/dashboard?studentId=<id>`** → a **separate, schedule-only page**
     (`src/app/student/dashboard/page.tsx`) that renders `DailyScheduleList`
     (subsystem 11) and has its own student picker. It does **not** use
     `StudentDashboard`, the provider, or the dashboard queries at all.

The "active student" selection mechanism is a single URL query param, `studentId`,
read **server-side** on `/` and written **client-side** via a nuqs-backed React
context (`StudentProfileProvider`).

---

## File-by-file reference

### `src/app/page.tsx` — authenticated home / router (Server Component)

- **Role:** The app's landing route. Decides parent-vs-student view from
  `searchParams.studentId`.
- **Server/client:** Server Component (`async function HomePage`, no `"use client"`).
- **Auth & tenancy:** Strong.
  - `auth()` → if no `session.user`, `redirect("/login")` (`page.tsx:14-19`).
  - `getCurrentUserOrg(session)` → if no `organizationId`, `redirect("/onboarding")`
    (`page.tsx:22-26`). Session is passed in to avoid a re-fetch.
  - All data fetches are scoped by the resolved `organizationId`.
- **Routing logic:**
  - If `searchParams.studentId` is present, calls
    `getStudentDashboardData(organizationId, studentId)` (`page.tsx:30`). If the
    student exists (and is in-org), renders `<StudentDashboard student={student} />`.
    If the lookup returns `null` (invalid id / wrong org), it **silently falls
    through to the parent dashboard** (`page.tsx:35`) — no error, no redirect.
  - Otherwise calls `getParentDashboardData(organizationId)` and renders
    `<ParentDashboard ... />` (`page.tsx:39-50`).
- **Notes / drift:**
  - Lines 16 (`// ... (auth checks) ...`) is a leftover placeholder comment; the
    real checks are immediately below it. Harmless but misleading.
  - `classroomName={data.classroomName || "My Classroom"}` double-defaults — the prop
    is also defaulted again inside `ParentDashboard` (`ParentDashboard.tsx:31`).
  - `searchParams` is awaited (Next 16 async searchParams contract) — correct.

### `src/components/dashboard/ParentDashboard.tsx` — parent control center (Server-renderable)

- **Role:** Presentational shell for the parent view. Pure props in, JSX out; no data
  fetching of its own.
- **Server/client:** No `"use client"` directive → renders on the server. It embeds
  **client islands**: `StudentProfileSwitcher`, `AssignResourceDialog`,
  `ContextCompleteness`, `InklingToolkit`.
- **Key export:** `ParentDashboard(props: ParentDashboardProps)` and the
  `ParentDashboardProps` interface (`ParentDashboard.tsx:12-19`). **All props are
  typed `any[]` / `any`** (no real typing) — a deliberate-but-lossy choice.
- **What it surfaces:**
  - **"Daily Liturgy" card** (`:47-64`): **hard-coded** "Psalm 23: The Shepherd" /
    "The Lord is my shepherd…". Not data-driven; the "Start" button links to
    `/family-discipleship/devotionals`. (Dead/placeholder content — see Risks.)
  - **"Quick Create" generators** (`:67-88`): deep links to
    `/creation-station?sourceType=TOPIC&topicText=Math%20Quiz`, `…Spelling%20List`,
    and `/living-library/scan`.
  - **"Who is learning today?"** section (`:92-125`): renders
    `<StudentProfileSwitcher students={students} />` plus a "Pending Assessments"
    banner listing up to 5 students whose `learnerProfile === null`
    (`:104-122`), each linking to `/students/{id}/assessment`.
    - Split logic: `studentsWithAssessment` / `studentsWithoutAssessment` based on
      `s.learnerProfile !== null` (`:29-30`). `studentsWithAssessment` is computed
      but **never used** (dead var).
  - **`InklingToolkit`** nav block (`:128-133`) — cross-subsystem navigation.
  - **`ContextCompleteness`** (`:138`) — fed `completeness` + `suggestions` from the
    query (context engine, subsystem 06).
  - **Quick Actions** (`:142-163`): links to `/creation-station`, `/courses/new`,
    `/living-library/scan`, `/students`, `/blueprint`.
  - **Recent Resources** (`:168-214`) and **Recent Courses** (`:217-269`): list the 5
    most recent of each; each row hosts an `AssignResourceDialog` (subsystem 10) to
    assign to students. Resource rows show `resourceKind.label` + `createdAt`; course
    rows show `subject.name` + enrolled-student count and a "View" link to
    `/courses/{id}/builder`.
- **Notes:** Imports `getStudentAvatarUrl` (`:1`) and `Image` (`:3`) but **never uses
  them** (dead imports — avatars here are rendered inside `StudentProfileSwitcher`).

### `src/components/dashboard/StudentProfileSwitcher.tsx` — active-student picker (Client)

- **Role:** The avatar grid under "Who is learning today?". Clicking an avatar sets
  the active student; also offers an "Add Student" tile → `/students/new`.
- **Server/client:** `"use client"` (`:1`).
- **Mechanism:** Calls `useStudentProfile()` and uses **only `setActiveStudentId`**
  (`:21`). On avatar click → `setActiveStudentId(student.id)` (`:29`), which (via
  nuqs) pushes `?studentId=<id>` into the URL and — because the provider uses
  `shallow: false` — triggers a **server navigation**, re-rendering `/` into the
  `StudentDashboard` branch.
- **Avatars:** `getStudentAvatarUrl(preferredName||firstName, avatarConfig)` →
  DiceBear "lorelei" SVG (`lib/utils.ts:8-23`). `referrerPolicy="no-referrer"`.
  Fallback initial = `preferredName?.[0] || firstName[0]`.
- **Notes:** No tenancy concern (pure client; receives already-org-scoped `students`).

### `src/components/dashboard/StudentDashboard.tsx` — per-child dashboard (Client)

- **Role:** The child's "home": their courses, individual assignments, and a family
  discipleship section. Rendered by `/` when `studentId` resolves to a real student.
- **Server/client:** `"use client"` (`:1`). Fetches its own data **after mount**.
- **Data flow:**
  - On mount / when `student.id` changes, `useEffect` calls
    **`getStudentAssignments(student.id)`** (server action, `app/actions/student.ts`)
    and stores `{ assignments, courseEnrollments }` in state (`:27-35`). Shows a
    spinner while `loading` (`:78-81`).
  - **Courses** section (`:84-123`): maps `data.courseEnrollments`; each links to
    `/courses/{courseId}/learn`; shows `course.title`, `course.subject?.name`, and a
    status `Badge` (`COMPLETED` → secondary).
  - **Assignments** section (`:125-171`): maps `data.assignments`; shows
    `resource.title`, `resourceKind?.label`, optional `notes`; "Open Resource" →
    `/living-library/resource/{resourceId}`.
  - **Family Discipleship** (`:175-184`): renders
    `<DiscipleshipDashboard studentId={student.id} />` (subsystem: family discipleship).
- **Avatar / customizer:** Header avatar via `getStudentAvatarUrl` with local
  `avatarConfig` state seeded from `student.avatarConfig` (`:25`, `:46-49`). A pencil
  button opens `<AvatarCustomizer ...>` (profile subsystem); `onSave={setAvatarConfig}`
  updates the avatar locally after save (`:186-193`).
- **"Switch Profile" button** (`:73-75`): `onClick={() => setActiveStudentId(null)}` —
  clears `?studentId`, navigating back to the parent dashboard.
- **Notes / over-fetch:** The `student` prop comes from `getStudentDashboardData`,
  which selects `lastName`, `currentGrade`, and the **entire `learnerProfile`
  (`personalityData`, `learningStyleData`, `interestsData`)** — but this component
  uses **only** `id`, `firstName`, `preferredName`, `avatarConfig`. Those extra
  selections are dead/over-fetched (see Risks).

### `src/components/providers/StudentProfileProvider.tsx` — active-student context (Client)

- **Role:** App-wide React context wrapping the active-student selection in the URL.
- **Server/client:** `"use client"` (`:1`). Mounted globally in `app/layout.tsx`
  (`layout.tsx:40-45`), inside `<NuqsAdapter>`.
- **Implementation:** Backs state with **nuqs** `useQueryState("studentId", { shallow:
  false })` (`:15`). `shallow: false` is what makes selection a real navigation (RSC
  refetch) rather than a client-only URL tweak.
- **Context shape (`:6-10`):** `{ activeStudentId, setActiveStudentId,
  isStudentContext }`.
- **Exports:** `StudentProfileProvider` and the `useStudentProfile()` hook (throws if
  used outside the provider, `:28-34`).
- **CRITICAL note — partially dead API:** Across the whole codebase, consumers use
  **only `setActiveStudentId`** (in `StudentProfileSwitcher` and `StudentDashboard`).
  Neither `activeStudentId` nor `isStudentContext` is ever read anywhere
  (grep-verified). The "active student id" that actually drives rendering is read
  **server-side** from `searchParams` in `page.tsx`, not from this context. The
  context is effectively a thin "write the studentId URL param" helper.

### `src/server/queries/dashboard.ts` — dashboard data access (Server-only)

- **Role:** The two read queries backing the dashboards. `import "server-only"` (`:1`).
- **Server/client:** Server-only module; called from `page.tsx` (the only caller).
- **`getStudentDashboardData(organizationId, studentId)` (`:5-28`):**
  - `db.student.findUnique({ where: { id: studentId, organizationId }, select: {...} })`.
  - **Tenancy:** scoped — `organizationId` is part of the unique `where`, so a
    cross-org id returns `null` (which `page.tsx` then treats as "fall through to
    parent"). Note: `findUnique` with a non-`@unique` field (`organizationId`) in the
    `where` works because Prisma allows adding scalar filters alongside the unique
    `id`; the effect is "find by id AND org match or null".
  - Selects `id, firstName, lastName, preferredName, currentGrade, avatarConfig` and
    `learnerProfile { id, personalityData, learningStyleData, interestsData }`. (Most
    of this is unused downstream — see Risks.)
- **`getParentDashboardData(organizationId)` (`:30-124`):** five sequential queries:
  1. `analyzeContextCompleteness(organizationId)` → `{ completeness, suggestions }`
     (context engine; counts family/student/academic/library/schedule signals, max 5,
     returns a 0-100 %, `context-suggestions.ts:11-231`).
  2. **Recent resources** — top 5 `Resource` by `createdAt desc`, org-scoped, with
     `resourceKind` and `createdByUser` (`:37-59`).
  3. **Recent courses** — top 5 `Course` by `updatedAt desc`, org-scoped, with
     `subject` and enrolled `students` (`:62-89`).
  4. **Students** — up to 10 `Student` (org-scoped) with `avatarConfig` and
     `learnerProfile { id }` (used to compute "needs assessment") (`:92-107`).
  5. **Classroom name** — first `Classroom` by `createdAt desc` (`:110-114`).
  - **Tenancy:** every query is `where: { organizationId }` — fully org-scoped.
  - **Note:** No `try/catch`; any DB error bubbles to the route (Next error boundary).

### `src/app/student/dashboard/page.tsx` — separate schedule-only student page (Server Component)

- **Role:** A **second, independent** student view focused on the *daily schedule*.
  Not reachable from the main nav (only self-links). Belongs in this subsystem's docs
  because it is the "/student/dashboard" route, but its body is mostly subsystem 11.
- **Server/client:** Server Component.
- **Auth & tenancy:**
  - `auth()` → `redirect("/login")` if unauthenticated (`:18-19`).
  - `getCurrentUserOrg()` (**no session passed** here, so it re-fetches `auth()`
    internally — minor double-fetch) → `redirect("/onboarding")` if no org (`:21-22`).
  - `db.student.findMany({ where: { organizationId } })` — org-scoped (`:27-30`).
- **Logic:** Loads all org students (`id, firstName, preferredName`); if none, renders
  a plain "No students found" message (`:32-34`). Picks `currentStudentId` from
  `searchParams.studentId` or defaults to the first student (`:37-38`). Resolves
  `targetDate` from `searchParams.date` or `new Date()` (`:41`). Calls
  **`getStudentDailySchedule(currentStudentId, targetDate)`** (subsystem 11) → renders
  a left student-picker sidebar (links `/student/dashboard?studentId=...`, `:55-65`),
  a "View Weekly Planner" button (`/planner`), and `<DailyScheduleList ...>` (`:84-88`).
- **Notes:**
  - `items as any` / `events as any` casts (`:86-87`) — loose typing across the
    schedule boundary.
  - Uses its **own** student picker; does **not** use `StudentProfileSwitcher` or the
    `StudentProfileProvider`. So the two student views have **divergent** selection
    UX and divergent "viewing as" semantics.

---

## Data models & tenancy

Prisma models touched (directly or via selects) in this subsystem:

| Model | Where | Fields used |
|---|---|---|
| `User` | `getCurrentUserOrg` | `id`, `organizationId` |
| `Student` | dashboard queries, `/student/dashboard`, `student.ts` | `id, firstName, lastName, preferredName, currentGrade, avatarConfig, organizationId` |
| `LearnerProfile` | `getStudentDashboardData` / `getParentDashboardData` | `id`, `personalityData`, `learningStyleData`, `interestsData` (mostly unused) |
| `Resource` (+ `ResourceKind`, `User` as `createdByUser`) | recent resources | `id, title, createdAt, resourceKind{label,code}, createdByUser{name}` |
| `Course` (+ `Subject`, `CourseStudent`) | recent courses | `id, title, updatedAt, subject{name}, students` |
| `Classroom` | classroom name | `name`, `createdAt` |
| `ResourceAssignment` (+ `Resource`, `Course`, `Activity`) | `getStudentAssignments` | assignment fields + nested resource/course/activity |
| `CourseStudent` (+ `Course`, `Subject`) | `getStudentAssignments` | enrollment fields + course/subject |
| `Book`, `Course`, `Subject`, `Strand` (+ family/schedule master-context) | `analyzeContextCompleteness` | counts/relations for the completeness score |

**Tenancy posture:** Every server entry point resolves `organizationId` from the
session before any query, and every query is org-scoped. `getStudentAssignments` /
`saveStudentAvatarConfig` additionally call `assertStudentInOrg` (`student.ts:7-11`)
which throws `"Unauthorized"` if the student's org ≠ caller's org. There is **no
extra "is this user a parent vs the student" authorization** — any authenticated
org member can view any student in their org and switch profiles freely. There is no
distinct student login; "student dashboard" is a parent-driven view.

---

## Entry points & end-to-end flows

**Flow A — Parent dashboard (default):**
1. User hits `/` authenticated, no `studentId`.
2. `page.tsx` → `auth()` → `getCurrentUserOrg(session)` → `organizationId`.
3. `getParentDashboardData(organizationId)` runs 5 queries (incl. context engine).
4. `ParentDashboard` renders with students, recent resources/courses, completeness.

**Flow B — Select a student (the profile switcher):**
1. On the parent dashboard, user clicks an avatar in `StudentProfileSwitcher`.
2. `setActiveStudentId(student.id)` (nuqs, `shallow:false`) sets `?studentId=<id>`.
3. Because it's a non-shallow update, Next re-runs the **server** `/` route.
4. `page.tsx` sees `searchParams.studentId`, calls `getStudentDashboardData`.
   - Valid in-org id → renders `StudentDashboard`.
   - Invalid / cross-org id → `null` → **falls through to parent dashboard** silently.
5. `StudentDashboard` mounts → `useEffect` → `getStudentAssignments(studentId)`
   (server action, re-checks org) → renders courses + assignments + discipleship.
6. "Switch Profile" → `setActiveStudentId(null)` clears the param → back to parent.

**Flow C — Schedule-only student page (separate route):**
1. User navigates (only via internal self-links) to `/student/dashboard` (optionally
   `?studentId=&date=`).
2. `student/dashboard/page.tsx` → auth + org → load students → pick current student →
   `getStudentDailySchedule(studentId, date)` (subsystem 11) → `DailyScheduleList`.
- This route is **disconnected** from Flow A/B: different picker, no provider, no
  `StudentDashboard`. Effectively a parallel/legacy implementation.

---

## External dependencies & services

- **next-auth (`@/auth`)** — session (`auth()`), `User` type.
- **nuqs** (`useQueryState`, `NuqsAdapter` in `layout.tsx:3,39`) — URL-state for the
  `studentId` param; the entire profile-switch mechanism rides on it.
- **Prisma (`@/server/db`)** — all data access.
- **DiceBear API** (`https://api.dicebear.com/9.x/lorelei/svg`) via
  `getStudentAvatarUrl` (`lib/utils.ts:8-23`) — **external network image service**;
  avatars are remote SVGs (no caching/proxy in this subsystem).
- **@phosphor-icons/react** — icons (note: `ParentDashboard` uses the `/dist/ssr`
  variant; `StudentDashboard` uses the client variant).
- **date-fns** (`format`, and via scheduling action) — `/student/dashboard` only.
- **Cross-subsystem UI consumed:** `ContextCompleteness`, `InklingToolkit`,
  `AssignResourceDialog`, `AvatarCustomizer`, `DiscipleshipDashboard`,
  `DailyScheduleList`, shadcn `ui/*`.

---

## Auth / security posture

- **Every server entry checks auth + org** before rendering data (`page.tsx:14-26`,
  `student/dashboard/page.tsx:18-22`).
- **Server actions re-validate tenancy** independently (`assertStudentInOrg` in
  `student.ts`), so the client `StudentDashboard` cannot fetch another org's
  assignments even if it forged a `studentId`.
- **Org-scoped throughout** — no query omits `organizationId`.
- **No role gating** within an org (no parent-vs-student RBAC). Acceptable for the
  single-family model but worth noting if multi-user orgs are introduced.
- **Avatars are third-party remote URLs** (DiceBear). No SSRF/user-controlled-host
  issue (host is constant), but config values are URL-encoded and appended verbatim
  (`lib/utils.ts:12-20`) — low risk, cosmetic only.
- **Silent fall-through on invalid `studentId`** (`page.tsx:35`) is a UX/security
  choice: a bad/cross-org id does not error or leak; it just shows the parent
  dashboard. Reasonable, but means typos give no feedback.

---

## Risks, drift, dead-code & half-built

1. **Hard-coded "Daily Liturgy" placeholder** (`ParentDashboard.tsx:47-64`): "Psalm 23
   / The Lord is my shepherd" is static, not pulled from any devotional/liturgy data.
   It looks dynamic but is a stub. The "Start" button goes to
   `/family-discipleship/devotionals` regardless.
2. **Partially dead context API** (`StudentProfileProvider.tsx`): `activeStudentId`
   and `isStudentContext` are exposed but **never consumed** anywhere; only
   `setActiveStudentId` is used. The provider is effectively a "set studentId URL
   param" wrapper. Any future code relying on reading `activeStudentId` from context
   would work, but today it's unused surface.
3. **Two divergent student dashboards.** `/` (rich `StudentDashboard`) and
   `/student/dashboard` (schedule-only) are independent implementations with separate
   pickers and no shared selection state. This is confusing and a strong refactor/merge
   candidate. `/student/dashboard` is only self-linked (no nav points to it) — likely
   semi-orphaned/legacy.
4. **Over-fetch in `getStudentDashboardData`** (`dashboard.ts:11-27`): selects
   `lastName`, `currentGrade`, and the full `learnerProfile`
   (`personalityData/learningStyleData/interestsData`), none of which
   `StudentDashboard` uses. Wasted query payload (and pulls potentially large JSON
   `personalityData`).
5. **Weak typing everywhere.** `ParentDashboardProps` and `StudentDashboardProps` use
   `any`/`any[]` (`ParentDashboard.tsx:12-19`, `StudentDashboard.tsx:16-18`), and
   `/student/dashboard` casts `items/events as any`. Defeats compile-time safety on
   the dashboard data contracts.
6. **Dead vars/imports:** `studentsWithAssessment` computed but unused
   (`ParentDashboard.tsx:29`); `getStudentAvatarUrl` and `Image` imported but unused
   in `ParentDashboard.tsx:1,3`.
7. **Leftover placeholder comment** `// ... (auth checks) ...` (`page.tsx:16`).
8. **Double default** of `classroomName` (`page.tsx:48` and `ParentDashboard.tsx:31`).
9. **Client-side data fetch with no error handling** in `StudentDashboard`
   (`:27-35`): if `getStudentAssignments` throws, the spinner state is left as-is /
   the action error surfaces unhandled; no error UI.
10. **`/student/dashboard` re-fetches the session** by calling `getCurrentUserOrg()`
    without passing the already-obtained `session` (`:21`) — minor extra DB/auth round
    trip vs. the pattern used in `page.tsx`.

---

## Cross-links to other subsystems

- **Context engine (06):** `getParentDashboardData` → `analyzeContextCompleteness`
  (`lib/context/context-suggestions.ts`); rendered via `ContextCompleteness`.
- **Auth & tenancy (04):** `auth()`, `getCurrentUserOrg` (`lib/auth-helpers.ts`).
- **Courses / builder & assignments (10):** `AssignResourceDialog` (consumed only by
  `ParentDashboard`), links to `/courses/{id}/builder`, `/courses/{id}/learn`,
  `getStudentAssignments` reading `ResourceAssignment` / `CourseStudent`.
- **Planner & scheduling (11):** `DailyScheduleList` + `getStudentDailySchedule`
  used by `/student/dashboard`.
- **Family discipleship:** `DiscipleshipDashboard` rendered inside `StudentDashboard`.
- **Profile / avatars:** `AvatarCustomizer`, `getStudentAvatarUrl` (DiceBear),
  `saveStudentAvatarConfig` (`app/actions/student.ts`).
- **Layout/nav:** `app/layout.tsx` mounts `StudentProfileProvider` + `GlobalShell`;
  `Sidebar`/`InklingToolkit` provide the nav (Sidebar does NOT read student context).

---

## Open questions

- Is `/student/dashboard` (schedule-only) intended to be deprecated in favor of `/`’s
  `StudentDashboard`, or merged? Nothing links to it externally.
- Should the parent dashboard "Daily Liturgy" be wired to real devotional/liturgy data
  (currently hard-coded Psalm 23)?
- Is the `activeStudentId`/`isStudentContext` context API meant for a future feature
  (e.g., sidebar showing "viewing as X")? Today it's unused.
- Is there an intended student-vs-parent role distinction, or is single-family
  (any org member sees everything) the permanent model?
