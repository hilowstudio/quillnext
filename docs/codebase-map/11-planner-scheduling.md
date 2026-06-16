# 11 — Planner & Scheduling

> Code-truth reference. Verified against source on the `main` branch. Repo prose/markdown docs are known-stale; everything below was checked against the actual files cited. Line numbers are `file:line` at time of writing.

## Purpose & role in the app

This subsystem turns curriculum (`Course` → `CourseBlock` lessons) into dated, per-student work items and surfaces them in two UIs:

- A **weekly planner grid** (`/planner`) where a parent/teacher sees every student's week, drag-and-drops lessons between days, and adds ad-hoc activities into "smart slots".
- A **daily checklist** (`/student/dashboard`) where a single student's items for one day can be checked off (toggle complete/pending).

The core write path is **`distributeCourse`**: given a course + student + start date, it lays the course's `LESSON` blocks across the next N "school days", skipping weekends and the student's classroom holidays, creating one `StudentScheduleItem` per lesson.

Two **independent** holiday concepts exist and do NOT interoperate (see Risks):
1. **`ClassroomHoliday`** rows (DB) — the only holidays that `distributeCourse` actually honors.
2. **Computed US federal/religious holidays** (`src/lib/utils/holidays.ts`) — used purely for *visual hinting* in the onboarding calendar; never consulted by the scheduler.

The **`SessionTimer`** is an unrelated "time on site" badge in the sidebar; it touches no scheduling data and is grouped here only because it lives in `components/layout`.

---

## File-by-file reference

### `src/app/planner/page.tsx` — Weekly planner route (Server Component)

- **Role:** RSC entry for `/planner`. Auth-gates, resolves the week window, fetches data, renders header + `PlannerGrid`.
- **Server/client:** Server Component (no `"use client"`; uses `await auth()`).
- **Auth/tenancy:** `auth()` → redirect `/login` if no session (`page.tsx:17-18`); `getCurrentUserOrg()` → redirect `/onboarding` if no org (`:20-21`). Org-scoped.
- **Key behavior:**
  - Week derived from `?start=` searchParam, else `startOfWeek(today, { weekStartsOn: 1 })` — **Monday-start week** (`:27-28`).
  - Calls `getWeeklySchedule(organizationId, startDate, endDate)` (`:31`). NOTE: it passes `organizationId`, but the action **ignores** that arg and re-derives org from the session (see scheduling.ts).
  - Prev/next week links are `/planner?start=YYYY-MM-DD` (`:34-35,48-54`).
- **Notes / drift:**
  - The **"Auto-Reschedule" `<Button>` (`:57`) has no `onClick` and no handler** — pure dead UI. There is no reschedule action anywhere in the codebase (grep for `Reshuffle`/`reschedule` finds only the schema comment on `isLocked`).
  - `endOfWeek(startDate, …)` is computed from `startDate`, so when `?start=` is a non-Monday the displayed range can be > 7 days, but the grid itself always renders exactly 7 days from `startDate` (`PlannerGrid` `:85`), so header label and grid can disagree for arbitrary `start` values.

### `src/components/planner/PlannerGrid.tsx` — Drag-and-drop week grid (Client Component)

