# Subsystem 17 — Transcripts & PDF Export

> Code-truth reference. Verified against source on 2026-06-15. The repo's prose/markdown docs are unreliable; everything below is checked against the actual code with `file:line` citations. Working dir: `c:/Users/adam/quillnext`.

## Purpose & role in the app

This subsystem lets an organization (a homeschool / microschool family-account) build, save, preview, and export an **official high-school transcript** for a student. It computes GPA (weighted/unweighted) and total credits from per-course grades under a selectable grading scale, renders an on-screen 8.5"-wide preview, and exports a print-ready PDF via the browser's print dialog.

The transcript itself is stored as a single JSON blob (`Transcript.data`) keyed to a `studentId` + `organizationId`. There is exactly **one** Prisma model (`Transcript`); all the rich structure (courses, activities, tests, notes, grading settings, signature) lives inside the untyped `Json` column and is typed only at the application layer via `TranscriptData`.

The PDF is produced client-side: the app builds raw HTML from the transcript object and `document.write`s it into a popup window, then calls `print()`. Because that path is raw-HTML-string concatenation, user-controlled fields are HTML-escaped (`esc()`) and the drawn-signature data URL is validated against a `data:image/` prefix before being placed in an `<img src>`.

## File-by-file reference

### `src/app/transcripts/page.tsx` — Transcripts index (Server Component)
- **Role:** Lists every student in the caller's org as a card; each card deep-links to the per-student builder. Shows a "N Saved" badge and last-updated date from the most recent transcript.
- **Server/client:** Server Component (no `"use client"`; `async function`). Uses SSR Phosphor icons (`@phosphor-icons/react/dist/ssr`, line 8).
- **Auth/tenancy:** Calls `auth()` and redirects to `/login` if unauthenticated (lines 13-14). Resolves `organizationId` via `getCurrentUserOrg(session)` (line 17); if null, renders an "Organization Not Found" onboarding prompt (lines 19-29). Student query is org-scoped: `where: { organizationId }` (line 32).
- **Prisma models:** `Student` (with `transcripts` relation, `orderBy: updatedAt desc, take: 1`, lines 31-39).
- **Notes / drift:**
  - Uses `(db as any).student.findMany(...) as (...)[]` (line 31) — the `as any` defeats Prisma typing; a code smell that recurs across the codebase.
  - The whole body is wrapped in `try/catch` that logs and renders a generic error (lines 102-113), so a tenancy/DB error degrades to "Error Loading Students" rather than throwing.
  - No "create transcript" happens here — clicking a card just navigates to `/transcripts/[studentId]`.

### `src/app/transcripts/[studentId]/page.tsx` — Builder route (Server Component)
- **Role:** Loads either the latest saved transcript or freshly generated data, then renders the client `TranscriptBuilder`.
- **Server/client:** Server Component. `params` is a `Promise` (Next 15/16 async params), awaited at line 16.
- **Auth/tenancy:** `auth()` + redirect to `/login` (lines 13-14). Tenancy is **delegated** to the server actions it calls (`getTranscripts` / `generateTranscriptData`), both of which org-check the student. This page does not itself call `getCurrentUserOrg`.
- **Flow:** `getTranscripts(studentId)` (line 20). If a saved transcript exists, use `savedTranscripts[0].data` and inject the DB row id onto the JSON (`initialData.id = savedTranscripts[0].id`, line 26) so later saves UPDATE instead of INSERT. Otherwise `generateTranscriptData(studentId)` (line 29).
- **Notes:** Errors are caught and rendered inline including `(error as Error).message` (line 46) — this surfaces raw error strings like "Unauthorized"/"Student not found" to the user, which is how an out-of-org student id manifests.

### `src/server/actions/transcript.ts` — Server actions (`"use server"`, line 1)
All four exported actions re-authenticate and re-resolve the org per call; none trust the client for tenancy. `db` is from `@/server/db`; `auth` from `@/auth`.

