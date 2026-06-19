# 22 — Transcripts & Records
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope
| File | Role |
|------|------|
| `src/app/transcripts/page.tsx` | Server page: lists all org learners as cards w/ saved-transcript count + "Create/Edit" CTA. |
| `src/app/transcripts/[studentId]/page.tsx` | Server page: loads saved transcript or generates fresh data, renders `TranscriptBuilder`. |
| `src/server/actions/transcript.ts` | Server actions: `generateTranscriptData`, `saveTranscript`, `getTranscripts`, `deleteTranscript` + tenant guards. |
| `src/components/transcript/TranscriptBuilder.tsx` | Client editor shell: tabs (Info/Courses/Activities/Preview), Save + Export PDF. |
| `src/components/transcript/TranscriptPreview.tsx` | Client render of the paper-style transcript (header, 2×2 year grid, tests, scale, activities, notes, signature). |
| `src/components/transcript/CourseEntrySection.tsx` | Client per-grade course editor (add/update/delete rows, optional narrative notes). |
| `src/components/transcript/ActivitiesSection.tsx` | Client activities/awards editor (add/update/delete cards). |
| `src/components/transcript/pdfExport.ts` | `exportToPDF`: builds raw HTML string, opens print window, `document.write` + `print()`. |
| `src/components/transcript/types.ts` | `TranscriptData` and all sub-shapes (courses, tests, activities, GPA settings). |
| `src/components/transcript/utils.ts` | GPA math, grading-scale legends, credit totals, date formatting, validation. |
| `src/components/print/PrintLayout.tsx` | Generic print primitives (`PrintLayout`/`Section`/`Box`/`Grid`/`Title`) — NOT used by transcripts. |
| `src/app/actions/data-export.ts` | `exportUserData`: GDPR-style JSON dump of one user's data incl. org transcripts. |

## 2. Purpose / intent
Lets a parent/admin produce an "Official High School Transcript" for each learner: pick courses by grade level, set grades/credits/course-type, choose a GPA scale (10-point / 7-point / plus-minus, weighted or not), add activities, preview a paper rendering, save it (JSON blob on `Transcript`), and export a PDF via the browser print dialog. `data-export.ts` is a separate, account-wide data-portability surface that happens to include transcripts in its dump.

## 3. Architecture & key files
- **Data shape**: `TranscriptData` (`types.ts:130`) is the single document persisted as JSON in `Transcript.data` (see 02-). It carries `studentInfo`, `schoolInfo`, `courses[]`, `pre9thCourses[]`, `tests[]`, `activities[]`, `notes[]`, `gradingScale[]`, `gradingSettings`, `signed`/`signature`.
- **Generation**: `generateTranscriptData` (`transcript.ts:44`) builds a fresh `TranscriptData` from `Learner` + `Organization` + `courseEnrollments`. Courses default to subject `"General"`, grade `""`, 1 credit, Regular.
- **Editor**: `TranscriptBuilder` (`TranscriptBuilder.tsx:39`) holds the whole document in one `useState`, mutates via `updateTranscript` (shallow merge), delegates course rows to `CourseEntrySection` and activities to `ActivitiesSection`, renders `TranscriptPreview` in the Preview tab.
- **Math**: `utils.ts` — `getGpaPoints` (`utils.ts:34`, scale-aware + special grades IP/Pass/Fail/Mastery), `applyCourseTypeWeighting` (`utils.ts:122`, Honors +0.5 / AP +1.0 capped 5.0), `calculateWeightedGPA`/`calculateUnweightedGPA`, `calculateAcademicSummary`/`calculateYearSummary`.
- **Render & export**: `TranscriptPreview` (on-screen) and `pdfExport.generatePrintHTML` (`pdfExport.ts:52`) duplicate the same layout in two representations (JSX vs HTML string). `pdfExport` HTML-escapes every user value via `esc` (`pdfExport.ts:16`).
- **PrintLayout**: `src/components/print/PrintLayout.tsx` is an unrelated, unused generic print component set (see §5, finding Q-22-001).