- **Role:** Renders the student-rows × 7-day-columns grid; handles drag-to-reschedule and the "smart slot" add-resource flow.
- **Server/client:** `"use client"` (`:2`). Uses `@dnd-kit/core`, `sonner`, `next/navigation`.
- **Exports:** `PlannerGrid` (named). Internal `DraggableItem`, `DroppableCell`.
- **Props:** `{ startDate, students[], items[], events[], organizationId }` — all typed `any[]` (`:71-83`). Data is fetched by the parent RSC and passed down.
- **Key behavior:**
  - `DroppableCell` id encodes target as `` `${studentId}:${date.toISOString()}` `` (`:47`). `handleDragEnd` splits on `":"` to recover `studentId`/`dateStr` (`:131`). **BUG RISK:** an ISO timestamp contains colons (`T08:00:00`), and `split(":")` is destructured into only two vars, so only the date *up to the first colon* survives into `dateStr` (e.g. `...T08`), then `new Date(dateStr)` parses it. In practice the cell date is local-midnight so `toISOString()` yields `...T00:00:00.000Z`; `dateStr` becomes `"...T00"` which `new Date` still parses to the correct UTC hour — fragile but currently functional. `studentId` (a UUID, no colons) is unaffected.
  - Drag move calls `moveScheduleItem(active.id, newDate)` then `router.refresh()` (`:138-143`). No optimistic UI (acknowledged in inline comment `:136-137`).
  - "Smart slot" `+` button opens `ResourcePicker` in `mode="universal"` (`:218-222`); on select, formats a title by resource type (BOOK→"Read:", VIDEO→"Watch:", GENERATED→label, else title) (`:103-113`) and calls `addAdHocEvent(studentId, date, title, description)` (`:116`).
  - **`router.refresh()` fires immediately after `toast.promise(...)` without awaiting it** (`:115-123`) — refresh races the create; relies on revalidateTag inside the action to eventually reconcile.
  - Cell rendering: items filtered by `studentId` + `isSameDay(item.date, day)` (`:181-184`); events shown if `studentId` matches OR `studentId` is null/empty (org-wide event) (`:187-190`).
  - Display label: `item.courseBlock?.title || item.activity?.title || "Untitled Activity"` (`:36`), subtitle = `courseBlock.course.title` (`:39`).
- **Notes / dead code:**
  - **`getCurrentUserOrg` is imported (`:13`) but never used** — a *server-only* helper (`@/lib/auth-helpers`, which imports `@/server/db`) pulled into a `"use client"` module. Dead import; should be removed (lint/bundle smell, and conceptually a server import in client code).
  - `addAdHocEvent` is imported at `:12`; `moveScheduleItem` at `:6` (two separate imports from the same module).
  - `onGenerate` handler is a stub: just `toast.info("Generators in Calendar view coming soon!")` (`:228-233`).
  - `description` for BOOK is `` `Read from ${resource.title}` `` with a `// TODO: Add link` (`:105`).

### `src/components/dashboard/DailyScheduleList.tsx` — Daily checklist (Client Component)

- **Role:** One student, one day. Lists events (read-only) and lessons as a check-off list with optimistic toggle.
- **Server/client:** `"use client"` (`:2`).
- **Exports:** `DailyScheduleList` (named).
- **Props:** `{ date, items: ScheduleItem[], events: CustomEvent[] }`. Local UI types defined inline (`:12-23`); `status` typed as the loose union `'PENDING'|'COMPLETED'|'SKIPPED'|string`.
- **Key behavior:**
  - Local `optimisticItems` state seeded from `items` via `useState(items)` (`:39`). **NOTE:** this is plain state, not `useOptimistic`, and is **not re-synced when the `items` prop changes** — if the parent re-renders with new server data (e.g. after navigation), the local list can go stale until remount. The "Optimistic UI" comments (`:34-37`) acknowledge the intended-but-unbuilt transition approach.
  - `handleToggle` flips `COMPLETED ↔ PENDING` only (`:42`); optimistically updates, calls `toggleItemStatus(itemId, newStatus)`, and reverts on throw (`:49-58`). `SKIPPED`/`IN_PROGRESS`/`MISSED` are never produced here.
  - Completed counter: `optimisticItems.filter(status==='COMPLETED').length / total` (`:68`).
  - Label fallbacks mirror the grid: `courseBlock?.title || activity?.title || "Untitled Lesson"` (`:113`).
  - Success toast is commented out (`:51`); only error toasts fire.

### `src/server/actions/scheduling.ts` — All scheduling server actions

