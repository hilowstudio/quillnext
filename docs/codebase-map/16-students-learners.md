# 16 — Students / Learners & Dashboards
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|---|---|
| `src/app/students/page.tsx` | Server page: org students list grid (cached query inline). |
| `src/app/students/new/page.tsx` | "Add Student" page; renders `DynamicCreateStudentForm`. |
| `src/app/students/[id]/page.tsx` | Student profile detail page; orchestrates all profile cards via Suspense. |
| `src/app/students/[id]/assessment/page.tsx` | Assessment wizard route; renders `DynamicAssessmentWizard`. |
| `src/app/students/[id]/_components/CurrentObjectives.tsx` | Card: enrolled-course objectives + Generate links. |
| `src/app/students/[id]/_components/EnrolledCourses.tsx` | Card: course enrollments + progress bars. |
| `src/app/students/[id]/_components/InterestsPassions.tsx` | Card: renders `interestsData` JSON. |
| `src/app/students/[id]/_components/LearningStyle.tsx` | Card: renders `learningStyleData` JSON. |
| `src/app/students/[id]/_components/PersonalityProfile.tsx` | Card: renders `personalityData` + assessment CTA. |
| `src/app/students/[id]/_components/RecommendedBooks.tsx` | Card: library books matching student's subjects/strands. |
| `src/app/students/[id]/_components/StudentHeader.tsx` | Header: name/grade, Generate CTA, ContextBadges. |
| `src/app/api/students/route.ts` | POST: create student (self-heals org on first student). |
| `src/app/api/students/[id]/assessment/route.ts` | POST: per-step assessment → AI profile gen → upsert LearnerProfile. |
| `src/app/actions/student.ts` | Server actions: `getStudentAssignments`, `saveStudentAvatarConfig`. |
| `src/app/actions/student-actions.ts` | Server action: `deleteStudent` (parent-gated). |
| `src/app/actions/assessment-actions.ts` | Server action: `createAssessmentAttempt` (grading seam, NOT personality). |
| `src/components/students/AssessmentWizard.tsx` | Client wizard: personality/learning/interests questionnaires. |
| `src/components/students/CreateStudentForm.tsx` | Client form: student create + SupportProfileWizard. |
| `src/components/students/DynamicAssessmentWizard.tsx` | `next/dynamic` (ssr:false) wrapper for AssessmentWizard. |
| `src/components/students/DynamicCreateStudentForm.tsx` | `next/dynamic` (ssr:false) wrapper for CreateStudentForm. |
| `src/components/students/StudentCard.tsx` | Card on /students grid: status, links, delete dialog. |
| `src/components/students/SupportProfileWizard.tsx` | Neurodiverse support sub-form (used inside CreateStudentForm). |
| `src/components/dashboard/DailyScheduleList.tsx` | Client checklist for `/student/dashboard` (optimistic toggle). |
| `src/components/dashboard/MyLearningCard.tsx` | Parent-as-learner self-enroll card (ParentDashboard). |
| `src/components/dashboard/ParentDashboard.tsx` | Parent home dashboard view. |
| `src/components/dashboard/StudentDashboard.tsx` | Student home dashboard view (avatar, courses, assignments). |
| `src/app/student/dashboard/page.tsx` | Single-student daily-schedule view — now linked from the Sidebar ("Daily Schedule"); Q-16-001 ✅ 2026-06-23. |
| `src/server/queries/students.ts` | Cached student profile queries + objective/book selects. |
| `src/server/queries/dashboard.ts` | `getStudentDashboardData`, `getParentDashboardData`. |
| `src/server/queries/learner-filters.ts` | `excludeParentLearners` shared where-fragment — drops parent-as-learner rows (My-Learning self-enrollments) from student rosters/counts (Q-05-006). |
| `src/server/queries/learner-filters.test.ts` | Locks the fragment shape (`NOT`-of-relation preserves null-profile learners). |
| `src/lib/schemas/students.ts` | Zod `studentSchema` + `StudentFormData`. |

NOTE: `_components/AIContextPreview.tsx` and `_components/PersonalizationContextCard.tsx` (renamed 2026-06-19 from `ContextCompleteness.tsx`, Q-09-007) are owned by chapter 09 — skipped here.