- **`assertStudentInOrg(studentId, organizationId)`** (lines 29-33, private): throws `"Organization not found for user"` if org null, else looks up the student's `organizationId` and throws `"Unauthorized"` on mismatch. The shared tenancy guard.
- **`generateTranscriptData(studentId)`** (lines 39-124): builds a fresh `TranscriptData` from DB. Fetches `Student` with `organization`, latest `classroomEnrollment` (`take:1`, newest), and all `courseEnrollments` w/ `course` (lines 44-61). Multi-tenant guard at line 65 (`student.organizationId !== organizationId` → "Student not found"). Derives `gradeLevel` (9-12) by substring-matching `student.currentGrade` (lines 68-73) — defaults to 9. Maps each course enrollment into a `TranscriptCourse` with `subject: "General"`, `grade: ""`, `credits: 1`, `courseType: "Regular"`, `included: true` (lines 76-90). School name = classroom name (Blueprint) ?? org name ?? "My School" (lines 101-102). Administrator/email taken from the **session user**, not a DB profile (lines 107-108). Returns `template: "year-based"`, `gradingScale: DEFAULT_GRADING_SCALE` (10-point), `signed: false`. Note: it does **not** set `gradingSettings`, so a freshly generated transcript has `gradingSettings === undefined` until the user touches the Info tab.
- **`saveTranscript(studentId, data, transcriptId?)`** (lines 129-158): auth + org required. Calls `assertStudentInOrg`; if `transcriptId` given, also verifies the existing transcript belongs to the org (lines 137-140). Persists via `db.transcript.upsert` (lines 142-154): the whole `data` object is stored into the `Json` column (`data: data as any`). `revalidatePath("/transcripts")`. **See Risks** for the `where: { id: transcriptId || "new" }` pattern.
- **`getTranscripts(studentId)`** (lines 163-178): auth + `assertStudentInOrg`, then `findMany` org-scoped (`{ studentId, organizationId: organizationId! }`, line 170) ordered by `updatedAt desc`. Casts `t.data` to `TranscriptData`.
- **`deleteTranscript(transcriptId)`** (lines 183-197): auth, org-ownership check, delete, revalidate. **DEAD CODE** — no caller anywhere (verified by grep across `src/`); there is no delete button in the UI.

### `src/components/transcript/types.ts` — Type definitions (no runtime code)
- Defines the entire application-layer shape stored in `Transcript.data`. Key types:
  - `TranscriptData` (lines 130-151): top-level blob. `id?` is the DB row id, injected by the route. Holds `studentInfo`, `schoolInfo`, `courses[]`, `pre9thCourses[]`, `tests[]`, `activities[]`, `notes[]`, `gradingScale[]` (the displayed legend), `signed`, optional `signature`, optional `gradingSettings`.
  - `GPASettings` (lines 155-159): `{ scale: GradingScaleType; weighted: boolean; showNarratives?: boolean }`. This is what drives GPA math — **distinct** from `gradingScale` (the legend rows).
  - `GradingScaleType` (line 153): `'10-point' | '7-point' | 'plus-minus'`.
  - `TranscriptCourse` (lines 14-31): `gradeLevel` is `9|10|11|12` or `0` (pre-9th). `credits` is a free `number` despite a narrower `CreditValue` union (line 12) existing — the union is unused on the course.
  - `signature` (lines 143-147): `{ type: 'draw' | 'type'; data: string; date: string }`. For `'draw'`, `data` is a data-URL image; for `'type'`, a name string.
- **Notes:** `studentInfo.socialSecurityNumber` (line 113) is a defined field rendered in both preview and PDF — see Security. `pre9thCourses`, `tests`, and `notes` exist in the type and are rendered by preview/PDF, but **no builder UI populates them** (only courses 9-12 and activities are editable).