- **Role:** The data layer for the whole subsystem. `"use server"` (`:1`). Imports `db`, `date-fns`, `next/cache` (`revalidateTag`, `unstable_cache`), `getCurrentUserOrg`.
- **Tenancy helpers (top of file):**
  - `requireOrg()` (`:13-17`) — `getCurrentUserOrg()` (throws if unauthenticated) and rejects null org. Every exported action calls this.
  - `assertStudentInOrg(studentId, org)` (`:19-22`) — verifies the `Student.organizationId` matches.
- **Internal scheduling helpers:**
  - `isSchoolDay(date, classroomId, schoolDaysOfWeek, holidays)` (`:25-40`) — false if `date.getDay()` not in `schoolDaysOfWeek`, or if any `holiday.holidayDate` `isSameDay`. `classroomId` param is unused.
  - `getNextSchoolDays(startDate, count, classroom)` (`:43-64`) — walks forward day-by-day collecting `count` school days. **`schoolDaysOfWeek` is HARDCODED to `[1,2,3,4,5]` (`:50`)** — it does NOT read `classroom.schoolDaysOfWeek`, so a family configured for e.g. a 4-day or Sun–Thu week is ignored. Holidays come from `classroom.holidays || []` (the `ClassroomHoliday` relation). Has a runaway guard that throws if no school day found within ~1 year (`:59-61`).

#### Exported actions

| Action | Signature | Auth | Models written/read | Notes |
|---|---|---|---|---|
| `distributeCourse` | `(courseId, studentId, startDateInput: Date\|string)` (`:66`) | `requireOrg` + `assertStudentInOrg` (`:72-73`) | reads `Course`+`blocks(kind:LESSON)`, `ClassroomStudent`→`Classroom.holidays`; writes `StudentScheduleItem` via `createMany` | Returns `{success,count}` or `{success:false,error}`. |
| `getWeeklySchedule` | `(_organizationId, startDate, endDate)` (`:144`) | `requireOrg` (ignores the passed org `:149-150`) | reads `Student`, `StudentScheduleItem`, `CustomEvent` | Wrapped in `unstable_cache`. |
| `getStudentDailySchedule` | `(studentId, date)` (`:204`) | `requireOrg` + `assertStudentInOrg` (`:208-209`) | reads `StudentScheduleItem`, `CustomEvent` (single day) | Ordered by `sequenceOrder`. |
| `toggleItemStatus` | `(itemId, status)` (`:245`) | `requireOrg` + per-item org check (`:249-254`) | updates `StudentScheduleItem.status` | `revalidateTag('schedule-{org}')`. |
| `moveScheduleItem` | `(itemId, newDate)` (`:267`) | `requireOrg` + per-item org check (`:269-274`) | updates `StudentScheduleItem.date` | `revalidateTag` on success. |
| `addAdHocEvent` | `(studentId, date, title, description?)` (`:291`) | `requireOrg` + `assertStudentInOrg` (`:298-299`) | creates `CustomEvent` (`isAllDay:true`) | `revalidateTag`. |

- **`distributeCourse` flow detail (`:66-142`):**
  1. Auth + student-in-org.
  2. Validate `startDate` (`:75-78`).
  3. Load course with `blocks` `where kind:'LESSON'` ordered by `position` (`:81-91`); reject if course's `organizationId` ≠ caller org (`:93`) or zero blocks (`:95`).
  4. Load the student's classroom via `ClassroomStudent.findFirst({ where:{studentId} })` including `classroom.holidays` (`:98-107`). **Uses `findFirst` with no ordering — if a student is in multiple classrooms, an arbitrary one is chosen.** Rejects if not enrolled (`:109-111`).
  5. `getNextSchoolDays(startDate, blocks.length, classroom)` → one date per lesson (`:114-118`).
  6. Build `StudentScheduleItem` rows: `{organizationId: course.organizationId, studentId, courseBlockId, date, sequenceOrder:index, status:'PENDING'}` and `createMany` (`:121-132`). `sequenceOrder` is the global lesson index, NOT a per-day order.
