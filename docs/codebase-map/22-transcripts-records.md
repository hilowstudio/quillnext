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
| ~~`src/components/print/PrintLayout.tsx`~~ | **REMOVED 2026-06-22 (Q-22-001)** — dead generic print primitives, zero importers. |
| `src/app/actions/data-export.ts` | `exportUserData`: GDPR-style JSON dump of one user's data incl. org transcripts. |

## 2. Purpose / intent
Lets a parent/admin produce an "Official High School Transcript" for each learner: pick courses by grade level, set grades/credits/course-type, choose a GPA scale (10-point / 7-point / plus-minus, weighted or not), add activities, preview a paper rendering, save it (JSON blob on `Transcript`), and export a PDF via the browser print dialog. `data-export.ts` is a separate, account-wide data-portability surface that happens to include transcripts in its dump.

## 3. Architecture & key files
- **Data shape**: `TranscriptData` (`types.ts:130`) is the single document persisted as JSON in `Transcript.data` (see 02-). It carries `studentInfo`, `schoolInfo`, `courses[]`, `pre9thCourses[]`, `tests[]`, `activities[]`, `notes[]`, `gradingScale[]`, `gradingSettings`, `signed`/`signature`.
- **Generation**: `generateTranscriptData` (`transcript.ts:44`) builds a fresh `TranscriptData` from `Learner` + `Organization` + `courseEnrollments`. Courses default to subject `"General"`, grade `""`, 1 credit, Regular.
- **Editor**: `TranscriptBuilder` (`TranscriptBuilder.tsx:39`) holds the whole document in one `useState`, mutates via `updateTranscript` (shallow merge), delegates course rows to `CourseEntrySection` and activities to `ActivitiesSection`, renders `TranscriptPreview` in the Preview tab.
- **Math**: `utils.ts` — `getGpaPoints` (`utils.ts:34`, scale-aware + special grades IP/Pass/Fail/Mastery), `applyCourseTypeWeighting` (`utils.ts:122`, Honors +0.5 / AP +1.0 capped 5.0), `calculateWeightedGPA`/`calculateUnweightedGPA`, `calculateAcademicSummary`/`calculateYearSummary`.
- **Render & export**: `TranscriptPreview` (on-screen) and `pdfExport.generatePrintHTML` (`pdfExport.ts:52`) duplicate the same layout in two representations (JSX vs HTML string). `pdfExport` HTML-escapes every user value via `esc` (`pdfExport.ts:16`).
- **PrintLayout** (`src/components/print/PrintLayout.tsx`) was an unrelated, unused generic print component set — **REMOVED 2026-06-22 (Q-22-001)**.

## 4. Data flow
1. `/transcripts` (`page.tsx:13-43`): `auth()` → `getCurrentUserOrg` → `withTenant` learner.findMany scoped by `organizationId` (excludes parent-as-learner rows via `excludeParentLearners` — Q-05-006), including latest transcript. Renders cards.
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
| `generateTranscriptData` | DONE (by-design) | provides titles + parent-classified defaults; grade/credit have NO schema source, and the course's spine `subject` is a different taxonomy than the transcript registrar dropdown (Q-22-002 ✅ accepted 2026-06-22). |
| `saveTranscript` | DONE | `transcript.ts:138-175` upsert wired to builder Save, tenant-guarded. |
| `getTranscripts` | DONE | `transcript.ts:180-199` used by `[studentId]` page. |
| `deleteTranscript` | REMOVED | ✅ removed 2026-06-22 (Q-22-004 — dead, no delete UI; + its orphaned `assertParentProfile` import). |
| `TranscriptBuilder` | PARTIAL | edits info/courses/activities; `tests`/`notes`/`signature` are render-only persisted fields (editor UI = a deferred feature, §5 roadmap — Q-22-003); `pre9thCourses`/`template` are dead data (no renderer). |
| `TranscriptPreview` | DONE | `TranscriptPreview.tsx:21` rendered in Preview tab (`TranscriptBuilder.tsx:394`). |
| `CourseEntrySection` | DONE | `CourseEntrySection.tsx:21`, rendered per grade `TranscriptBuilder.tsx:367`. |
| `ActivitiesSection` | DONE | `ActivitiesSection.tsx:34`, rendered `TranscriptBuilder.tsx:383`. |
| `exportToPDF` / `generatePrintHTML` | DONE | `pdfExport.ts:29` wired via `handleExport`; empty-card GPA/Cr precision + duplication + dead CSS fixed (Q-22-006 ✅ 2026-06-22). |
| `types.ts` | DONE | imported across transcript files. |
| `utils.ts` GPA/scale fns | DONE | imported by preview, pdfExport, actions. |
| `getDefaultCoursesForGrade` | REMOVED | ✅ removed 2026-06-22 (Q-22-004 — dead helper). |
| `validateCourse` | REMOVED | ✅ removed 2026-06-22 (Q-22-004 — dead validator; re-add on a future editor revival). |
| `PrintLayout` & siblings | REMOVED | ✅ `git rm` 2026-06-22 (Q-22-001 — zero importers). |
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
  Status: ✅ REMOVED (2026-06-22, consolidated pass / ch.22-LOW) — `git rm src/components/print/PrintLayout.tsx` (zero importers repo-wide; the transcript PDF uses raw HTML strings in `pdfExport.ts`, not these primitives). Build-safe (tsc 0). (see CHANGELOG.md)

