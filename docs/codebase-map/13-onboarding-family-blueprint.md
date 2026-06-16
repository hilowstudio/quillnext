# 13 — Onboarding / Family Blueprint

> Code-truth reference. Verified against source on 2026-06-15. Where this doc and any prose/comment in the repo disagree, the **code wins**. Several in-code comments here are themselves stale (noted inline).

## Purpose & role in the app

The **Family Blueprint** is the first-run onboarding flow. It captures the household's educational identity (classroom name, instructors + PIN, **EducationalPhilosophy**, **FaithBackground**, academic goals) and its **schedule** (school year, school days, daily times, planned off-days/holidays), then persists it onto a single `Classroom` row. This data becomes the **family** and **schedule** slices of the **Master Context** that seeds all of Inkling's AI personalization and course pacing.

Two routes form the subsystem:

- **`/onboarding`** — the multi-step wizard that *writes* the blueprint (a client wizard driving server actions).
- **`/blueprint`** — a read-only *review/dashboard* page that renders the saved blueprint, a serialized AI-context preview, and a "Context Completeness" score with deep-links back into the wizard.

The flow also lazily **creates the `Organization`** on first save and links the signed-in `User` to it — so onboarding is effectively the org-provisioning entry point. It does **not** create `Student` rows; those are added later via `/students`. So the "Organization → Classroom → Student spine" is only partly built here: this subsystem builds **Organization → Classroom (+ Instructors + Holidays)**; Students are a downstream subsystem.

---

## File-by-file reference

### `src/app/onboarding/page.tsx` — wizard host (Server Component)
- **Role:** Auth gate + state hydration for the wizard. No `"use client"` → server component.
- **Flow:** `auth()` → redirect `/login` if no session (`page.tsx:10-12`) → `getCurrentUserOrg(session)` → `getBlueprintProgress(organizationId)` → renders `<OnboardingWizard initialStep={progress.step} initialData={progress.data} />` (`page.tsx:14-19`).
- **Auth/tenancy:** Authenticated only. Note `getBlueprintProgress` ignores the passed `organizationId` and re-derives org from the session anyway (see below), so the arg here is decorative.
- **Prisma:** none directly (delegated to the action).

### `src/app/blueprint/page.tsx` — blueprint review dashboard (Server Component)
- **Role:** Read-only summary of the saved blueprint + AI-context preview + completeness scoring.
- **Flow:** `auth()` → `/login` if unauth (`13-17`); `getCurrentUserOrg()` (no session passed → re-fetches) → if no `organizationId` redirect `/onboarding` (`19-22`); `getBlueprintProgress(organizationId)` → if `progress.data` is null redirect `/onboarding` (`24-28`).
- **Context:** `getMasterContext({ organizationId })` then `serializeMasterContext(masterContext, { includeDetails: true, maxTokens: 3000 })` for the preview (`31-63`).
- **Counts (4 parallel queries):** `student.count`, `student.count` where `learnerProfile isNot null`, `book.count`, `course.count` — all org-scoped (`36-46`). `coursesCount` is fetched but **never used** (dead read).
- **Completeness:** 5 weighted items (family, schedule, students, studentProfiles, library) → percentage (`49-58`). NB: it counts only 5 items but separately computes `masterContext.metadata.contextCompleteness` (5 different items incl. academic) — two parallel scoring systems, see Risks.
- **UI:** Cards for Classroom Info (philosophy, faith, descriptions), Schedule (year, daily times, school-days count, holiday count), AI Context Preview, Context Completeness with deep-links `"/onboarding?step=1|2|3"`, `/students`, `/living-library/scan`.
- **Notes / drift:**
  - Reads `(progress.data as any).holidays` as an **array with `.length`** (`154-158`) — but `progress.data` is a `Classroom` with a `holidays` relation that **is** included by `getBlueprintProgress`, so this works; it's `as any` only to dodge typing.
  - The "Download Context" `<form action>` is a no-op server action (`185-189`); the actual download is a client `data:` URI link. The empty server action is **dead code**.
  - "Edit Environment" deep-links to `/onboarding?step=3` (`183`) — step 3 is the Environment step that is effectively **orphaned** (see wizard + action notes). `getBlueprintProgress` never returns step 3 as "incomplete," so the user is routed to a step whose data is never read back into Master Context UI in a first-class way.

