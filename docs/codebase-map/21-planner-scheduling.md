# 21 — Planner & Scheduling
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope
| File | Lines | Role |
|------|-------|------|
| `src/app/planner/page.tsx` | 73 | Server route `/planner`. Auth+org gate, parses `?start=`, fetches the week via `getWeeklySchedule`, renders header + `PlannerGrid`. |
| `src/components/planner/PlannerGrid.tsx` | 237 | Client grid: 7-day × students DnD board (`@dnd-kit`). Drag-move items, "smart slot" add-via-`ResourcePicker`. |
| `src/server/actions/scheduling.ts` | 363 | All scheduling server actions: distribute course → schedule items, weekly/daily reads, toggle status, move item, ad-hoc events. Tenant-scoped. |
| `src/lib/utils/holidays.ts` | 84 | Pure US holiday calendar helper (`getHolidays`, `isHoliday`). NOT consumed by scheduling.ts. |

## 2. Purpose / intent
Parent-facing weekly planner where a homeschool family lays out each learner's daily work. Two object types populate the grid (see 02-data-model):
- **`StudentScheduleItem`** — a scheduled `CourseBlock` (lesson) or `Activity`, with `status`, `sequenceOrder`, and an `isLocked` flag intended to protect items during reshuffle.
- **`CustomEvent`** — ad-hoc / all-day events (field trips, appointments), optionally tied to one student or org-wide (`studentId` nullable).

`distributeCourse` is the bulk-fill engine: it spreads a course's `LESSON` blocks across the next N **school days**, skipping weekends and `ClassroomHoliday` rows. The grid then lets the parent drag items to other days. The single-student daily view (16-students-learners) reuses `getStudentDailySchedule` + `toggleItemStatus`.

## 3. Architecture & key files
**Route → grid.** `planner/page.tsx:17-21` gates on `auth()` + `getCurrentUserOrg()`; `:23-28` resolves the week window with `date-fns` (`weekStartsOn:1`, Monday); `:31` calls `getWeeklySchedule(organizationId, startDate, endDate)`; `:63-69` hands `{students, items, events, organizationId}` to `PlannerGrid`.

**Grid (`PlannerGrid.tsx`).** `DndContext` wraps a header row of 7 days (`:85` `Array.from(...addDays)`) and one row per student. Each cell `DroppableCell` (`:45`) has id `"${studentId}:${date.toISOString()}"`; each item is a `DraggableItem` (`:15`). `handleDragEnd` (`:126`) parses the over-id, calls `moveScheduleItem(active.id, newDate)`, then `router.refresh()`. The "+" smart-slot button opens `ResourcePicker` (`:218`) in `mode="universal"`; selection routes through `handleResourceSelected` (`:96`) → `addAdHocEvent`.