Q-22-002  [MED]  `generateTranscriptData` discards real course grade/credit/subject data  — `src/server/actions/transcript.ts:85-99`
  Evidence: Every enrolled course is mapped to `subject:"General"`, `grade:""`, `credits:1`, `courseType:"Regular"`, ignoring any actual grade/credit info on the enrollment or course.
  Impact: Auto-generated transcripts show empty grades and a flat 1-credit/General classification. *(Corrected 2026-06-22: the schema has NO grade/credit source — `Course` has no credits/grade column and `CourseStudent` (enrollment) has only status/dates — so those defaults are correct (the parent enters grades/credits, the proper transcript workflow). The course's `subject` is the curriculum-SPINE subject (e.g. "Language Arts & Humanities"), a DIFFERENT taxonomy than the transcript's registrar-subject dropdown (English/Mathematics/...) — injecting it would render a blank editor Subject cell (no matching `<Select>` option) AND place a non-registrar value on the "official" transcript.)*
  Status: ✅ ACCEPTED — correct-by-design (2026-06-22, consolidated pass / ch.22-MED). 🔻 over-graded (really LOW): `generateTranscriptData` correctly provides course titles + safe defaults for the parent to classify; the registrar-subject + grade + credit are deliberately parent-entered. Faithfully populating `subject` would need a spine→registrar mapping that doesn't exist + a dropdown overhaul to avoid a blank-cell regression — disproportionate, and the injected spine value is the wrong taxonomy for a transcript. No code change. (see CHANGELOG.md)

Q-22-003  [MED]  Builder cannot edit several persisted `TranscriptData` fields  — `src/components/transcript/TranscriptBuilder.tsx` (whole file)
  Evidence: Grep for `tests|notes|pre9thCourses|signature|signed|template` in the builder returns no matches; only `studentInfo`, `schoolInfo`, `courses`, `activities`, `gradingSettings`, `name` are mutated. Yet preview/pdf render tests, notes, signature, and pre-9th, and the type/scale toggle UI exists.
  Impact: No UI path to add test scores, notes, or signatures (render-only persisted fields), nor pre-9th courses / a `template` switch. *(Refined 2026-06-22: SPLIT the 6 fields — `tests`/`notes`/`signed`+`signature` are persisted-but-render-only (preview + PDF read them) → a deferred editor FEATURE; but `pre9thCourses` + `template`/'subject-based' are DEAD DATA, referenced only in types.ts and consumed by NO renderer — do NOT build editor UI for them.)*
  Status: ✅ ACCEPTED — roadmap (2026-06-22, consolidated pass / ch.22-MED). Building the editor UI for tests/notes/signature is a multi-field FEATURE (defer per §9.3) — the signature gap (an "official" transcript can never be signed via the app) is the headline, roadmapped to ch.24 §5. `pre9thCourses` + `template` are dead data (Q-22-004-class) — flagged, not built. No code change. (see CHANGELOG.md)

Q-22-004  [LOW]  `deleteTranscript`, `getDefaultCoursesForGrade`, `validateCourse` are unused  — `src/server/actions/transcript.ts:204`, `src/components/transcript/utils.ts:320`, `utils.ts:338`
  Evidence: Grep shows zero callers outside each definition. `deleteTranscript` even guards with `assertParentProfile` but no UI invokes it; course validation (`validateCourse`) is never run, so blank course names/credits<=0 save freely.
  Impact: Dead code; absence of `validateCourse` wiring means the editor accepts invalid course rows (empty title, 0 credits) directly into the saved document.
  Status: ✅ REMOVED (2026-06-22, consolidated pass / ch.22-LOW) — deleted all 3 dead symbols: `deleteTranscript` (transcript.ts — + its now-orphaned `assertParentProfile` import; the guard was a mechanical security-sweep artifact, NOT a planned-feature signal per git blame), `getDefaultCoursesForGrade` + `validateCourse` (utils.ts). *(The invalid-row gap is caused by validation being wired NOWHERE, not by `validateCourse` being dead — re-introduce a validator on a future transcript-editor revival; disproportionate to wire now on a 0-row feature.)* Build-safe (tsc 0). (see CHANGELOG.md)