### `src/components/transcript/utils.ts` — GPA / formatting logic (pure functions)
The numeric heart of the subsystem. No I/O, no auth.
- **`getGpaPoints(grade, courseType='Regular', scaleType='10-point')`** (lines 34-117): maps a grade (numeric percentage or letter) to 0-4 points under the chosen scale. Special grades: `IP`/`IN PROGRESS` → `null` (excluded), `PASS`/`P` → `null` (excluded), `FAIL`/`F` → `0.0`, `M`/`MASTERY` → `4.0` (lines 44-47). Numeric branches differ by scale: `7-point` (A≥93…), `plus-minus` (A≥93, A-≥90, …), default `10-point` (A≥90…) (lines 53-79). Letter-grade fallback at lines 82-114. **Note:** `courseType` is a parameter but unused inside — weighting is applied separately.
- **`applyCourseTypeWeighting(points, courseType, weighted=true)`** (lines 122-135): if `weighted` false, returns base points. Else Honors `+0.5`, AP/IB/Dual `+1.0`, both capped at `5.0` (`Math.min(..., 5.0)`). This is the "5.0 add-on."
- **`calculateUnweightedGPA(courses, scaleType)`** (lines 140-160): credit-weighted average of base points (always `courseType='Regular'`, i.e. no honors boost). Courses whose grade yields `null` (IP/Pass/blank) are excluded entirely (both numerator and denominator).
- **`calculateWeightedGPA(courses, settings)`** (lines 165-188): same, but applies `applyCourseTypeWeighting` per course using `settings.weighted`. If `settings.weighted === false`, weighted GPA collapses to the same value as unweighted.
- **`calculateTotalCredits`** (lines 193-195): plain sum of `course.credits` for the given set — note it counts **all** passed-in courses including blank/IP ones (unlike GPA which skips them).
- **`calculateYearSummary(gradeLevel, courses, settings, …)`** (lines 200-223): filters `c.gradeLevel === gradeLevel && c.included !== false`, returns per-year `creditTotal`, `weightedGPA`, `unweightedGPA`. Default `yearRange` derived from current year and grade (lines 208-212).
- **`calculateAcademicSummary(courses, settings)`** (lines 228-263): overall totals + `creditsBySubject` breakdown. Filters `included !== false`.
- **`getGradingScaleLegend(type)`** (lines 268-299): returns the display legend rows (`{range, points}[]`) per scale type.
- **`DEFAULT_GRADING_SCALE`** (line 301): `getGradingScaleLegend('10-point')`.
- **`formatGPA`/`formatCredits`** (lines 306-315): `toFixed(2)`.
- **`getDefaultCoursesForGrade`** (lines 320-333) and **`validateCourse`** (lines 338-361): helpers — **both appear unused** by any component in this subsystem (no import found); likely dead/aspirational.
- **`formatDateLocal(dateStr, options)`** (lines 12-29): parses `YYYY-MM-DD` as a **local** date (splits on `-`, constructs `new Date(y, m-1, d)`) to dodge the off-by-one timezone bug. Used by preview and PDF.
- **Default-argument trap:** Many functions default `settings`/`scaleType` to `'10-point'`/`{scale:'10-point',weighted:true}`. When the caller passes `transcript.gradingSettings` and it is `undefined` (fresh transcript, see `generateTranscriptData`), the default kicks in — so GPA defaults to 10-point/weighted regardless of intent until the user sets a scale.

### `src/components/transcript/TranscriptBuilder.tsx` — Builder shell (`"use client"`, line 1)
- **Role:** The full editing UI. Holds the entire `TranscriptData` in one `useState` (line 40), renders four tabs (Info / Courses / Activities / Preview), and exposes Save + Export PDF in a sticky header.
- **State flow:** `updateTranscript(updates)` shallow-merges into state (lines 67-69). Child sections call `onChange` to replace `courses`/`activities`.
- **Save:** `handleSave` (lines 45-60) calls `saveTranscript(studentId, transcript, transcript.id)`; toasts via `sonner`; `router.refresh()` on success. Note: after creating a brand-new transcript, the returned row id is **not** written back into local `transcript.id` — see Risks (second save can double-insert).
- **Export:** `handleExport` → `exportToPDF(transcript)` (lines 62-64). Pure client; no server round-trip.
- **Grading settings UI (Info tab):**
  - Scale `<Select>` (lines 279-298) writes `gradingSettings.scale` **and** recomputes `gradingScale` legend via `getGradingScaleLegend` (lines 282-288). So changing the scale updates both the math input and the printed legend.
  - Weighted checkbox (lines 314-326) → `gradingSettings.weighted`.
  - Narrative checkbox (lines 335-348) → `gradingSettings.showNarratives` (toggles the per-course notes input in `CourseEntrySection`).
- **Courses tab** (lines 362-378): renders a `CourseEntrySection` for grades 9,10,11,12 only (no pre-9th UI). Passes `settings={transcript.gradingSettings}`.
- **Activities tab** (lines 381-388): `ActivitiesSection`.
- **Preview tab** (lines 391-397): renders `TranscriptPreview` inside a fixed `8.5in` container.
- **Notes / drift:**
  - `handleSave`'s `catch` swallows the error and only toasts a generic message (lines 53-56) — an "Unauthorized" save failure is invisible beyond a toast.
  - The `useEffect` at lines 73-75 is empty (dead).
  - There is **no Info-tab field for** SSN, address, phone, gender, tests, notes, or pre-9th — only first/last name, DOB, graduation date, school name/email/address/administrator, scale, weighting, narratives, and title. So many `TranscriptData` fields can only ever be set by editing the raw JSON or by `generateTranscriptData`.