### `src/components/onboarding/onboarding-wizard.tsx` — client wizard shell (`"use client"`)
- **Role:** Renders the 3-step progress bar, the active step component, and Prev/Next nav. Holds the cross-step `isSaving` flag.
- **State model:**
  - Current step lives in the **URL query param `step`** via `nuqs` `useQueryState("step", parseAsInteger.withDefault(1))` (`22,31`). This is the *single source of truth* for step; the page's `initialStep` prop is **ignored** (never wired into `setStep`).
  - `steps` array = `[Classroom, Schedule, Environment]` (`34-38`).
  - `CurrentStepComponent` chosen by `currentStepIndex = clamp(step-1, 0, 2)` (`40-41`).
  - There is **no shared form state across steps** — each step owns its own `react-hook-form`. Cross-step data is reloaded only from the server (`initialData`), which is the same `Classroom` row passed to all three.
- **Navigation:** The Prev/Next buttons live in the wizard but submit the **child form by `form={`onboarding-step-${step}`}`** (`158,171`). Each step renders `<form id={formId}>`. `handleNext` (`45-51`): if last step → `window.location.href = "/blueprint"`; else `setStep(step+1)`. Children call `onSaveComplete` (= `handleNext`) after a successful save.
- **Auth/tenancy:** none here; delegated to child + action.
- **Notes:** `initialData` is typed `any` and forwarded unchanged to every step (`131`). On the **last step (Environment)** the "Complete Setup" button submits the Environment form; on save it routes to `/blueprint`.

### `src/components/onboarding/classroom-step.tsx` — Step 1 (`"use client"`)
- **Role:** Captures classroom name, dynamic instructor list, 4-digit PIN, EducationalPhilosophy (+Other), FaithBackground (+Other), up to 3 academic goals.
- **Form:** `react-hook-form` + `zodResolver(classroomStepSchema)`. Defaults hydrate from `initialData` (the saved `Classroom`), e.g. philosophy defaults to `"TRADITIONAL_SCHOOL_AT_HOME"`, faith to `"PROTESTANT"` (`57,59`).
- **Submit path (`83-106`):** `fetch("/api/auth/user-org")` to get `{ userId, organizationId }` → `await saveClassroomStep(organizationId, userId, data)` → `onSaveComplete()`. **Errors are surfaced via `alert()`** — no inline error UI for save failures.
- **Instructor UI:** add/remove via `setValue("instructors", …)` with a minimum of 1 (`67-81`). Collects `firstName`, `lastName`, `email`, `whatStudentsCall`. **`sex` is in the schema but has NO input in this UI** (so it is always `undefined`).
- **Academic goals:** hard-coded list of 7 long strings, max 3 selectable; persisted verbatim as `String[]` (`370-415`).
- **Notes:** The Philosophy/Faith `<SelectItem>` value lists match the Zod enums exactly. There is a hidden submit `<Button className="hidden">` so Enter submits (`423`), but the real trigger is the parent wizard's `form=`-linked button.

### `src/components/onboarding/schedule-step.tsx` — Step 2 (`"use client"`)
- **Role:** School-year start/end, year-round toggle, school days (explicit weekdays **or** "varies → days/week"), daily times (explicit **or** "varies → hours/day"), optional breaks, and a multi-month `react-day-picker` for planned off-days with US holiday highlighting.
- **Form:** `react-hook-form` + `zodResolver(scheduleStepSchema)`. Rich default hydration handling both `string` and `Date` time formats from `initialData` (`80-93`).
- **Conditional logic:**
  - `isYearRound` effect auto-sets end date = start + 1 year (`113-118`).
  - Local `variesWeekly` state toggles between explicit `schoolDaysOfWeek` buttons and a `daysPerWeek` Select (`104,379-423`).
  - `dailyTimesVary` toggles explicit time inputs vs an `hoursPerDay` Select (`463-509`).