Q-22-005  [LOW]  `data-export.ts` uses the raw (non-tenant) `db` client for org-scoped reads  — `src/app/actions/data-export.ts:3,69-98`
  Evidence: Imports `db` (not `withTenant`) and runs `db.transcript.findMany({ where:{ organizationId: orgId } })` etc. The author added a guard so org queries run only when `orgId` is truthy (comment at `data-export.ts:36-39`), avoiding the Prisma `organizationId: undefined` → match-all leak.
  Impact: Correct today because each `where` pins `organizationId: orgId` from the authed user's own record. *(Corrected 2026-06-22: post-cutover (RLS_ENABLED=true) this file is AUTO-scoped — none of its org models are CONTEXT_FREE, and the per-query extension's `resolveTenant()` self-resolves org from the session even on this `auth()`-only path; so the leak window is bounded to the RLS-off period. Do NOT "fix" by wrapping the parallel `Promise.all` reads in `withTenant` — that serializes 8 independent reads into one tx for zero security gain.)*
  Status: ✅ ACCEPTED — correct-by-design (2026-06-22, consolidated pass / ch.22-LOW). The explicit `organizationId: orgId` predicate is the live boundary (RLS-off); `resolveTenant()` GUC-scopes it (RLS-on) — already RLS-ready. data-export is a deliberate data-sovereignty carve-out. No code change. (see CHANGELOG.md)

Q-22-006  [LOW]  PDF render duplicates preview layout in a divergent HTML string  — `src/components/transcript/pdfExport.ts:52-868` vs `src/components/transcript/TranscriptPreview.tsx`
  Evidence: Two independent implementations of the same transcript layout (JSX preview vs `generatePrintHTML` string). Drift already visible: empty year cards render GPA/Cr twice in the PDF (`pdfExport.ts:720-731`, both rendered as the literal `0.0` rather than via `formatGPA`/`formatCredits`). The PDF ships `.credits-by-subject`/`.subject-credit-item`/`.summary-divider` CSS (`pdfExport.ts:312-332`) that is never emitted in the HTML body (grep: classes appear only in the `<style>` block) — dead CSS — even though `calculateAcademicSummary` computes `creditsBySubject`; neither preview nor PDF body renders it.
  Impact: Maintenance hazard and "what you see is not what you print" drift between on-screen preview and exported PDF. *(Sharpened 2026-06-22: the empty-year card is the DEFAULT render — the grid is always 4 fixed cards [9,10,11,12] and generated transcripts start grade-less (Q-22-002) — so the drift was reachable in normal use, not an edge case.)*
  Status: ✅ RESOLVED — cheap fixes; full merge accepted-by-design (2026-06-22, consolidated pass / ch.22-LOW). Fixed the reachable empty-card bits: the literal `0.0` → `formatGPA(0)`/`formatCredits(0)` (was `0.0` vs the `0.00` everywhere else), removed the empty card's duplicate GPA/Cr body line (now renders once in the header, matching the preview), and deleted the 3 dead CSS blocks (`.summary-divider`/`.credits-by-subject`/`.subject-credit-item`, never emitted). The full preview↔PDF layout MERGE stays **accepted-by-design** (two genuine render targets — JSX vs print-HTML; a big refactor disproportionate for a LOW). CI green. (see CHANGELOG.md)

Q-22-007  [INFO]  ✅ RESOLVED 2026-06-19 — removed socialSecurityNumber from TranscriptData + the preview/PDF render branches (see CHANGELOG.md). SSN can be rendered on the transcript / included in exports  — `src/components/transcript/types.ts:113`, `TranscriptPreview.tsx:53-55`, `pdfExport.ts:645-650`
  Evidence: `StudentInfo.socialSecurityNumber` is rendered in preview and PDF when present; no builder field sets it, but stored JSON containing an SSN would be printed and also dumped by `exportUserData` (transcript JSON included verbatim).
  Impact: Sensitive PII surface; currently unreachable via the editor UI (Q-22-003) but present in the data contract and render paths.
  Status:   documented (not fixed)

Q-22-008  [LOW]  `Transcript.isOfficial` column is never written or read by app code  — `prisma/schema.prisma:131`, `src/server/actions/transcript.ts:155-171`
  Evidence: The `Transcript` model has `isOfficial Boolean @default(false)` (`schema.prisma:131`), but `saveTranscript`'s `create`/`update` payloads only set `studentId`/`organizationId`/`name`/`data` and never touch `isOfficial`; grep for `isOfficial` across `src/` returns no matches. Meanwhile the rendered header is hardcoded "OFFICIAL HIGH SCHOOL TRANSCRIPT" (`TranscriptPreview.tsx:41`, `pdfExport.ts:615`).
  Impact: Schema↔code drift — the "official" distinction exists in the DB but is unreachable; every transcript prints as "OFFICIAL" regardless. No tenancy risk, just dead schema surface.
  Status: ✅ ACCEPTED — correct-by-design (2026-06-22, consolidated pass / ch.22-LOW). An aspirational orphaned schema column (same profile as Q-18-005's `letterGrade`): removing it is a deferred migration (off the table this pass) and wiring an official/draft toggle is a multi-target FEATURE (builder UI + persistence + conditional render in BOTH the preview + the ~800-line PDF HTML — ties into Q-22-006). Accepted as schema-drift + §5 roadmap; no code/schema change. (see CHANGELOG.md)