### `src/components/transcript/CourseEntrySection.tsx` — Per-year course editor (`"use client"`)
- **Role:** One card per grade level. Lists `courses.filter(c => c.gradeLevel === gradeLevel)` (line 22) and lets the user add/edit/delete rows.
- **Editing:** `handleAddCourse` (lines 24-37) pushes a new `Regular`/`General`/1-credit course with `id: new-${Date.now()}`. `handleUpdateCourse`/`handleDeleteCourse` map/filter by id (lines 39-47). All changes bubble up via `onChange(updatedFullCoursesArray)` — it always passes the **entire** `courses` array, not just this year's.
- **Fields per row:** course title, subject (`<Select>` with a fixed list, lines 119-130), course type (Regular/Honors/AP-Dual), grade (free text `<Input>`), credits (`type=number step=0.25`).
- **Narratives:** when `settings?.showNarratives` is true, an extra `courseNotes` input renders (lines 186-200).
- **Notes:** Phosphor `DotsSixVertical` is imported (line 4) suggesting drag-reorder, but **no reordering is implemented** (the `order` field on `TranscriptCourse` is never used). `Badge` (line 10) is imported but unused.

### `src/components/transcript/ActivitiesSection.tsx` — Activities editor (`"use client"`)
- **Role:** Add/edit/delete `Activity` entries (title, position, category, grade levels, hours, description). `CATEGORIES` constant lists 11 categories (lines 17-29).
- **Editing:** `handleAdd`/`handleUpdate`/`handleDelete` mirror the course section (lines 35-52); new activity defaults `category: "extracurricular-clubs"`, `years: "9-12"`.
- **Notes:** `Badge` imported (line 32) but unused. `awards` is a field on `Activity` and is rendered by preview/PDF, but there is **no input for `awards`** here — another field only settable outside the UI.