## 4. Data flow
1. `/transcripts` (`page.tsx:13-43`): `auth()` → `getCurrentUserOrg` → `withTenant` learner.findMany scoped by `organizationId`, including latest transcript. Renders cards.
2. `/transcripts/[studentId]` (`[studentId]/page.tsx:20-30`): `getTranscripts(studentId)`; if a saved transcript exists, uses `savedTranscripts[0].data` and injects `.id` so saves update the same row; else `generateTranscriptData(studentId)`.
3. Edit: `TranscriptBuilder` mutates local state. Save → `handleSave` (`TranscriptBuilder.tsx:45`) → `saveTranscript(studentId, transcript, transcript.id)` (`transcript.ts:138`) → tenant checks (`assertStudentInOrg` + transcript-org check) → `transcript.upsert` where `id: transcriptId || "new"` → `revalidatePath("/transcripts")`.
4. Export: `handleExport` (`TranscriptBuilder.tsx:62`) → `exportToPDF(transcript)` → `window.open` + `document.write(generatePrintHTML(...))` → `print()` (`pdfExport.ts:29-47`).
5. `assertStudentInOrg` (`transcript.ts:30`) and the transcript-org check (`transcript.ts:146-153`, `211-216`) enforce tenancy. `deleteTranscript` additionally calls `assertParentProfile()` (`transcript.ts:207`).
6. `exportUserData` (`data-export.ts:6`): `auth()`, then user-scoped `findMany`s (always) and org-scoped `findMany`s only when `orgId` is truthy (`data-export.ts:69-98`), including `db.transcript.findMany({ where: { organizationId: orgId } })` (`data-export.ts:91`). Consumed by `ProfileSettingsDialog.tsx:74`.

## 5. Status table
| Unit | Status | Evidence |
|------|--------|----------|
| `/transcripts` list page | DONE | `page.tsx:31-43` tenant-scoped query, rendered cards, linked CTA. |
| `/transcripts/[studentId]` page | DONE | `[studentId]/page.tsx:20-37` loads/generates + renders builder. |
| `generateTranscriptData` | PARTIAL | `transcript.ts:85-99` hardcodes `subject:"General"`, `grade:""`, `credits:1`; ignores course subject/grade/credit data. |
| `saveTranscript` | DONE | `transcript.ts:138-175` upsert wired to builder Save, tenant-guarded. |
| `getTranscripts` | DONE | `transcript.ts:180-199` used by `[studentId]` page. |
| `deleteTranscript` | DEAD | `transcript.ts:204` — zero callers repo-wide (grep: only its own definition). No delete UI. |
| `TranscriptBuilder` | PARTIAL | `TranscriptBuilder.tsx` edits only info/courses/activities; never writes `tests`, `notes`, `pre9thCourses`, `signature`/`signed`, `template` (grep: no matches in file). |
| `TranscriptPreview` | DONE | `TranscriptPreview.tsx:21` rendered in Preview tab (`TranscriptBuilder.tsx:394`). |
| `CourseEntrySection` | DONE | `CourseEntrySection.tsx:21`, rendered per grade `TranscriptBuilder.tsx:367`. |
| `ActivitiesSection` | DONE | `ActivitiesSection.tsx:34`, rendered `TranscriptBuilder.tsx:383`. |
| `exportToPDF` / `generatePrintHTML` | DONE | `pdfExport.ts:29` wired via `handleExport`. |
| `types.ts` | DONE | imported across transcript files. |
| `utils.ts` GPA/scale fns | DONE | imported by preview, pdfExport, actions. |
| `getDefaultCoursesForGrade` | DEAD | `utils.ts:320` — grep shows no importer. |
| `validateCourse` | DEAD | `utils.ts:338` — grep shows no importer. |
| `PrintLayout` & siblings | DEAD | `PrintLayout.tsx` — grep for `PrintLayout|PrintSection|PrintBox|PrintGrid|PrintTitle` matches only this file (Q-22-001). |
| `exportUserData` | DONE | `data-export.ts:6`, called by `ProfileSettingsDialog.tsx:74`. |