## 2. Purpose / intent
This area is the learner (a.k.a. "student") lifecycle and the two home dashboards. Parents create learners (`/students/new`), view a rich per-learner profile (`/students/[id]`), and run a 3-step calibration wizard (personality / learning style / interests) whose answers are sent to AI generators to populate `LearnerProfile.{personalityData,learningStyleData,interestsData}` — the data that drives Inkling personalization across the app. The home route (`/`, chapter 06) branches by active-profile type to render `ParentDashboard` (classroom overview, quick-create, recent activity, My Learning) or `StudentDashboard` (kid-facing courses/assignments/discipleship). A separate, orphaned `/student/dashboard` route shows a daily schedule checklist.

## 3. Architecture & key files
- **List → detail → assessment** is the primary spine:
  - `/students` (`page.tsx`) fetches via an inline `cacheQuery(getOrganizationStudents)` (`page.tsx:13-27`) — which selects through the shared `studentCardSelect` (Q-16-003) — and renders `StudentCard` per learner.
  - `/students/[id]` (`page.tsx`) calls the central `getStudentProfileData(id, organizationId)` (`students.ts:373`) and lays out cards under `<Suspense>`. Most data is already resolved server-side and passed as props, so the Suspense boundaries here gate only the synchronous render, not real async work (the child components are not themselves async).
  - `/students/[id]/assessment` renders `DynamicAssessmentWizard`, a thin `next/dynamic` ssr:false wrapper over `AssessmentWizard`.