**Server actions (`scheduling.ts`).** Auth scaffolding at top: `requireOrg()` (`:13`, session-derived org, never trusts caller) and `assertStudentInOrg()` (`:19`). School-day math: `isSchoolDay` (`:29`) and `getNextSchoolDays` (`:47`). Public actions: `distributeCourse` (`:70`), `getWeeklySchedule` (`:160`, `unstable_cache`'d, tag `schedule-${org}`), `getStudentDailySchedule` (`:226`), `toggleItemStatus` (`:273`), `moveScheduleItem` (`:301`), `addAdHocEvent` (`:331`). All run inside `withTenant(..., { organizationId, userId: null })`.

**Holidays helper.** `holidays.ts` computes fixed + floating US federal/religious dates (`getNthWeekdayOfMonth` `:10`, Meeus/Jones/Butcher Easter `:25`). Consumed only by `components/onboarding/schedule-step.tsx:18` (to pre-mark calendar) — see §6. The scheduler's holiday logic uses DB `ClassroomHoliday` rows instead, not this helper.

## 4. Data flow
**Distribute course (CourseDistributor → DB):**
`CourseDistributor.tsx:41` → `distributeCourse(courseId, studentId, date)` (`scheduling.ts:70`). `:76-77` org + student authz. `:85-99` fetch course with `blocks` where `kind:'LESSON'` ordered by position. `:101` re-check `course.organizationId === organizationId`. `:106-119` find the student's `ClassroomStudent` enrollment + classroom + holidays. `:126` `getNextSchoolDays(start, blocks.length, classroom)` walks day-by-day skipping non-school days (`:57-66`). `:133-148` build one `StudentScheduleItem` per block (`status:'PENDING'`, `sequenceOrder:index`) and `createMany`. Returns `{success, count}`.

**Weekly read (page → grid):** `page.tsx:31` → `getWeeklySchedule` (`:160`). First arg `_organizationId` is **ignored**; `:166` re-derives org from session. `unstable_cache` (`:168-221`) keyed `schedule-${org}-${startISO}-${endISO}`, tag `schedule-${org}`, 1h TTL. Inside: learners (`:172`), `StudentScheduleItem` in range with `status != SKIPPED` + courseBlock/activity titles (`:177`), `CustomEvent` in range (`:196`). All org-scoped.

**Drag-move (grid → DB → refresh):** `handleDragEnd` (`:126-149`) → `moveScheduleItem(itemId, newDate)` (`:301`). Inside `withTenant`: load item `organizationId`, throw `Unauthorized` if mismatch (`:306-310`), `update {date}` (`:312`). On success `revalidateTag(\`schedule-${org}\`)` (`:322`) then client `router.refresh()`.

**Add ad-hoc event:** `handleResourceSelected` (`:96-124`) builds a title by resource type, then `toast.promise(addAdHocEvent(...))` and immediately `router.refresh()` (`:123`, **not awaited** — see findings). `addAdHocEvent` (`:331`) authz student, creates `CustomEvent {isAllDay:true}`, revalidates tag.

**Daily read / toggle (cross-ref 16):** `student/dashboard/page.tsx:44` → `getStudentDailySchedule` (`:226`); `DailyScheduleList.tsx:50` → `toggleItemStatus` (`:273`).

## 5. Status table
| Unit | Status | Evidence |
|------|--------|----------|
| `PlannerPage` route | DONE | `page.tsx:12-72`; reachable via `/planner` links (`student/dashboard/page.tsx:71`). |
| `PlannerGrid` (render + DnD move) | DONE | `PlannerGrid.tsx:126-149` move wired to `moveScheduleItem`; rendered by page `:63`. |
| Smart-slot add (book/video/article/doc/resource) | PARTIAL | `:96-124` builds title but `description` for BOOK is `TODO: Add link` (`:105`); add is fire-and-forget, refresh races the write (`:115-123`). |
| Smart-slot **Generate** path | STUB | `onGenerate` just `toast.info("...coming soon!")` (`:228-233`). |
| "Auto-Reschedule" button | STUB/DEAD | `page.tsx:57` `<Button>Auto-Reschedule</Button>` has no `onClick`/handler; no reshuffle action exists anywhere. |
| `isLocked` reshuffle behavior | STUB | Schema field exists (`schema.prisma:1584`, comment "Reshuffle should skip moving this") but NO code reads/writes it (grep: only the schema line). |
| `distributeCourse` | DONE | `scheduling.ts:70-158`; consumer `CourseDistributor.tsx:41`. |
| `getWeeklySchedule` | DONE | `:160`; consumer `page.tsx:31`. |
| `getStudentDailySchedule` | DONE | `:226`; consumer `student/dashboard/page.tsx:44`. |
| `toggleItemStatus` | DONE | `:273`; consumer `DailyScheduleList.tsx:50`. |
| `moveScheduleItem` | DONE | `:301`; consumer `PlannerGrid.tsx:138`. |
| `addAdHocEvent` | DONE (wired) | `:331`; consumer `PlannerGrid.tsx:116`. |
| `isHoliday` | DONE (elsewhere) | `holidays.ts:80`; consumer `onboarding/schedule-step.tsx:18` (import), used `:162,173`. NOT used by scheduler. |
| `getHolidays` | DEAD (external) | `holidays.ts:43`; zero external importers (grep) — only called internally by `isHoliday` (`holidays.ts:82`). Exported but never imported anywhere. |
| `distributeCourseSchema` (Zod) | DEAD | `schemas/actions.ts:33`; zero importers (grep). `distributeCourse` does no Zod validation. |
| `schoolDaysOfWeek` param of `isSchoolDay` | PARTIAL | Accepted (`:29`) but caller hardcodes `[1,2,3,4,5]` (`:54`), ignoring `Classroom.schoolDaysOfWeek` Json (`schema.prisma:227`). |
| `classroomId` param of `isSchoolDay` | ✅ REMOVED (2026-06-19) | dropped the unused param + its call-site arg (Q-21-008). |

## 6. Integration points
- **Imports in:** `@/auth`, `getCurrentUserOrg` (`@/lib/auth-helpers`), `withTenant` (`@/server/db`), `date-fns`, `@dnd-kit/core`, `sonner`, `next/cache` (`revalidateTag`, `unstable_cache`), `next/navigation`, `ResourcePicker` (`../courses/ResourcePicker`), `@phosphor-icons/react`.
- **Importers out:** `getWeeklySchedule`←`planner/page.tsx`; `moveScheduleItem`,`addAdHocEvent`←`PlannerGrid.tsx`; `distributeCourse`←`courses/CourseDistributor.tsx`; `getStudentDailySchedule`←`student/dashboard/page.tsx`; `toggleItemStatus`←`dashboard/DailyScheduleList.tsx`; `isHoliday`←`onboarding/schedule-step.tsx:18` (`getHolidays` has NO external importers).
- **Prisma models used:** `Learner`, `Course`+`CourseBlock`, `ClassroomStudent`+`Classroom`+`ClassroomHoliday`, `StudentScheduleItem`, `CustomEvent`, `Activity` (via include). Models documented in 02-data-model.
- **Env vars / external APIs:** none direct (uses tenant DB only).
- **Inngest jobs:** none.
- **Cache tags:** `schedule-${organizationId}` (set + busted in this file).
- **Cross-refs:** course `LESSON` blocks & pacing → 17-course-pacing / 20-courses-builder; daily schedule view + `toggleItemStatus` UI → 16-students-learners; `ClassroomHoliday` write path → `server/actions/blueprint.ts:237-249` (onboarding/blueprint, 13-onboarding); tenant gate (`getCurrentUserOrg`, `withTenant`) → 04-security-auth-tenancy.

**Pacing vs. distribution.** `lib/utils/course-pacing.ts` (17-) computes *how many* lessons/day from a date range and a `plannedOffDays` set (its own local `isHoliday` var, `course-pacing.ts:114` — unrelated to `holidays.ts`). `distributeCourse` here does the *placement* (one block per consecutive school day) and does NOT consult pacing output — the two engines are independent and not wired together.

## 7. Findings

Q-21-001  [LOW]  Classroom `schoolDaysOfWeek` ignored; weekdays hardcoded — `src/server/actions/scheduling.ts:54`
  Evidence: `getNextSchoolDays` sets `const schoolDaysOfWeek = [1,2,3,4,5];` and passes it to `isSchoolDay`, never reading `enrollment.classroom.schoolDaysOfWeek` (the `Classroom.schoolDaysOfWeek` Json column, `schema.prisma:227`). The `isSchoolDay` signature even accepts a `schoolDaysOfWeek` param, signalling intent.
  Impact: Families on non-standard schedules (e.g., 4-day weeks, Sunday school) get lessons placed on days they don't teach. Schema↔code drift.
  Status: documented (not fixed)

Q-21-002  [LOW]  `distributeCourseSchema` is dead; `distributeCourse` does no schema validation — `src/lib/schemas/actions.ts:33`
  Evidence: grep shows `distributeCourseSchema` is exported but never imported. `distributeCourse` (`scheduling.ts:70`) validates only `isNaN(startDate)` (`:80`); `courseId`/`studentId` are taken as raw strings with no UUID/zod check.
  Impact: Dead validator (drift risk); inputs reach Prisma unvalidated. Authz still holds (org + ownership checks), so impact is limited to robustness/consistency.
  Status: documented (not fixed)

Q-21-003  [MED]  "Auto-Reschedule" button and `isLocked` reshuffle are unimplemented — `src/app/planner/page.tsx:57`, `prisma/schema.prisma:1584`
  Evidence: `<Button>Auto-Reschedule</Button>` has no handler. `StudentScheduleItem.isLocked` (comment: "Reshuffle should skip moving this") is read/written nowhere in the repo (grep: only the schema line). No reshuffle server action exists.
  Impact: A prominent, advertised feature is a no-op; the lock field is dead. Users may expect bulk catch-up/reshuffle and pinning that don't work.
  Status: documented (not fixed)

Q-21-004  [LOW]  Ad-hoc add fires before write completes (refresh race) — `src/components/planner/PlannerGrid.tsx:115-123`
  Evidence: `handleResourceSelected` calls `toast.promise(addAdHocEvent(...))` and then `router.refresh()` synchronously on the next line, without awaiting the action.
  Impact: The refresh frequently runs before the `CustomEvent` is committed/`revalidateTag` fires, so the new event may not appear until a later refresh. UX flakiness, not data loss.
  Status: documented (not fixed)

Q-21-005  [LOW]  Server-only helper imported into a client component (unused) — `src/components/planner/PlannerGrid.tsx:13`
  Evidence: `import { getCurrentUserOrg } from "@/lib/auth-helpers";` in a `"use client"` file; `getCurrentUserOrg` is never called in the component.
  Impact: Dead import of an auth/session helper into the client bundle; risks pulling server-side code into client graph and is misleading. No exploit, but should be removed.
  Status: documented (not fixed)

Q-21-010  [INFO]  `getStudentDailySchedule` filters by `studentId` only (no `organizationId` in the where-clause) — `src/server/actions/scheduling.ts:237-264`
  Evidence: `studentScheduleItem.findMany` (`:237`) and `customEvent.findMany` (`:256`) use `where: { studentId, date: {...} }` with no `organizationId` predicate. Tenant safety relies entirely on the preceding `assertStudentInOrg(studentId, organizationId)` (`:231`); the `withTenant` wrapper is RLS-inert (RLS OFF, 04-).
  Impact: Currently safe (the studentId is org-verified first), but the query is not self-contained — a future caller that forgets the pre-check would leak cross-org rows. Same shape is fine in `distributeCourse`'s `classroomStudent.findFirst` (`:107`, also pre-verified). Defensive: add `organizationId` to the where-clause.
  Status: documented (not fixed)

Q-21-009  [LOW]  `getHolidays` exported but has zero external importers — `src/lib/utils/holidays.ts:43`
  Evidence: grep across `**/*.{ts,tsx}` shows `getHolidays` referenced only at its definition (`holidays.ts:43`) and its internal call site inside `isHoliday` (`holidays.ts:82`). No file imports it. Only `isHoliday` is imported externally (`schedule-step.tsx:18`).
  Impact: Public-looking export that is effectively private/dead; mild API-surface drift. No functional impact.
  Status: documented (not fixed)

Q-21-007  [INFO]  ✅ VERIFIED 2026-06-19 — all `revalidateTag` sites in `scheduling.ts` already pass the required 2nd arg `{}`; the single-arg worker cases were Q-23-007; no code change needed. `revalidateTag(tag, {})` called with a spurious second argument — `src/server/actions/scheduling.ts:296,322,356`
  Evidence: `revalidateTag(\`schedule-${...}\`, {})` at lines 296, 322, 356. Next.js `revalidateTag` takes a single tag string. The `{}` second arg is ignored (and the pattern is repeated repo-wide, e.g. `src/app/actions/resource-library-actions.ts:233`).
  Impact: No functional bug today (extra arg ignored) but it's non-idiomatic and could break under a future signature change. Cosmetic/consistency.
  Status: documented (not fixed)

Q-21-008  [INFO]  ✅ RESOLVED 2026-06-19 — dropped the unused `classroomId` param from `isSchoolDay` + its call site (see CHANGELOG.md). Unused param `classroomId` on `isSchoolDay` — `src/server/actions/scheduling.ts:29`
  Evidence: `isSchoolDay(date, classroomId, schoolDaysOfWeek, holidays)` never references `classroomId` in its body; caller passes `classroom.id` (`:58`).
  Impact: Dead parameter — minor noise / leftover scaffolding.
  Status: documented (not fixed)