### `src/components/transcript/TranscriptPreview.tsx` — On-screen preview (`"use client"`)
- **Role:** Renders the WYSIWYG transcript that mirrors the PDF. This is the source of truth the PDF tries to match.
- **GPA:** computes `calculateAcademicSummary(courses.filter(included), transcript.gradingSettings)` (lines 25-28) and per-year `calculateYearSummary(..., transcript.gradingSettings)` (lines 30-35) — i.e. honors the user's settings. **Year cards display the WEIGHTED GPA** (`summary.weightedGPA`, line 239), as does the PDF.
- **Signature:** rendered only when `transcript.signed && transcript.signature` (line 189). For `'draw'`, `<img src={signature.data}>` **with no data-URL validation** (line 195) — unlike the PDF path. For `'type'`, renders the typed name in a cursive font.
- **Grading legend:** uses `transcript.gradingScale` if non-empty else `getGradingScaleLegend(gradingSettings?.scale)` (lines 125-127), plus a weighted-boost footnote when `weighted !== false`.
- **Notes:** `YearCard` references `summary.showNarratives` (line 262) but `YearSummary` never carries `showNarratives` (it's on `GPASettings`), so per-course narrative notes **never render in the preview** even when the toggle is on (they would still flow through `course.courseNotes`, but the gate is always falsy). The PDF does not render `courseNotes` at all.

### `src/components/transcript/pdfExport.ts` — PDF/print generator (~879 lines; client-only)
- **Role:** `exportToPDF(transcript)` (lines 29-47) opens `window.open('', '_blank')`, `document.write`s a full standalone HTML document, and triggers `print()` after a 250ms `onload` delay. If the popup is blocked, alerts the user (lines 32-35).
- **`generatePrintHTML(transcript)`** (lines 52-868): builds the entire document as a template string. Inlined `<style>` (lines 79-609) replicates the preview look; pulls the **Dancing Script** Google Font for handwritten signatures (line 78).
- **GPA into PDF:** `calculateAcademicSummary(courses.filter(included), transcript.gradingSettings)` (lines 59-62) and per-year `calculateYearSummary(..., transcript.gradingSettings)` (lines 65-70) — identical inputs to the preview, so **PDF GPA matches on-screen GPA**. Year cards print `summary.weightedGPA` (line 745). Overall block prints weighted, unweighted, and total credits (lines 693-701).
- **Grading legend into PDF:** uses `transcript.gradingScale` if present else `DEFAULT_GRADING_SCALE` (line 797). Note: the legend is whatever `gradingScale` was last persisted; the Info-tab Select keeps it in sync with the scale, but `gradingScale` is **not** recomputed here from `gradingSettings.scale` — if the JSON's `gradingScale` is stale relative to `gradingSettings`, the printed legend and the GPA math can disagree.
- **Security — XSS escaping:** `esc(value)` (lines 16-23) escapes `& < > " '`. **Every** interpolated user field is wrapped in `esc()` — student/school names, email, gender, SSN, course names, grades, activity title/position/years/description/hours/awards, notes, test type/keys/values. Date fields go through `formatDate` which wraps `formatDateLocal` in `esc` (line 55). This is necessary because the document is built by string concat + `document.write` (an injection sink). Confirmed escaped sites: lines 630, 636, 642, 648, 662-681, 762-764, 782, 816-824, 838, 853, 875-876.
- **Security — signature data-URL validation:** for a drawn signature, the `src` is only emitted if `transcript.signature.data` matches `/^data:image\//` (line 852); otherwise an empty `src` is written. This blocks `javascript:`/`data:text/html` style payloads in the image source. The typed-signature path escapes the name via `esc` (line 853). (The preview component does NOT do this validation — see Risks.)
- **Empty-year card:** when a grade level has no courses, prints a placeholder card showing `GPA 0.0 / Cr 0.0` (lines 712-734).
- **`generateTestScoresHTML(test)`** (lines 870-879): renders each `test.scores` entry (key/value both `esc`-aped).
- **Notes:** All output is weighted-GPA-forward on the year cards; the only place unweighted appears is the top summary strip. Course `subject`, `courseType`, and `courseNotes` are **not** printed (only name/grade/credits per course).

## Data models & tenancy

**Prisma model** (`prisma/schema.prisma:124-138`):
```
model Transcript {
  id             String   @id @default(uuid())
  studentId      String   @map("student_id")
  organizationId String   @map("organization_id")   // tenancy key
  name           String
  data           Json      // full TranscriptData blob
  isOfficial     Boolean  @default(false) @map("is_official")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  student        Student      @relation(..., onDelete: Cascade)
  organization   Organization @relation(..., onDelete: Cascade)
  @@map("transcripts")
}
```
- Relations: `Student.transcripts Transcript[]` (`schema.prisma:119`) and `Organization.transcripts Transcript[]` (`schema.prisma:311`). `onDelete: Cascade` on both — deleting a student or org removes their transcripts.
- **`isOfficial` is dead:** declared in the schema, defaulted `false`, but **never read or written** anywhere in `src/` (grep-verified). The "OFFICIAL HIGH SCHOOL TRANSCRIPT" header is hard-coded in preview/PDF regardless.
- **Tenancy:** the `organization_id` column is the multi-tenant boundary. Every server action filters/asserts on it (`assertStudentInOrg`, org-scoped `findMany`/`upsert`/`delete`). All structured transcript content lives in `data Json` and is typed only as `TranscriptData` at the app layer — there is no DB-level validation of its shape.

## Entry points & end-to-end flows

**Entry points into the subsystem:**
- Route `/transcripts` (index) → cards per student. Reached from `StudentCard.tsx:112` ("Transcript" button) and the index's own card buttons. **No global nav link exists** (grep of `MainNav`/`ContextNav`/`InklingToolkit` found none) — the only mention in nav is a data-privacy bullet in `ProfileSettingsDialog.tsx:302`.
- Route `/transcripts/[studentId]` (builder).
- Server actions in `transcript.ts` (callable only from within the app).

**Flow A — Open / create a transcript:**
1. User clicks "Transcript" on a `StudentCard` → `/transcripts/[studentId]`.
2. Route (`[studentId]/page.tsx`) `auth()`-guards, then `getTranscripts(studentId)` (org-scoped).
3. If a saved row exists → use its `data`, inject `data.id = row.id`. Else `generateTranscriptData(studentId)` pulls Student/Org/Course enrollments → fresh `TranscriptData` (no `gradingSettings`, 10-point default legend).
4. `TranscriptBuilder` renders with that `initialData` in client state.

**Flow B — Edit & save:**
1. User edits Info/Courses/Activities; each edit shallow-merges into the single `transcript` state object.
2. GPA recomputes live in `TranscriptPreview` via `utils.ts` using `gradingSettings`.
3. "Save Changes" → `saveTranscript(studentId, transcript, transcript.id)` → org checks → `db.transcript.upsert` writes the whole blob into `Transcript.data` → `revalidatePath("/transcripts")` → `router.refresh()`.

**Flow C — Export PDF:**
1. "Export PDF" → `exportToPDF(transcript)` (no server call).
2. Opens a blank popup, `generatePrintHTML` builds escaped HTML (GPA computed from the same `gradingSettings`), `document.write` + `print()`.
3. User saves as PDF via the browser print dialog. Drawn signatures are validated against `data:image/`; all user text is `esc`-aped.

## External dependencies & services

- **`@/server/db`** — Prisma 7 client over Postgres via `@prisma/adapter-pg` (`PrismaPg`, pooled, `ssl.rejectUnauthorized:false`).
- **`@/auth`** — Auth.js (NextAuth) Google provider, JWT sessions, Prisma adapter. `auth()` resolves the session.
- **`@/lib/auth-helpers` `getCurrentUserOrg`** — resolves `organizationId` from `User.organizationId` (mapped to `account_id` column).
- **`next/cache` `revalidatePath`**, **`next/navigation`** (`redirect`, `useRouter`).
- **`sonner`** — toast notifications in the builder.
- **`@phosphor-icons/react`** (+ `/dist/ssr` on the server index page), **`lucide-react`** — icons.
- **`date-fns`** (`format`) on the index page; custom `formatDateLocal` elsewhere.
- **UI primitives** from `@/components/ui/*` (button, card, tabs, select, input, label, textarea, badge).
- **Browser print** — the PDF "engine." No server-side PDF library (no Puppeteer/pdfkit). Relies on `window.open` + `document.write` + `window.print`.
- **Google Fonts (Dancing Script)** — fetched at print time for handwritten signatures; requires network at print.

## Auth / security posture

- **Authentication:** every route and every server action checks `auth()`; routes redirect to `/login`, actions throw `"Not authenticated"`.
- **Tenancy / authorization:** strong and consistent. `assertStudentInOrg` and org-scoped queries ensure a caller can only read/write transcripts for students in their own org. `saveTranscript` additionally verifies an updated transcript's org ownership (prevents writing another org's row by passing its id). `deleteTranscript` (unused) is also org-guarded.
- **XSS:** the PDF path is the only raw-HTML sink and it consistently escapes user input via `esc()` and validates the drawn-signature data URL (`/^data:image\//`, `pdfExport.ts:852`). This is the documented, load-bearing mitigation.
- **PII:** `studentInfo.socialSecurityNumber` is a first-class field, rendered in both the preview (`TranscriptPreview.tsx:53-55`) and the PDF (`pdfExport.ts:645-650`). It is stored in cleartext inside `Transcript.data` (JSON column) with no encryption or redaction. There is no builder input for SSN, so it can only arrive via direct data manipulation — but if present it is printed verbatim.