- **Create path**: `/students/new` → `DynamicCreateStudentForm` → `CreateStudentForm` (`useZodForm(studentSchema)`) which embeds `SupportProfileWizard`. Submit POSTs JSON to `/api/students` (route.ts).
- **Dynamic wrappers are NOT duplicate implementations.** `DynamicCreateStudentForm`/`DynamicAssessmentWizard` (`*.tsx:6-7`) only lazy-import the real components; the real `CreateStudentForm`/`AssessmentWizard` are imported *only* by those wrappers. There is exactly one implementation of each; no DEAD duplicate exists (see Q-16-006 — the chapter brief's "two variants" are wrapper+impl, not rival impls).
- **Query module** `server/queries/students.ts` holds the `studentSelect`/`objectiveSelect`/`bookSelect` Prisma selects and exported payload types (`StudentWithRelations`, `ObjectiveWithRelations`, `BookWithRelations`) consumed by the `_components`.
- **Dashboards** are presentational client/server components; their data comes from `server/queries/dashboard.ts` (called by `app/page.tsx`, chapter 06) and from `getStudentAssignments` (a client-invoked server action).

## 4. Data flow

**Create student** (`CreateStudentForm.tsx:49` → `api/students/route.ts:11`):
1. Client builds payload (birthdate → ISO date string) and `fetch("POST /api/students")` (`CreateStudentForm.tsx:53-60`).
2. Route auths (`route.ts:12`), resolves `getCurrentUserOrg()` (`:18`). **Self-heal:** if no org, creates an `Organization` (type `PARENT_INSTRUCTOR`) + back-links user (`:25-41`) — these bootstrap writes stay on the raw `db` client by necessity (the org INSERT must run under the null org context the relaxed `organizations` RLS policy permits; `User` is CONTEXT_FREE).
3. `studentSchema.parse({...body, birthdate:new Date()})` (`:46`).
4. All org-scoped learner writes run in **one** `withTenant({organizationId,userId:null})` tx (`:56-92`, Q-16-002 ✅ Session 32 — RLS-ready + atomic): `learner.create` with name/grade/sex/support fields (`:58`), empty `learnerProfile.create` (`:74`), the `STUDENT` `Profile` create (id `profile-learner-<id>`, `ids.ts:7`) (`:81`) + `learner.profileId` back-link (`:89`). The created learner is returned from the closure as `student` (`:91`).
5. `revalidatePath("/students")` (`:100`), returns `{ student }` (`:102`); client routes to `/students/{id}` (`CreateStudentForm.tsx:69`).

**Assessment step** (`AssessmentWizard.tsx:205` → `api/students/[id]/assessment/route.ts:26`):
1. Per step ("personality"|"learning"|"interests"), client POSTs `{step, answers}` (`AssessmentWizard.tsx:216`).
2. Route auths (`route.ts:30`), Zod-validates the body against the per-step `assessmentSchema` discriminated union (`:20-24`; 400 on failure `:39-42` — Q-16-007), loads learner by id (`:48`), then enforces `student.organizationId === org` (`:56-59`).
3. Switches on `step` → calls `generateStudentProfile`/`generateLearningStyleProfile`/`generateInterestProfile` (`server/ai/personality.ts:94/123/148`) with answers + studentName (`:71-87`).
4. `db.learnerProfile.upsert({ where:{studentId}, ... })` stamping the per-step JSON + `completedAt` (`:91-98`).
5. Client advances step + toast; on "interests" → success card linking back to `/students/{id}` (`AssessmentWizard.tsx:232-236`).

**Student profile page** (`[id]/page.tsx:52`): `getStudentProfileData` → `getStudentById` (tenant tx, then `organizationId` re-check `students.ts:239`) → parallel `getStudentMasterContext` / `getStudentObjectives` / `getRelevantBooks` (`students.ts:390-392`) → `serializeMasterContext` (`[id]/page.tsx:60`) → cards.

**Student dashboard** (`app/page.tsx` STUDENT branch → `StudentDashboard.tsx`): server passes `student`; client `useEffect` calls `getStudentAssignments(student.id)` (`StudentDashboard.tsx:30`) which (after `assertStudentInOrg`, `student.ts:17`) loads `resourceAssignment` + `courseStudent` (`student.ts:19-85`). Avatar edits go through `saveStudentAvatarConfig` (`student.ts:90`).

**Unfinished daily-schedule view** (`app/student/dashboard/page.tsx` — built but not yet linked, Q-16-001): auth+org → lists learners (tenant tx, `:28-31`) → `getStudentDailySchedule(currentStudentId, date)` (`scheduling.ts:226`) → `DailyScheduleList`, which toggles via `toggleItemStatus` (`scheduling.ts:273`).

**Delete** (`StudentCard.tsx:38` → `student-actions.ts:10`): `deleteStudentSchema.parse`, auth, `assertParentProfile()`, org-ownership check (`:32-34`), `db.learner.delete` (cascade), `revalidatePath("/students")`.

## 5. Status table

| Unit | Status | Evidence |
|---|---|---|
| `/students` list page | DONE | `page.tsx:63-115`; cached tenant query `:11-61`; consumed by route. |
| `/students/new` page | DONE | `new/page.tsx:27` renders DynamicCreateStudentForm. |
| `/students/[id]` profile page | DONE | `[id]/page.tsx:52` getStudentProfileData; wired cards. |
| `/students/[id]/assessment` page | DONE | `assessment/page.tsx:14`. |
| `CurrentObjectives` | DONE | rendered `[id]/page.tsx:98`; renders objectives `:26-49`. |
| `EnrolledCourses` | DONE | rendered `[id]/page.tsx:94`; progress bars `:46-63`. |
| `InterestsPassions` | DONE | rendered `[id]/page.tsx:83`. |
| `LearningStyle` | DONE | rendered `[id]/page.tsx:80`. |
| `PersonalityProfile` | DONE | rendered `[id]/page.tsx:77`; assessment CTA `:67-78`. |
| `RecommendedBooks` | DONE | rendered `[id]/page.tsx:112`. |
| `StudentHeader` | DONE | rendered `[id]/page.tsx:72`; ContextBadges `:41`. |
| `POST /api/students` | DONE | `route.ts:11`; live from CreateStudentForm `:53`. |
| `POST /api/students/[id]/assessment` | DONE | `route.ts:13`; live from AssessmentWizard `:216`. |
| `getStudentAssignments` | DONE | `student.ts:13`; called StudentDashboard `:30`. |
| `saveStudentAvatarConfig` | DONE | `student.ts:90`; called StudentDashboard `:196`. |
| `deleteStudent` | DONE | `student-actions.ts:10`; called StudentCard `:38`. |
| `createAssessmentAttempt` | PARTIAL | `assessment-actions.ts:15`; seeds blank SUBMITTED attempt — self-documented as a grading seam, not a real assessment-taking flow (`:7-14`). Importers verified outside this chapter. |
| `AssessmentWizard` | DONE | wired via DynamicAssessmentWizard wrapper (`assessment/page.tsx:14`). |
| `CreateStudentForm` | DONE | wired via DynamicCreateStudentForm wrapper (`new/page.tsx:27`). |
| `DynamicAssessmentWizard` | DONE | `DynamicAssessmentWizard.tsx:6`; imported by assessment page. |
| `DynamicCreateStudentForm` | DONE | `DynamicCreateStudentForm.tsx:6`; imported by new page. |
| `StudentCard` | DONE | rendered `students/page.tsx:74`; prop typed `StudentCardData` (Q-16-003). |
| `SupportProfileWizard` | DONE | embedded `CreateStudentForm.tsx:190`. |
| `MyLearningCard` | DONE | rendered `ParentDashboard.tsx:99`. |
| `ParentDashboard` | DONE | rendered `app/page.tsx:45`. |
| `StudentDashboard` | DONE (KID branch STUB) | rendered `app/page.tsx:30,39`; KID branch falls through `StudentDashboard.tsx:39-41`. |
| `DailyScheduleList` | DONE | rendered `student/dashboard/page.tsx:85` (the Sidebar-linked daily route). |
| `/student/dashboard` page | DONE | `student/dashboard/page.tsx`; now linked from the Sidebar ("Daily Schedule", Q-16-001 ✅) + the self-referential student-picker `:58`. |
| `getStudentDashboardData` | DONE | `dashboard.ts:5`; called `app/page.tsx:29,38`. |
| `getParentDashboardData` | DONE | `dashboard.ts:35`; called `app/page.tsx:42`. |
| `getStudentById` | DONE | `students.ts:227`; used by getStudentProfileData `:375`. |
| `getStudentProfileData` | DONE | `students.ts:373`; called `[id]/page.tsx:52`. |
| `getStudentObjectives` | DONE | `students.ts:306`; called `:391`. Uses raw `db` with NO org predicate (Q-16-008). |
| `getRelevantBooks` | DONE | `students.ts:339`; called `:392`. |
| `getStudentMasterContext` | DONE | `students.ts:293`; called `:390`. |
| `listStudentsNeedingAssessment` | DONE | `students.ts:259`; called `select-profile/page.tsx:33`. |
| `studentSchema` | DONE | `schemas/students.ts:7`; used by form + API. |

## 6. Integration points
- **Imports in:** `@/server/db` (`db`, `withTenant`), `@/lib/auth-helpers` (`getCurrentUserOrg`), `@/auth`, `@/lib/utils/prisma-cache` (`cacheQuery`), `@/server/ai/personality` (3 generators), `@/lib/context/{master-context,context-serializer,context-suggestions}`, `@/server/profiles/{ids,guards}` (`studentProfileId`, `assertParentProfile`), `@/server/actions/scheduling` (`getStudentDailySchedule`, `toggleItemStatus`), `@/app/actions/my-learning` (`enrollSelfInCourse`), `@/server/profiles/my-learning` (`MyLearning`), `@/lib/schemas/actions` (`deleteStudentSchema`), `@/hooks/useZodForm`, `@/lib/utils` (`getStudentAvatarUrl`), UI primitives, `@/components/context/ContextBadges`, `@/components/family-discipleship/*`, `@/components/profile/AvatarCustomizer`, `@/components/navigation/InklingToolkit`, `@/components/assignments/AssignResourceDialog`.
- **Importers out:** `app/page.tsx` (chapter 06) imports both dashboards + both dashboard queries; `select-profile/page.tsx` imports `listStudentsNeedingAssessment`; `_components` import the payload types from `server/queries/students.ts`.
- **Prisma models used:** `Learner` (a.k.a. student), `LearnerProfile`, `Organization`, `User`, `Profile`, `CourseStudent` (`courseEnrollments`), `CourseProgress`, `ActivityProgress`, `Resource`/`personalizedResources`, `ResourceAssignment`, `Course`, `Subject`, `Strand`, `Objective`, `Book`, `Classroom`, `Assessment`/`AssessmentItem`/`AssessmentAttempt`. (See 02-data-model.md.)
- **External APIs:** AI generators in `server/ai/personality.ts` (Gemini/OpenAI via Vercel AI SDK) invoked from the assessment route.
- **Inngest jobs:** none in these files.
- **Env vars:** none read directly here.
- **Tenancy:** most reads use `withTenant(..., { organizationId, userId: null })` with an explicit `organizationId` predicate (`page.tsx:15`, `students.ts:228/267/348`, `dashboard.ts:9/41`); the raw-`db` paths (`assessment/route.ts:48`, `student.ts:9`, `student-actions.ts:24`, `assessment-actions.ts:20/32`) defend with explicit post-fetch org-ownership checks instead. The create-student org-scoped writes (`learner`/`learnerProfile`/`profile` create + the back-link) now run in one `withTenant` tx (`route.ts:56-92`, Q-16-002 ✅ resolved Session 32); only the self-heal org-create/user-update stay raw by necessity (bootstrap under the relaxed null-context org INSERT policy / CONTEXT_FREE `User`). Exception still flagged in Findings: `getStudentObjectives` queries the raw `db` with NO org predicate at all (Q-16-008). RLS is OFF (`server/db.ts:9`) so these app-layer predicates are the only boundary. See 04-security-auth-tenancy.md.
- **Student-roster filter (Q-05-006, owned by ch.05; resolved 2026-06-19):** org-wide learner list/count queries (`students.ts:listStudentsNeedingAssessment`, `dashboard.ts:getParentDashboardData`, and 10 more across chapters) spread the shared `excludeParentLearners` fragment (`learner-filters.ts`) to drop parent-as-learner rows (My-Learning self-enrollments). `data-export.ts` (data-sovereignty) and `getMyLearning` (the parent's own view) are deliberately NOT filtered.

## 7. Findings

Q-16-001  [LOW]  `/student/dashboard` is an UNFINISHED (built-but-unlinked) daily-schedule view  — `src/app/student/dashboard/page.tsx`
  Evidence: repo-wide grep for `student/dashboard` returns only the self-referential student-selector link at `page.tsx:58`; no nav, home page, or other component links to it. It is a complete, working single-student daily-checklist page (auth+org gated; reads `getStudentDailySchedule`, toggles via `DailyScheduleList`→`toggleItemStatus`). `DailyScheduleList` is used only here.
  Impact: Currently only reachable by typing the URL. NOT superseded — it is a different surface from the live `StudentDashboard` (courses/assignments via `/`) and the parent-facing WEEKLY `/planner`; there is no live per-student DAILY checklist elsewhere.
  Status: ✅ RESOLVED 2026-06-23 (Phase 3) — wired the inbound link: a "Daily Schedule" nav item (`/student/dashboard`, `CalendarCheck`) added to the Sidebar (`src/components/layout/Sidebar.tsx`; no collision with `/students` — the paths diverge at char 8). The built daily view is now reachable from live nav. (Earlier: re-verified 2026-06-22 (Session 31), re-documented orphaned→unfinished; owner chose to wire it.) Because the route is kept, its cascade-only dependencies (`getStudentDailySchedule`/`toggleItemStatus`, ch.21; INFO Q-21-010) remain live — no ch.21 change. (see CHANGELOG.md round 34)

Q-16-002  [MED]  Create-student API path bypasses tenant transaction for the main writes  — `src/app/api/students/route.ts:23,33,48,65`
  Evidence: org self-heal (`db.organization.create` `:23`, `db.user.update` `:33`), `db.learner.create` (`:48`), and `db.learnerProfile.create` (`:65`) all use the raw `db` client. Only the trailing profile-link step uses `withTenant` (`:75-89`). The learner `create` sets `organization.connect`, so the row is correctly scoped, but the writes do not run under the tenant GUC tx the rest of the codebase relies on.
  Impact: Inconsistent with the RLS-ready pattern; if RLS is ever enabled (`server/db.ts:9`), these raw-`db` writes would not be tenant-stamped. Functionally correct today only because RLS is inert and org is connected explicitly.
  Status: ✅ RESOLVED 2026-06-22 (Session 32). No live vuln (RLS off; org connected explicitly) — pure RLS-readiness, same family as the Session-20 `withTenant` wraps; true grade LOW, carried MED on tenancy-cluster convention → fix-and-close (re-grade moot). The `learner.create` + `learnerProfile.create` were folded into the existing trailing `withTenant({organizationId,userId:null})` block, so all four org-scoped learner writes (learner → learnerProfile → STUDENT profile → profileId back-link) now run in ONE tenant-stamped, atomic tx (`route.ts:56-92`); the created learner is returned from the closure so the response/`student.id` redirect is unchanged. The self-heal `db.organization.create`/`db.user.update` (`:25-41`) deliberately stay on the raw client: the org INSERT must run under null org context (the relaxed `organizations` RLS policy `id = app.current_org() OR app.current_org() IS NULL`; you cannot stamp a GUC for an org that doesn't exist yet) and `User` is CONTEXT_FREE. A 1-skeptic adversarial pass found zero regressions (the fold strictly eliminates the prior orphaned-row window). Advances Workstream B (the per-query org-filter audit gating the Q-001 RLS cutover). (see CHANGELOG.md round 35)

Q-16-003  [MED]  `/students` list cards passed as `student as any`; payload type discarded  — `src/app/students/page.tsx:108`; `src/components/students/StudentCard.tsx:26`
  Evidence: the inline `getOrganizationStudents` select differs from `studentSelect` in `server/queries/students.ts`, and `StudentCard` declares `student: any` (`StudentCard.tsx:26`) with a `// Using any` comment. The list page also duplicates a near-identical select instead of reusing `studentSelect`.
  Impact: No compile-time guarantee the card's accessed fields (`learnerProfile`, `courseEnrollments`, `avatarConfig`) match the query; silent runtime breakage if either side drifts. Duplicated select = drift risk with the canonical query module.
  Status: ✅ RESOLVED 2026-06-22 (Session 32). Type-DX only (no runtime/security impact; single consumer) — true grade LOW, carried MED → fix-and-close. Added a dedicated, leaner `studentCardSelect` (`satisfies Prisma.LearnerSelect`) + `export type StudentCardData = Prisma.LearnerGetPayload<…>` to the canonical `server/queries/students.ts` (NOT a reuse of `studentSelect`, which is a superset that would over-fetch activityProgress/courseProgress/personalizedResources/strand for a grid). `page.tsx` now selects through `studentCardSelect` (`:17`) and renders `StudentCard` without the cast (`:74`); `StudentCard` types its prop `student: StudentCardData` via `import type` (the house pattern — 5 `_components` already do this), dropping `student: any`. `cacheQuery` preserves the generic so the `as any` drops cleanly. −2 lint warnings (653→651). A 1-skeptic adversarial pass verified every field access stays safe under the precise type (`avatarConfig`→`getStudentAvatarUrl(config?: any)`; nullables only optional-chained/coalesced; `firstName[0]` non-null). (see CHANGELOG.md round 35)

Q-16-004  [LOW]  StudentDashboard reads `assignment.notes` AND `assignment.resourceId`, neither of which the action selects  — `src/components/dashboard/StudentDashboard.tsx:157,166`; `src/app/actions/student.ts:19-60`
  Evidence: the card conditionally renders `assignment.notes` (`StudentDashboard.tsx:157-161`) and builds the "Open Resource" link as `/living-library/resource/${assignment.resourceId}` (`StudentDashboard.tsx:166`), but `getStudentAssignments` selects only id/studentId/createdAt/status/dueDate/completedAt/courseId/activityId + nested `resource`/`course`/`activity` (`student.ts:19-56`) — neither `notes` nor a top-level `resourceId` is selected (the resource id lives at `assignment.resource.id`).
  Impact: The notes block is permanently dead UI (always undefined); the "Open Resource" link resolves to `/living-library/resource/undefined` whenever there are assignments. Schema↔code drift / broken link, verified-OFF only because most users have zero direct assignments.
  Status: ✅ RESOLVED 2026-06-22 (Session 31). Split into two claims: (1) the broken "Open Resource" link fixed by reading the already-selected nested `assignment.resource.id` (StudentDashboard.tsx:161); (2) the `notes` block was deleted — `ResourceAssignment.notes` has NO producer (the live `assignResourceToStudent` never writes it, `assignments.ts:43-49`), so the never-rendering block was removed rather than wiring a `select` for an unpopulated column. (see CHANGELOG.md round 34)

Q-16-005  [LOW]  ParentDashboard "Daily Liturgy" is hardcoded placeholder content  — `src/components/dashboard/ParentDashboard.tsx:52-61`
  Evidence: the Daily Liturgy card renders a fixed "Psalm 23: The Shepherd" string with no data source; not driven by any query or prop.
  Impact: Looks live but is static; misleads users/maintainers into thinking discipleship content is wired on the dashboard.
  Status: ✅ RESOLVED 2026-06-22 (Session 31). Wired the card to the seeded `Devotional` table (read-only DB count: 732 rows, Spurgeon "Morning & Evening", `time` am/pm): new `getTodayDevotional()` (`dashboard.ts`, bare-`db` global read like `family-discipleship/devotionals/page.tsx`) → `todayDevotional` prop (`app/page.tsx`) → ParentDashboard renders today's morning reference + a prose excerpt (`ParentDashboard.tsx:52-60`), falling back to the old static text only if no row matches. Honest dynamic content using existing seeded data. (see CHANGELOG.md round 34)

Q-16-007  [LOW]  Assessment generation has no input validation / loose `any` payloads  — `src/app/api/students/[id]/assessment/route.ts:25,46`
  Evidence: `const { step, answers } = body` with no Zod schema; `answers` (`:25`) is passed straight to AI generators, and `updateData` is typed `any` (`:46`). Only `step` is validated by the if/else (`:49-66`).
  Impact: Unvalidated/untyped client input reaches AI calls and the DB JSON columns; malformed `answers` produce garbage profiles rather than a 400. Consistency gap vs the create path which uses `studentSchema`.
  Status: ✅ RESOLVED 2026-06-22 (Session 31). Added a per-step `assessmentSchema` discriminated union (`route.ts:20-24`) parsed via `safeParse` → 400 BEFORE the paid AI call; typed `updateData` with `Prisma.InputJsonValue` and replaced the 3 `profile as any` casts (dropped 4 explicit `any`s). Validation is permissive on VALUES (interests sends a nested object — `z.record(z.string(), z.unknown())` accepts it; overrode the adversary's "discriminated union needed because a single record rejects interests" — false) but precise on SHAPE per step (personality/learning `Record<string,string>` matching the generators' contracts, interests `Record<string,unknown>`), so no unchecked answer casts. Authenticated self-only route → no privilege boundary; value is fail-fast + repo Zod-at-boundary consistency. (see CHANGELOG.md round 34)

Q-16-008  [INFO]  `getStudentObjectives` queries the raw `db` client with no organizationId predicate  — `src/server/queries/students.ts:311-328`
  Evidence: unlike its sibling selects, `getStudentObjectives` calls `db.objective.findMany` (raw client, not `withTenant`) with a `where` that filters only by `subtopic.topic.strand.courses.some.id IN courseIds` (`students.ts:313-324`) — no `organizationId` and no tenant tx. Scoping is indirect: `courseIds` originate from the student's tenant-scoped enrollments (`students.ts:382`). (Line cites refreshed Session 32 after the `studentCardSelect` insert shifted students.ts +47.)
  Impact: Low — objectives live on the shared/global curriculum spine (not org-owned), so there is no cross-tenant leak today; but if RLS is enabled this raw-`db` read runs without tenant GUCs and the query is the lone reader here with neither `withTenant` nor an explicit org predicate. Documented for completeness against the §6 tenancy claim.
  Status: documented (not fixed)