## 6. Integration points
- **Imports in**: `@/auth`, `@/lib/auth-helpers` (`getCurrentUserOrg`), `@/server/db` (`withTenant`, `db`), `@/server/profiles/guards` (`assertParentProfile`), `@/generated/client` (`Prisma`, `Learner`, `Transcript`), `next/cache` (`revalidatePath`), `sonner`, UI primitives, `lucide-react` + `@phosphor-icons/react`.
- **Importers out**: `[studentId]/page.tsx` → `TranscriptBuilder` + actions; `TranscriptBuilder` → preview/sections/pdfExport/actions; `ProfileSettingsDialog.tsx` → `exportUserData`.
- **Prisma models used**: `Learner`, `Organization`, `ClassroomStudent` (relation `classroomEnrollments`)+`Classroom`, `CourseStudent` (relation `courseEnrollments`)+`Course`, `Transcript`; `data-export.ts` additionally reads `User`, `PrayerJournalEntry`, `BibleMemory`, `DevotionalReflection`, `LocalChurchNotes`, `GratitudeJournal`, `Resource`, `Book`, `VideoResource`, `Article`, `DocumentResource`, `Classroom`. NOTE: the join models are named `ClassroomStudent`/`CourseStudent` in `schema.prisma:339,507` — `courseEnrollments`/`classroomEnrollments` are only the relation aliases on `Learner` (`schema.prisma:300,302`), not model names.
- **Env vars / external APIs**: none server-side. Client pdf loads Google Fonts (Dancing Script) over HTTP at print time (`pdfExport.ts:78`); preview references `'Nothing You Could Do'` font (`TranscriptPreview.tsx:197`).
- **Inngest jobs**: none.

## 7. Findings

Q-22-001  [LOW]  `PrintLayout` and its 4 sibling primitives are dead code  — `src/components/print/PrintLayout.tsx:11-70`
  Evidence: Grep for `PrintLayout|PrintSection|PrintBox|PrintGrid|PrintTitle` across the repo matches only this file; no JSX consumer. Transcript PDF uses raw HTML strings in `pdfExport.ts`, not these components.
  Impact: Dead, maintained-but-unused print system; misleads readers into thinking transcripts use it. Confirms task's "possible stub" suspicion — it is fully implemented but DEAD (no importers).
  Status:   documented (not fixed)

Q-22-002  [MED]  `generateTranscriptData` discards real course grade/credit/subject data  — `src/server/actions/transcript.ts:85-99`
  Evidence: Every enrolled course is mapped to `subject:"General"`, `grade:""`, `credits:1`, `courseType:"Regular"`, ignoring any actual grade/credit info on the enrollment or course.
  Impact: Auto-generated transcripts always show empty grades and a flat 1-credit/General classification, requiring full manual re-entry; the "generate from database" affordance provides only course titles.
  Status:   documented (not fixed)

Q-22-003  [MED]  Builder cannot edit several persisted `TranscriptData` fields  — `src/components/transcript/TranscriptBuilder.tsx` (whole file)
  Evidence: Grep for `tests|notes|pre9thCourses|signature|signed|template` in the builder returns no matches; only `studentInfo`, `schoolInfo`, `courses`, `activities`, `gradingSettings`, `name` are mutated. Yet preview/pdf render tests, notes, signature, and pre-9th, and the type/scale toggle UI exists.
  Impact: No UI path to add test scores, notes, signatures, or pre-9th courses, or to switch `template` ('subject-based' is unreachable). Those sections only ever appear if injected via stored JSON; the signature block on the "official" transcript can never be populated through the app.
  Status:   documented (not fixed)