## Risks, drift, dead-code & half-built

1. **`upsert where: { id: transcriptId || "new" }` is fragile** (`transcript.ts:143`). On create, `transcriptId` is `undefined` so the upsert keys on the literal string `"new"`. The first create works (no row with id `"new"` → INSERT with a generated uuid). But `TranscriptBuilder` never writes the returned id back into local state, so a **second** save in the same session still sends `transcript.id === undefined` → upserts on `"new"` again. After the first save created a real uuid row (not id `"new"`), the second save would INSERT a *new* row OR, if a prior session left a row literally id=`"new"`, UPDATE that wrong row. Net effect: **duplicate transcripts / lost edits across saves without a page refresh.** A refresh reloads `getTranscripts` and re-injects the real id, masking the bug. Fix: return id from `saveTranscript`, set it into state, and/or use a proper `create`/`update` split or a unique `(studentId, organizationId)` constraint.
2. **Signature capture is not implemented.** `signed`/`signature` are rendered by preview and PDF, but **no UI sets them** (grep finds no setter; `generateTranscriptData` hard-codes `signed: false`). The "draw"/"type" signature feature is half-built — the rendering half exists, the capture half does not. So in practice the signature block never appears.
3. **Preview signature `<img>` lacks the data-URL validation the PDF has** (`TranscriptPreview.tsx:195` vs `pdfExport.ts:852`). Currently unreachable (no signatures set), but if signatures are ever populated from untrusted JSON, the preview would render an unchecked `src` (React escapes attributes, so this is low-risk, but it is asymmetric with the PDF's explicit guard).
4. **`deleteTranscript` is dead code** — exported, fully written, org-guarded, never called; there is no delete affordance in the UI.
5. **`isOfficial` column is dead** — never read/written; "Official" is hard-coded in the header text.
6. **`gradingSettings` undefined on fresh transcripts.** `generateTranscriptData` never sets `gradingSettings`, so GPA silently defaults to 10-point/weighted (via `utils.ts` default args) until the user opens the Info tab. Saved transcripts created before the user ever touched the scale carry `gradingSettings: undefined` in the DB.
7. **Legend vs. math can drift.** GPA uses `gradingSettings.scale`; the printed legend uses the persisted `gradingScale` array. The Info Select keeps them in sync, but nothing enforces it — a transcript whose `gradingScale` was set under one scale and whose `gradingSettings.scale` is another will print a legend that doesn't match the computed GPA.
8. **Year cards show weighted GPA only** (`pdfExport.ts:745`, `TranscriptPreview.tsx:239`). If `weighted` is off, weighted == unweighted so it's fine; but there's no per-year unweighted display, which may surprise users expecting an unweighted year GPA.
9. **`pre9thCourses`, `tests`, `notes`, `awards`, `address`, `phone`, `gender`, `middleName`, `email` (student), SSN** are renderable but have **no builder inputs** — large swaths of the data model are display-only / unreachable from the UI. `getDefaultCoursesForGrade` and `validateCourse` in `utils.ts` are unused.
10. **`(db as any)` cast on the index page** (`transcripts/page.tsx:31`) bypasses Prisma typing for no apparent reason (the `student` delegate is typed).
11. **Empty/no-op code:** `TranscriptBuilder` `useEffect` (lines 73-75); unused `Badge` imports in `CourseEntrySection` and `ActivitiesSection`; unused `DotsSixVertical` (drag handle, no DnD); `order` field never used; `YearCard.showNarratives` gate is always falsy so course narratives never appear in preview.
12. **No server-side rendering of the PDF.** Export depends on the browser popup + Google Fonts network fetch; pop-up blockers or offline use break it, and there is no audit trail or server copy of the produced PDF.

## Cross-links to other subsystems

- **Students** (`src/components/students/StudentCard.tsx:112`): primary entry button into `/transcripts/[studentId]`. The `Student` model (firstName/lastName/sex/birthdate/currentGrade) feeds `generateTranscriptData`.
- **Auth / Org** (`src/lib/auth-helpers.ts`, `src/auth.ts`, `User.organizationId` → `account_id`): tenancy source.
- **Courses / Enrollments** (`Student.courseEnrollments` → `Course`): seed the initial course list in `generateTranscriptData` (subject defaults to "General", grade blank).
- **Blueprint / Classrooms** (`Student.classroomEnrollments` → `Classroom`): the latest classroom's `name` is preferred as the transcript school name (`transcript.ts:101-102`).
- **Organization / Onboarding:** index page redirects to `/onboarding` if no org.
- **Account / Data export** (`src/app/actions/account-actions.ts:71`, `src/app/actions/data-export.ts:114-118`): bulk delete and GDPR-style export include all org transcripts (`db.transcript.deleteMany`/`findMany` by `organizationId`). These are the only other code paths that touch the `transcript` model.
- **Note:** `generate-tool.tsx:265` references a `transcript` AI task type — unrelated (audio/video transcription), not this subsystem.

## Open questions

1. Is the `upsert where:{id:"new"}` duplicate-save bug (Risk 1) known/intended, or has it been masked by `router.refresh()` in practice? Should `saveTranscript` return and the client store the new id?
2. Was signature capture intentionally dropped, or is the capture UI pending? The render path is fully built and waiting.
3. Should SSN be stored in cleartext inside `Transcript.data`? Is there a compliance requirement to encrypt/redact it given it prints to the PDF?
4. Is `isOfficial` meant to gate anything (e.g., lock editing, mark a registrar-signed copy)? Currently inert.
5. Are `tests`, `notes`, `pre9thCourses`, and the missing student fields (address/phone/SSN/gender) planned for future builder UI, or should they be removed from the type to reduce confusion?
6. Should the printed grading legend be derived from `gradingSettings.scale` at export time (Risk 7) rather than the persisted `gradingScale` array, to guarantee legend/GPA consistency?