- **Submit sanitization (`182-212`):** if `variesWeekly` → clears `schoolDaysOfWeek=[]`; else clears `daysPerWeek`. If `dailyTimesVary` → clears start/end times; else clears `hoursPerDay`. Then `saveScheduleStep(organizationId, payload)`.
- **Calendar:** `DayPicker` mode `multiple`, custom Shift-click range selection (`308-332`), holidays from `isHoliday()` (`src/lib/utils/holidays.ts`). Off-days persisted as `Date[]` → `plannedOffDays`.
- **Notes / drift vs server:**
  - **`breaks`, `daysPerWeek`, `hoursPerDay`, `isYearRound`, `dailyTimesVary` are collected and validated client-side but the server action `saveScheduleStep` IGNORES `breaks`, `daysPerWeek`, `hoursPerDay`, `isYearRound`, `dailyTimesVary`.** Those columns exist on `Classroom` (`schema.prisma:231-234`) but are never written by the action. Breaks have an explicit `// For now, we'll skip breaks` comment (`blueprint.ts:199-200`). This is a real data-loss path: "varies week by week" / "times vary" / hours-per-day / year-round flag / breaks are silently dropped.
  - `@ts-ignore` on `CustomDayButton` for react-day-picker v9 typing (`170`).

### `src/components/onboarding/environment-step.tsx` — Step 3 (`"use client"`, effectively orphaned)
- **Role:** Multi-select chips for philosophy preferences, resource types, goals, device types, challenges + free-text "additional faith background context."
- **Form:** `react-hook-form` + `zodResolver(environmentStepSchema)`. **All defaults are empty / no `initialData` hydration** (`79-87`) — so revisiting `?step=3` always starts blank even if previously saved.
- **Submit (`101-122`):** `fetch user-org` → `saveEnvironmentStep(organizationId, data)` → `onSaveComplete()` (which, being the last step, routes to `/blueprint`).
- **Why "orphaned":** `getBlueprintProgress` only ever returns `step: 2` or `step: 3` where `3` means "done" (`blueprint.ts:305-309`). With a saved schedule, the wizard would open at step 3 (Environment) — but normal forward navigation from step 2's "Next" goes to step 3 too. The data **is** persisted (to `Classroom.environmentPreferences` JSON) and **is** read by `getFamilyContext` into `FamilyContext.environment`. So it's not fully dead, but its place in the linear flow is muddled and it never rehydrates.

### `src/server/actions/blueprint.ts` — server actions (`"use server"`)
All four functions re-derive identity from the session via `getCurrentUserOrg()` and **deliberately overwrite any caller-supplied `organizationId`/`userId`** (good tenancy hygiene; comments at `31`, `155`, `281`).

- **`saveClassroomStep(organizationId, userId, data)` (`26-145`):**
  - Validates with `classroomStepSchema.parse`. Hashes PIN with `bcrypt.hash(pin, 10)` (`39`).
  - In a `$transaction`: if user has **no org**, creates `Organization { name: "<lastName> Family", type: "PARENT_INSTRUCTOR" }` and links `User.organizationId` (`46-63`). Then upsert-by-find the newest `Classroom` for the org (find-first-then-create/update, **not** a real upsert).
  - On create, sets placeholder schedule (`schoolYearStartDate/EndDate = new Date()`, `schoolDaysOfWeek = [1..5]`) to satisfy non-null columns (`98-102`).
  - **Instructors:** `deleteMany` all then recreate all (`108-128`). **BUG:** every instructor is created with `userId: index === 0 ? userId : userId` — i.e. **always the same `userId`** (`118`). `ClassroomInstructor` has `@@unique([classroomId, userId])` (`schema.prisma:260`), so **creating a 2nd instructor throws a unique-constraint violation** and the whole transaction fails. Multi-instructor onboarding is broken.
  - Also writes `User.name` from the first instructor (`131-138`). `revalidatePath("/onboarding")`.