Q-22-004  [LOW]  `deleteTranscript`, `getDefaultCoursesForGrade`, `validateCourse` are unused  — `src/server/actions/transcript.ts:204`, `src/components/transcript/utils.ts:320`, `utils.ts:338`
  Evidence: Grep shows zero callers outside each definition. `deleteTranscript` even guards with `assertParentProfile` but no UI invokes it; course validation (`validateCourse`) is never run, so blank course names/credits<=0 save freely.
  Impact: Dead code; absence of `validateCourse` wiring means the editor accepts invalid course rows (empty title, 0 credits) directly into the saved document.
  Status:   documented (not fixed)

Q-22-005  [LOW]  `data-export.ts` uses the raw (non-tenant) `db` client for org-scoped reads  — `src/app/actions/data-export.ts:3,69-98`
  Evidence: Imports `db` (not `withTenant`) and runs `db.transcript.findMany({ where:{ organizationId: orgId } })` etc. The author added a guard so org queries run only when `orgId` is truthy (comment at `data-export.ts:36-39`), avoiding the Prisma `organizationId: undefined` → match-all leak.
  Impact: Correct today because each `where` pins `organizationId: orgId` from the authed user's own record, but it bypasses the canonical `withTenant` boundary; any future edit that drops a `where` filter would leak cross-tenant data with no RLS backstop (RLS off, see 04-). Single source of org isolation here is the explicit `orgId` predicate.
  Status:   documented (not fixed)

Q-22-006  [LOW]  PDF render duplicates preview layout in a divergent HTML string  — `src/components/transcript/pdfExport.ts:52-868` vs `src/components/transcript/TranscriptPreview.tsx`
  Evidence: Two independent implementations of the same transcript layout (JSX preview vs `generatePrintHTML` string). Drift already visible: empty year cards render GPA/Cr twice in the PDF (`pdfExport.ts:720-731`, both rendered as the literal `0.0` rather than via `formatGPA`/`formatCredits`). The PDF ships `.credits-by-subject`/`.subject-credit-item`/`.summary-divider` CSS (`pdfExport.ts:312-332`) that is never emitted in the HTML body (grep: classes appear only in the `<style>` block) — dead CSS — even though `calculateAcademicSummary` computes `creditsBySubject`; neither preview nor PDF body renders it.
  Impact: Maintenance hazard and "what you see is not what you print" drift between on-screen preview and exported PDF.
  Status:   documented (not fixed)

Q-22-007  [INFO]  ✅ RESOLVED 2026-06-19 — removed socialSecurityNumber from TranscriptData + the preview/PDF render branches (see CHANGELOG.md). SSN can be rendered on the transcript / included in exports  — `src/components/transcript/types.ts:113`, `TranscriptPreview.tsx:53-55`, `pdfExport.ts:645-650`
  Evidence: `StudentInfo.socialSecurityNumber` is rendered in preview and PDF when present; no builder field sets it, but stored JSON containing an SSN would be printed and also dumped by `exportUserData` (transcript JSON included verbatim).
  Impact: Sensitive PII surface; currently unreachable via the editor UI (Q-22-003) but present in the data contract and render paths.
  Status:   documented (not fixed)

Q-22-008  [LOW]  `Transcript.isOfficial` column is never written or read by app code  — `prisma/schema.prisma:131`, `src/server/actions/transcript.ts:155-171`
  Evidence: The `Transcript` model has `isOfficial Boolean @default(false)` (`schema.prisma:131`), but `saveTranscript`'s `create`/`update` payloads only set `studentId`/`organizationId`/`name`/`data` and never touch `isOfficial`; grep for `isOfficial` across `src/` returns no matches. Meanwhile the rendered header is hardcoded "OFFICIAL HIGH SCHOOL TRANSCRIPT" (`TranscriptPreview.tsx:41`, `pdfExport.ts:615`).
  Impact: Schema↔code drift — the "official" distinction exists in the DB but is unreachable; every transcript prints as "OFFICIAL" regardless. No tenancy risk, just dead schema surface.
  Status:   documented (not fixed)