- **Caching note (`getWeeklySchedule`, `:152-201`):** `unstable_cache` key includes org + both ISO dates (`:194`), but the **invalidation tag is only `schedule-${org}` (no dates)** (`:196`). Good: any mutation's `revalidateTag('schedule-{org}')` busts *all* weeks for that org. The cache `revalidate: 3600` (1h) is a fallback. `status: { not: 'SKIPPED' }` filters the week query (`:166`) so SKIPPED items vanish from the planner.
- **Prisma typing:** Every `StudentScheduleItem`/`CustomEvent` access is via `(db as any)` (`:130,159,178,213,232,250,256,270,276,301`). This means the generated Prisma client in this repo does **not** type these models on `db` — a strong signal the client is out of sync with `schema.prisma`, or these models were added without regenerating. Confirmed they are real models in `schema.prisma` (lines 1296, 1332).
- **Validation gap:** `distributeCourseSchema` exists in `src/lib/schemas/actions.ts:33-37` but **`distributeCourse` never imports or uses it** — no Zod validation on any action in this file beyond manual `isNaN` checks.

### `src/lib/utils/holidays.ts` — US holiday computation (pure util)

- **Role:** Pure, dependency-light helpers to compute US federal + Christian holidays for a year, used to *decorate* the onboarding calendar. **Server/client-agnostic** (no directive; safely importable from client — only `date-fns`).
- **Exports:**
  - `Holiday` interface `{date, name, type:"FEDERAL"|"RELIGIOUS"|"OTHER"}` (`:3-7`).
  - `getHolidays(year): Holiday[]` (`:43-78`) — fixed (New Year, July 4, Veterans, Christmas) + floating (MLK, Presidents', Memorial, Labor, Columbus, Thanksgiving) + Easter-derived (Easter Sunday/Good Friday/Easter Monday via Meeus/Jones/Butcher `getEaster` `:25-41`).
  - `isHoliday(date): Holiday | undefined` (`:80-84`).
- **Notes:**
  - `getNthWeekdayOfMonth` fallback returns the 1st of the month if the Nth weekday isn't found (`:21`) — silently wrong rather than throwing, but for valid month/weekday/n it's fine.
  - **This module is NEVER consulted by the actual scheduler** (`scheduling.ts` only uses `ClassroomHoliday` rows). It's purely a UI hint in onboarding (see cross-links). Holidays here are not persisted; nothing copies computed holidays into `ClassroomHoliday`.

### `src/components/layout/SessionTimer.tsx` — "time on site" badge (Client Component)

- **Role:** Cosmetic. Counts minutes since mount, shows `Xm` / `Yh Zm` in the sidebar footer. Unrelated to scheduling data.
- **Server/client:** `"use client"` (`:1`).
- **Behavior:** `setInterval` +1 min every 60 s (`:9-14`); renders null for the first minute (`:16`). No persistence, no network, no auth. Resets to 0 on every full page load / remount.
- **Consumer:** Rendered once in `src/components/layout/Sidebar.tsx:104`.

---

## Data models & tenancy

All scheduling models are **org-scoped via `organizationId` (`@map("account_id")`)** and cascade-delete with the org/student.

### `StudentScheduleItem` (`schema.prisma:1296-1330`, table `student_schedule_items`)
- `id`, `organizationId`, `studentId`.
- Polymorphic-ish target: `courseBlockId?` (usually a LESSON) **or** `activityId?` (`:1302-1303`). Ad-hoc planner adds do NOT create schedule items — they create `CustomEvent`s instead.
- Timing: `date @db.Date`, optional `startTime`/`endTime` (`@db.Time`) — **start/end times are never set by any action** (always null).
- Lifecycle: `status ScheduleItemStatus @default(PENDING)`, `completedAt?` — **`completedAt` is never written**, even when `toggleItemStatus` sets `COMPLETED`.
- Ordering: `sequenceOrder Int @default(0)`, `isLocked Boolean @default(false)` ("Reshuffle should skip" — **`isLocked` is never read or written anywhere**).
- Relations: `organization`, `student`, `courseBlock?`, `activity?`. Indexes on `organizationId` and `[studentId, date]`.

### `CustomEvent` (`schema.prisma:1332-1363`, table `custom_events`)
- `id`, `organizationId`, optional `studentId?` (null = org/family-wide).
- `title`, `description?`, `location?` (location never set), `date @db.Date`, `startTime?`/`endTime?`, `isAllDay @default(false)`.
- Recurrence fields `recurrenceRule?` (iCal RRULE) + `parentEventId?` — **declared but completely unimplemented** (no code reads/writes them).
- Created only by `addAdHocEvent` with `isAllDay:true`.

### `ScheduleItemStatus` enum (`schema.prisma:1365-1371`)
`PENDING | IN_PROGRESS | COMPLETED | SKIPPED | MISSED`. Only `PENDING` (creation) and `COMPLETED`/`PENDING` (toggle) are ever used. `IN_PROGRESS`, `SKIPPED` (write), and `MISSED` are dead enum values from the scheduler's perspective (though `getWeeklySchedule` *filters out* `SKIPPED`).

### Classroom calendar models
- `Classroom` (`:213-243`): holds `schoolYearStartDate/EndDate` (`@db.Date`), `schoolDaysOfWeek Json?`, `dailyStartTime/EndTime`, `daysPerWeek`, `hoursPerDay`, `isYearRound`, `holidays ClassroomHoliday[]`. Org-scoped via `account_id`.
- `ClassroomHoliday` (`:264-277`, table `classroom_holidays`): `classroomId`, `holidayDate @db.Date`, `name`, `isAllDay`, optional `startTime`/`endTime`. Unique on `[classroomId, holidayDate, name]`. **This is the only holiday source the scheduler honors.**
- `ClassroomStudent` (`:336-348`): join table (`@@id([classroomId, studentId])`). `distributeCourse` resolves a student→classroom through this.

**Tenancy posture summary:** strong. Every action calls `requireOrg()`, and write/move/toggle actions additionally verify the *specific row's* org (`toggleItemStatus`/`moveScheduleItem`) or the student's org (`distributeCourse`/`addAdHocEvent`/`getStudentDailySchedule`). `getWeeklySchedule` deliberately ignores the caller-supplied `organizationId` and trusts only the session (`:149-150`). No IDOR found in this file.

---

## Entry points & end-to-end flows

### Flow A — Distribute a course onto the calendar
`CourseDistributor.tsx` dialog (rendered in `src/app/courses/[id]/builder/page.tsx`) → user picks student + start date → `distributeCourse(courseId, studentId, new Date(startDate))` (`CourseDistributor.tsx:41`) → server action loads LESSON blocks + student's classroom holidays → `getNextSchoolDays` (Mon–Fri minus `ClassroomHoliday`s) → `createMany` `StudentScheduleItem` rows (`status:PENDING`) → returns `{success,count}` → toast. **No `revalidateTag` is fired by `distributeCourse`**, so the planner's cached weeks are NOT busted on distribution — newly distributed lessons appear only after the 1h cache TTL expires or some other mutation revalidates `schedule-{org}` (a real freshness bug; see Risks).

### Flow B — View & reschedule a week
`/planner` RSC → `getWeeklySchedule(org, weekStart, weekEnd)` (cached) → `PlannerGrid` renders rows×days. Drag a `DraggableItem` onto a `DroppableCell` → `moveScheduleItem(itemId, newDate)` → updates `date`, `revalidateTag('schedule-{org}')` → `router.refresh()` re-pulls the (now-busted) cache.

### Flow C — Add an ad-hoc activity ("smart slot")
Hover a planner cell → `+` → `ResourcePicker mode="universal"` → select a book/video/article/doc/resource → `handleResourceSelected` formats a title → `addAdHocEvent(studentId, date, title, description)` → creates a `CustomEvent` (NOT a `StudentScheduleItem`) → `revalidateTag` → `router.refresh()` (fired un-awaited). Result renders in the yellow "event" pill, not as a draggable lesson.

### Flow D — Student daily check-off
`/student/dashboard?studentId=&date=` RSC → `getStudentDailySchedule(studentId, targetDate)` → `DailyScheduleList` → click an item → `toggleItemStatus(itemId, 'COMPLETED'|'PENDING')` (optimistic, revert on error) → `revalidateTag`.

### Flow E — Onboarding calendar holiday hints (decorative only)
`schedule-step.tsx` `DayPicker` uses `isHoliday(date)` (`schedule-step.tsx:162,173`) to tint federal/religious holidays. These computed holidays are **not** saved as `ClassroomHoliday`; the user manually picks `plannedOffDays` which a separate blueprint save action persists.

---

## External dependencies & services

- **`date-fns`** — everywhere (week math in `page.tsx`, `addDays`/`isSameDay`/`startOfDay` in `scheduling.ts`, all of `holidays.ts`).
- **`@dnd-kit/core`** — `DndContext`/`useDraggable`/`useDroppable` in `PlannerGrid`.
- **`sonner`** — toasts (planner, distributor, daily list).
- **`@phosphor-icons/react`** (+ `/dist/ssr` for the RSC) — icons.
- **`next/cache`** — `unstable_cache`, `revalidateTag`.
- **`react-day-picker`** + its CSS — onboarding calendar (cross-subsystem consumer of `holidays.ts`).
- **Prisma 7 / Postgres** via `@/server/db`.
- **No AI, no storage, no third-party network calls** in this subsystem.

---

## Auth / security posture

- All `/planner` and `/student/dashboard` routes are gated: `auth()` → `/login`, `getCurrentUserOrg()` → `/onboarding`.
- All server actions derive org from the session via `requireOrg()`; the only action that takes an org argument (`getWeeklySchedule`) explicitly discards it. Mutations verify the target row/student belongs to the caller's org. No trust of client-supplied org IDs → no obvious IDOR.
- `getCurrentUserOrg` returns `organizationId` straight from `User` (`auth-helpers.ts:9-30`); it can be `null` (action's `requireOrg` rejects null).
- **Client-side security smell:** `PlannerGrid.tsx:13` imports the server helper `getCurrentUserOrg` (which transitively imports `@/server/db`) into a `"use client"` file. It's unused so no DB code actually ships, but it's a footgun and a bundler red flag.
- No rate-limiting or input-length validation on `addAdHocEvent` title/description (free text persisted directly).

---

## Risks, drift, dead-code & half-built

1. **`distributeCourse` ignores `classroom.schoolDaysOfWeek`** — `getNextSchoolDays` hardcodes Mon–Fri (`scheduling.ts:50`). Families with custom/4-day/year-round weeks get wrong dates. The configured `schoolDaysOfWeek` JSON on `Classroom` is collected at onboarding but never used here.
2. **`distributeCourse` does NOT `revalidateTag`** — newly scheduled lessons don't show in `/planner` until the 1h cache TTL expires or another mutation busts `schedule-{org}`. Freshness bug.
3. **"Auto-Reschedule" button is dead** (`page.tsx:57`) — no handler, no backing action. `isLocked` on `StudentScheduleItem` exists solely to support a reschedule feature that was never built.
4. **Unused server import in client component** — `getCurrentUserOrg` in `PlannerGrid.tsx:13`.
5. **`DailyScheduleList` optimistic state never re-syncs** to prop changes (`useState(items)` only seeds once) — can show stale data after navigation without remount.
6. **`router.refresh()` not awaited after `addAdHocEvent`** (`PlannerGrid.tsx:115-123`) — refresh races the create; relies on revalidate to reconcile.
7. **Two disjoint holiday systems** — computed `holidays.ts` (decorative, onboarding) vs persisted `ClassroomHoliday` (scheduler). Federal holidays are NOT auto-applied to the schedule; a user must manually re-enter them as off days. High surprise factor.
8. **`(db as any)` on every schedule model** — the Prisma client doesn't type `StudentScheduleItem`/`CustomEvent`; client is out of sync with schema. Removes all compile-time safety on these queries.
9. **`distributeCourseSchema` is dead** (`actions.ts:33`) — defined but never wired into `distributeCourse`; no Zod validation on the action.
10. **Multi-classroom ambiguity** — `ClassroomStudent.findFirst({where:{studentId}})` with no ordering (`scheduling.ts:98`) picks an arbitrary classroom for a student enrolled in several.
11. **Drag droppable-id colon parsing is fragile** (`PlannerGrid.tsx:131`) — `split(":")` on an ISO string only works because cell dates are local-midnight (UTC offset still produces a parseable `...T00` prefix). Any change to cell-date construction could silently break drag targeting.
12. **Dead enum values / unwritten fields:** `IN_PROGRESS`, `MISSED`, `SKIPPED`-write, `StudentScheduleItem.completedAt`, `startTime`/`endTime`, `CustomEvent.location`, and the entire recurrence (`recurrenceRule`/`parentEventId`) feature are declared but unused.
13. **`onGenerate` smart-slot path is a stub** (`PlannerGrid.tsx:228`) — "coming soon" toast.
14. **`SessionTimer` resets on every page load** — counts time-since-mount, not a real session, so the "You've been here for X" tooltip is misleading across navigations that remount the sidebar.

---

## Cross-links to other subsystems

- **Courses / Course Builder** — `CourseDistributor.tsx` is rendered by `src/app/courses/[id]/builder/page.tsx`; it's the only caller of `distributeCourse`. `StudentScheduleItem` references `CourseBlock` (`schema.prisma:518`) and `Activity`.
- **Resource picker** — `PlannerGrid` reuses `src/components/courses/ResourcePicker.tsx` (`mode="universal"`) for smart-slot adds.
- **Onboarding / Blueprint** — `src/components/onboarding/schedule-step.tsx` consumes `holidays.ts:isHoliday` for the calendar and persists schedule config via `saveScheduleStep` (`@/server/actions/blueprint`). `src/lib/utils/course-pacing.ts` independently re-implements holiday/school-day counting against `Classroom.holidays` + `schoolDaysOfWeek` (used for pacing previews, NOT for `StudentScheduleItem` generation).
- **Layout** — `SessionTimer` is mounted by `src/components/layout/Sidebar.tsx:104`.
- **Auth** — `@/auth`, `@/lib/auth-helpers.getCurrentUserOrg`, `@/server/db` underpin every entry point.

---

## Open questions

1. Is "Auto-Reschedule"/`isLocked` planned, or should the dead button and field be removed?
2. Should computed federal/religious holidays (`holidays.ts`) be auto-materialized into `ClassroomHoliday` rows so the scheduler honors them? Right now they're decorative only.
3. Should `distributeCourse` (a) validate via `distributeCourseSchema`, (b) read `classroom.schoolDaysOfWeek` instead of hardcoding Mon–Fri, and (c) `revalidateTag('schedule-{org}')` after `createMany`? All three look like clear bugs.
4. Why is the Prisma client missing types for `StudentScheduleItem`/`CustomEvent` (forcing `db as any`)? Is `prisma generate` out of date in CI?
5. Intended behavior when a student is enrolled in multiple classrooms — which calendar wins?
6. Are `CustomEvent` recurrence fields and `StudentScheduleItem` start/end times on a near-term roadmap, or should they be dropped from the schema?