- **`saveScheduleStep(organizationId, data)` (`151-226`):**
  - Re-derives org; throws "complete Step 1 first" if none. Finds newest classroom (throws if none).
  - Parses `dailyStartTime`/`dailyEndTime` only when `!dailyTimesVary` into `Date` objects (today's date + HH:MM) (`172-185`).
  - Updates `Classroom`: `schoolYearStartDate/EndDate`, `schoolDaysOfWeek`, `dailyStartTime/EndTime` (`188-197`). Replaces holidays: `classroomHoliday.deleteMany` then create one per `plannedOffDays` with `name: "Planned Day Off", isAllDay: true` (`203-221`).
  - **Ignored fields:** `breaks` (explicit skip), `daysPerWeek`, `hoursPerDay`, `isYearRound`, `dailyTimesVary` — none written (see Risks). `revalidatePath("/onboarding")`.
  - **Latent bug:** `ClassroomHoliday` has `@@unique([classroomId, holidayDate, name])` and every off-day uses the **same name** `"Planned Day Off"`; selecting the same date twice can't happen (dedup in UI), so this is usually safe — but all-same-name means the constraint provides no real protection.
- **`saveEnvironmentStep(organizationId, data)` (`234-274`):**
  - Re-derives org; finds newest classroom. Writes the 6 environment arrays/string into `Classroom.environmentPreferences` (JSON) (`254-269`). `revalidatePath("/onboarding")` + `revalidatePath("/blueprint")`. The big comment block at `228-233` ("Requires adding `environmentPreferences Json?`... workaround...") is **stale** — the column already exists (`schema.prisma:230`).
- **`getBlueprintProgress(organizationId)` (`280-310`):**
  - Re-derives org from session (ignores arg, `281-283`). Returns `{ step: 1, data: null }` if no org or no classroom.
  - Loads newest `Classroom` with `instructors` + `holidays` included. Returns `step = hasSchedule ? 3 : 2` where `hasSchedule` is just "start & end dates exist" — but those are **always set** (placeholders on create), so after Step 1 this effectively always reports `3`. Comments admit "Step 3 removed" / "we only have 2 steps" (`305-309`) which **contradicts** the 3-step wizard array. Doc-drift between action and UI.

### `src/lib/schemas/onboarding.ts` — Zod schemas (shared client+server)
- **Exports:** `instructorSchema`, `classroomSchema`, `scheduleSchema`, `environmentSchema`, `familyBlueprintSchema`, plus type aliases (`Instructor`, `Classroom`, `Schedule`, `Environment`, `FamilyBlueprint`) and step aliases `classroomStepSchema/scheduleStepSchema/environmentStepSchema` (the latter three are just re-exports of the base schemas, `117-119`).
- **Key constraints:** `instructorPin` regex `^\d{4}$` (`19`); `educationalPhilosophy`/`faithBackground` enums **match the Prisma enums exactly** (verified vs `schema.prisma:925-965`); `academicGoals` max 3; `schoolDaysOfWeek` ints 0–6; `breaks[].startTime/endTime` `HH:MM` regex; `plannedOffDays: z.date()[]`.
- **Notes:** `instructorSchema` includes `sex` and `whatStudentsCall` — `whatStudentsCall` has **no DB column** (only used in Master Context as a hardcoded `null`, `master-context.ts:346`) and `sex` has a column but no UI input. `familyBlueprintSchema` (the combined schema) is **defined but never imported anywhere** — dead export; saving is per-step, not combined.

---

## Data models & tenancy

Models touched (all in `prisma/schema.prisma`):

- **`Organization`** (`102-122`): created lazily in `saveClassroomStep`; `type` enum set to `PARENT_INSTRUCTOR`. Tenancy root.
- **`User`** (`140-173`): `organizationId` (mapped `account_id`) linked on first save; `name` updated from instructor 1.
- **`Classroom`** (`213-243`): the **single canonical store** for the whole blueprint. Holds philosophy/faith enums + `*Other` strings, school year dates (`@db.Date`), `schoolDaysOfWeek` (Json), `dailyStartTime/EndTime` (`@db.Time`), `environmentPreferences` (Json), `academicGoals` (`String[]`), and the **unused-by-action** columns `dailyTimesVary`, `daysPerWeek`, `hoursPerDay`, `isYearRound`.
- **`ClassroomInstructor`** (`245-262`): `@@unique([classroomId, userId])` — the constraint the multi-instructor bug violates. Stores `instructorPin` (bcrypt hash), `role` (`PRIMARY`/`ASSISTANT`), `sex?`.
- **`ClassroomHoliday`** (`264-277`): one row per planned off-day, `@@unique([classroomId, holidayDate, name])`.
- **`Student`** — **not created here** (only counted in `/blueprint`). The classroom-student link (`ClassroomStudent`) is also untouched by this subsystem.

**Tenancy posture:** Strong. Every server action ignores caller-supplied org/user and uses `getCurrentUserOrg()` (session-derived) — see `auth-helpers.ts`. All counts/queries in `/blueprint` are `where: { organizationId }`. The only "trust the client" hop is the `/api/auth/user-org` round-trip in the client steps, but the server action re-validates anyway, so a forged org id is harmless.

---

## Entry points & end-to-end flows

**Entry into onboarding:** redirected from `src/app/page.tsx:24-25` (home) and `src/app/blueprint/page.tsx:21` whenever `organizationId` is null; also from `context-suggestions.ts` action links (`actionUrl: "/onboarding"`). Protected by both `proxy.ts:18-22` and `auth.config.ts:27-29` (authenticated only).

**Primary flow — first run:**
1. User (no org) hits `/` → redirect `/onboarding`.
2. `onboarding/page.tsx` → `getBlueprintProgress` returns `{ step:1, data:null }` → wizard opens at step 1.
3. **Step 1 submit:** client `GET /api/auth/user-org` → `saveClassroomStep` → (in txn) create Org, link User, create Classroom (placeholder schedule), create instructor(s), set User.name → revalidate → `setStep(2)`.
4. **Step 2 submit:** `saveScheduleStep` → update Classroom dates/days/times, replace holidays from `plannedOffDays` → `setStep(3)`.
5. **Step 3 submit:** `saveEnvironmentStep` → write `Classroom.environmentPreferences` → `window.location.href = "/blueprint"`.
6. `/blueprint` reads the Classroom + `getMasterContext` → renders summary, serialized AI context preview, and completeness score.

**Resume flow:** Returning user with a classroom → `getBlueprintProgress` returns `step:3` + the full `Classroom` (with instructors+holidays) as `initialData`. But the **URL `?step=` param overrides** `initialStep`, so deep-links like `/onboarding?step=1` (from the `/blueprint` "Edit" buttons) land exactly on the requested step, pre-filled from `initialData`.

**Consumption flow (how blueprint seeds context):** `getFamilyContext` + `getScheduleContext` (`src/lib/context/master-context.ts`) read the newest Classroom (+instructors, +holidays, +environmentPreferences) into `FamilyContext`/`ScheduleContext`. These feed `getMasterContext` → `serializeMasterContext` for all Inkling AI prompts, and `calculateCoursePacing` (`src/lib/utils/course-pacing.ts`) uses `schoolDaysOfWeek` + holidays + year dates for course scheduling.

---

## External dependencies & services

- **`next-auth`** (`@/auth`, `@/lib/auth-helpers`) — session + org derivation.
- **`bcryptjs`** — instructor PIN hashing (cost 10), `blueprint.ts:14,39`.
- **`zod`** + **`@hookform/resolvers/zod`** + **`react-hook-form`** — validation/forms.
- **`nuqs`** — URL-synced step state in the wizard.
- **`framer-motion`** — step/element animations.
- **`react-day-picker`** + **`date-fns`** — schedule calendar & off-day selection.
- **`@/lib/utils/holidays`** — local US federal/religious holiday computation (incl. Easter algorithm); **client-side only, no DB** — purely for calendar highlighting/tooltips.
- **Prisma 7** (`@/server/db`, `@/generated/client`) — Postgres.
- No external AI/LLM/storage calls are made *inside* this subsystem; AI consumption happens downstream via Master Context.

---

## Auth / security posture

- All routes redirect unauthenticated users to `/login` (server-component `auth()` checks + `proxy.ts` + `auth.config.ts`).
- Server actions enforce tenancy by **re-deriving** org/user from session and discarding client-supplied identifiers — strong against IDOR.
- **PIN handling:** PIN is bcrypt-hashed before storage (good). However the PIN is **re-entered every Step 1 save** (the field defaults to `""`, `classroom-step.tsx:56`) and is `.parse`-required, so editing classroom info later **forces re-typing the PIN** or the save fails validation. Also `saveClassroomStep` deletes+recreates instructors on every save, **rehashing/overwriting the PIN each time** — fine functionally, but means the PIN can't be left blank to "keep existing."
- `/api/auth/user-org` (`route.ts`) returns the caller's own `{userId, organizationId}` only; `force-dynamic`; 401 on failure. Low risk.
- Minor: `/blueprint` "Download Context" emits an unauthenticated `data:` URI of the serialized context (client-side only, same user) — not a leak vector.

---

## Risks, drift, dead-code & half-built

1. **BUG (blocking): multi-instructor save crashes.** `saveClassroomStep` assigns the same `userId` to every instructor (`blueprint.ts:118`) but `ClassroomInstructor` is `@@unique([classroomId, userId])`. Adding a 2nd instructor → unique-constraint error → whole transaction rolls back → onboarding fails. Single-instructor families are unaffected.
2. **Data loss in Step 2:** `breaks`, `daysPerWeek`, `hoursPerDay`, `isYearRound`, `dailyTimesVary` are captured + validated client-side but **never persisted** by `saveScheduleStep`, despite all having `Classroom` columns. "Varies week by week," "times vary," and breaks silently vanish.
3. **Environment step is half-wired:** persisted to JSON and read by `getFamilyContext`, but (a) the form never rehydrates from `initialData`, (b) the wizard/step-progress logic (`getBlueprintProgress` returns step 3 = "done") conflicts with it being a real editable step, and (c) `/blueprint` "Edit Environment" links to `?step=3` which always opens blank.
4. **Doc/comment drift:** `blueprint.ts:228-233` claims `environmentPreferences` must still be added (it exists); `blueprint.ts:305-309` says "Step 3 removed / only 2 steps" while the wizard ships 3 steps.
5. **Dead code:** `familyBlueprintSchema` (combined) is exported but never imported; `/blueprint` `coursesCount` query result unused (`page.tsx:45`); the empty "use server" download form (`page.tsx:185-189`).
6. **Schema/UI gaps:** `instructorSchema.whatStudentsCall` has no DB column (hardcoded `null` in Master Context, `master-context.ts:346`); `instructorSchema.sex`/`Classroom`-side `Sex` exists with no onboarding UI input.
7. **Two divergent completeness scores:** `/blueprint` computes its own 5-item score (`page.tsx:49-58`) separate from `masterContext.metadata.contextCompleteness` and from `analyzeContextCompleteness` (`context-suggestions.ts`). They can disagree (e.g. academic is in metadata but not the page score).
8. **`getCurrentUserOrg(existingSession?: any)` is `any`-typed** (`auth-helpers.ts:9`) — minor type-safety gap on the hot path.
9. **`initialStep` prop is dead:** the wizard ignores it in favor of the `?step` URL param (`onboarding-wizard.tsx:31`), so server-computed resume step has no effect unless reflected in the URL.

---

## Cross-links to other subsystems

- **Auth & tenancy (04):** `@/auth`, `getCurrentUserOrg` (`src/lib/auth-helpers.ts`), `proxy.ts`, `auth.config.ts`, `/api/auth/user-org`.
- **Master Context / AI context (consumer):** `src/lib/context/master-context.ts` (`getFamilyContext`, `getScheduleContext`), `context-serializer.ts`, `context-suggestions.ts` (links back to `/onboarding`), `/context` page.
- **Planner / scheduling (11):** `src/lib/utils/course-pacing.ts` consumes `schoolDaysOfWeek`, holidays, year dates from the Classroom this subsystem writes.
- **Dashboard / home:** `src/app/page.tsx` and `ParentDashboard` redirect to `/onboarding` and surface `classroomName`/completeness; `MainNav` treats `/blueprint` as part of "My Classroom."
- **Students (downstream spine):** `/students` (linked from `/blueprint`) creates `Student` rows and learner profiles — **not** created here.
- **Living Library:** `/living-library/scan` linked from `/blueprint` completeness ("Add Books").

---

## Open questions

1. Is the 3-step wizard (with Environment) the intended UX, or was Environment meant to be removed (per `blueprint.ts` comments)? The UI and the action disagree.
2. Are `breaks`/`daysPerWeek`/`hoursPerDay`/`isYearRound`/`dailyTimesVary` intended to be persisted? Columns exist; the action ignores them — is downstream pacing supposed to use them?
3. Should multi-instructor onboarding be supported (the UI offers "Add Instructor")? If so, the `userId` assignment + `@@unique([classroomId,userId])` model needs rework (e.g. nullable `userId` for non-account co-instructors).
4. Should `whatStudentsCall` (and `sex`) be persisted? The schema/UI/context are inconsistent.
5. Should editing classroom info require re-entering the PIN every time (current behavior), or should an empty PIN preserve the existing hash?
