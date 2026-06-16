# 12 — Students & Personality Assessment

> Code-truth reference. Every claim below was verified against source on 2026-06-15. Where the repo's prose/markdown docs disagree, trust this. File:line citations are to the actual code.

## Purpose & role in the app

This subsystem owns the **Student** entity and the **personality / learning-style / interests assessment** that calibrates the AI ("Inkling" in the UI copy, "Thinkling" in the runtime chat code) to each child. It covers:

- Student CRUD (list, create, detail, delete) scoped to the caller's `Organization`.
- The neurodiverse **Support Profile** wizard embedded in the create form.
- A 3-step **Assessment Wizard** (personality → learning style → interests) that POSTs raw questionnaire answers to an API route, which runs Gemini `generateObject` calls and stores the **derived** profiles on `LearnerProfile`.
- The student-detail page panels that render those profiles.
- **DiceBear (Lorelei)** avatar customization.

The assessment output is the upstream feeder for two other subsystems: the **context engine (06)** (`master-context.ts` + `context-serializer.ts`) and the **prompt builders** that personalize content/Thinkling. Most notably `personalityData.suggestedSystemPrompt` becomes the AI tutor system prompt via `buildPersonalizedPrompt`.

---

## File-by-file reference

### Pages (Server Components unless noted)

**`src/app/students/page.tsx`** — Students list (RSC).
- Auth: `auth()` then redirect `/login`; `getCurrentUserOrg()` then redirect `/onboarding` if no org (`page.tsx:64-73`).
- Data: local `getOrganizationStudents` wrapped in `cacheQuery(...)` with `revalidate: 60`, `tags: ["students"]` (`:11-61`). `take: 100` explicit bound. Selects `learnerProfile {personalityData, learningStyleData, interestsData}`, `courseEnrollments`, `avatarConfig`.
- Org-scoped via `where: { organizationId }`. Renders `StudentCard` for each, casting `student as any` (`:108`).
- **Drift/risk:** the cache tag is `["students"]` but the create API route (`api/students/route.ts:71`) has `revalidateTag("students")` commented out — only `revalidatePath("/students")` runs. New students still appear because the page path is revalidated, but `cacheQuery` tag invalidation is dead.

**`src/app/students/new/page.tsx`** — New-student page (RSC, no auth check of its own).
- Renders `<DynamicCreateStudentForm />`. No `auth()`/org guard here; relies on the `POST /api/students` route to enforce auth. The page itself is reachable unauthenticated (it only renders a client form).

**`src/app/students/[id]/page.tsx`** — Student detail page (RSC).
- Auth: `auth()` → `/login`; `getCurrentUserOrg()` → `/students` if no org (`:39-48`).
- Data: `getStudentProfileData(id, organizationId)` (server/queries/students.ts). Returns null (→ redirect `/students`) if the student isn't in the org (`:54-56`).
- Builds `contextPreview` via `serializeMasterContext(masterContext, …)` (subsystem 06) (`:60-63`).
- Renders panels: `StudentHeader` (eager), then Suspense-wrapped `PersonalityProfile`, `LearningStyle`, `InterestsPassions`, `ContextCompleteness` (06), `EnrolledCourses`, `CurrentObjectives`, `StudentDiscipleshipCard` (family-discipleship), `RecommendedBooks`, `AIContextPreview` (06).
- **Note:** the Suspense boundaries are cosmetic — all data is already awaited in `getStudentProfileData` before any panel renders; child panels receive plain props and never themselves suspend, so the skeletons never actually show.
- `personalityData`/`learningStyleData`/`interestsData` are read off `student.learnerProfile?.*` and cast `as any` (`:65-67`).

**`src/app/students/[id]/assessment/page.tsx`** — Assessment wizard host (RSC).
- **SECURITY GAP:** This page performs **no auth and no org check**. It awaits `params`, then renders `<DynamicAssessmentWizard studentId={id} />` (`:8-15`). Any unauthenticated visitor can load the wizard for an arbitrary student id. The actual protection lives one layer down in `POST /api/students/[id]/assessment` (which does check). So data can't be written without auth, but the page leaks no data and is harmless beyond UX — still, it's the only student page with zero guard.

### Detail-page panels — `src/app/students/[id]/_components/` (all RSC, presentational)

(Subsystem 06 owns `AIContextPreview.tsx` and `ContextCompleteness.tsx` — not documented here.)

**`StudentHeader.tsx`** — Name/grade header + action buttons. Reads `student.learnerProfile?.personalityData as any` only to decide whether to show "Start Assessment" (shown when no personalityData) (`:11, :30-34`). Links to `/generators?studentId=…`, `/students/{id}/assessment`. Renders `<ContextBadges student={…}>` (context subsystem). Typed via `StudentWithRelations` import from `server/queries/students`.

**`CurrentObjectives.tsx`** — Lists objectives (`ObjectiveWithRelations[]`), `slice(0,10)`, "Showing 10 of N" footer. Each row links to `/generators?studentId=…&objectiveId=…`. Returns `null` when empty.

**`EnrolledCourses.tsx`** — Grid of `student.courseEnrollments`; matches progress from `student.courseProgress` by `courseId`; renders a progress bar from `overallCompletionPercentage`. Links to `/courses/{id}`. Returns `null` when empty.

**`InterestsPassions.tsx`** — Renders `interestsData.hookThemes`, `specificEntities[{category,favorite}]`, `analogyStrategy`. Empty state: "Interests assessment not yet completed." Props typed `any`.

**`LearningStyle.tsx`** — Renders `learningStyleData.inputMode/outputMode/processingMode/formatInstructions`. Empty state message. Props typed `any`.

**`PersonalityProfile.tsx`** — Renders `personalityData.motivationalDriver/feedbackStyle/scaffoldingLevel/toneInstructions`. CTA links to `/students/{id}/assessment` ("Update Assessment" / "Start Assessment"). **Note:** it does NOT render `suggestedSystemPrompt`, the field that actually drives the AI — that field is invisible to the parent in the UI. Props typed `any`.

**`RecommendedBooks.tsx`** — Grid of `BookWithRelations`. Handles `authors` being either `string[]` or `string` (`:34`). Links to `/living-library/{id}` and `/creation-station?studentId=…&bookId=…`. Returns `null` when empty.

### API routes

**`src/app/api/students/route.ts`** — `POST` create student. `export const dynamic = "force-dynamic"`.
- Auth: `auth()` → 401 (`:11-14`). Then `getCurrentUserOrg()`.
- **Self-healing org creation:** if `organizationId` is null, it creates a default `Organization {name:"My School", type:"PARENT_INSTRUCTOR"}`, connects the user, and sets `user.organizationId` (`:19-36`). This means a student-create can silently provision an org — a side effect to be aware of.
- Validates body with `studentSchema` (`lib/schemas/students.ts`), coercing `birthdate` to `Date` (`:41-44`).
- Creates `Student` then a separate empty `LearnerProfile {studentId}` (`:47-68`). Maps form fields to snake_case columns: `support_labels`, `support_profile`, `support_intensity`, and `learningDifficulties` joined as a comma string (`:56-59`).
- `revalidatePath("/students")` only; `revalidateTag("students")` is commented out (`:71-73`).
- Error handling: ZodError → 400; else 500 with `error.message` echoed back in `details` (`:76-91`). **Note:** Zod v4 errors may report `name` differently; the `error.name === "ZodError"` check (`:77`) can miss, sending validation failures as 500.

**`src/app/api/students/[id]/assessment/route.ts`** — `POST` assessment step (NOT in the "files you own" list but is the server side the wizard calls; documented as the core flow). `dynamic = "force-dynamic"`.
- Auth: `auth()` → 401 (`:17-20`). Loads student, then `getCurrentUserOrg()`; if `student.organizationId !== organizationId` → 404 (acts as tenancy guard, returns 404 not 403 to avoid leaking existence) (`:30-42`).
- Branches on `body.step`: `"personality"` → `generateStudentProfile`, `"learning"` → `generateLearningStyleProfile`, `"interests"` → `generateInterestProfile`; else 400 (`:49-66`).
- **Upserts** `LearnerProfile` keyed on `studentId` with the derived JSON + `completedAt: new Date()` (`:46, :70-77`). Note `completedAt` is set on EVERY step, so it reflects "last step saved", not "all 3 done".
- Verbose `console.log` of step/ids on each request (`:27, :51-61`).

### Server actions

**`src/app/actions/student.ts`** (`"use server"`) — two actions, both org-guarded via local `assertStudentInOrg(studentId)` which throws "Unauthorized" if the student isn't in the caller's org (`:7-11`).
- `getStudentAssignments(studentId)` — returns `{assignments (ResourceAssignment, take 50), courseEnrollments (CourseStudent, take 20)}`. Called by `StudentDashboard` (subsystem: dashboards).
- `saveStudentAvatarConfig(studentId, config)` — updates `student.avatarConfig`. **No `revalidatePath`/`revalidateTag`** — avatar changes won't invalidate the cached students list / dashboards until natural expiry. Called by `AvatarCustomizer`.

**`src/app/actions/student-actions.ts`** (`"use server"`) — `deleteStudent(rawData)`.
- Validates with `deleteStudentSchema` from `lib/schemas/actions`. Auth via `auth()` → throw; `getCurrentUserOrg()`.
- Org guard: loads student, returns `{success:false, error:"Unauthorized…"}` if cross-org (`:29-31`) — note: **returns** an error object here rather than throwing, inconsistent with `student.ts`.
- `db.student.delete` relies on Prisma `onDelete: Cascade` (Student → LearnerProfile, SafetyFlag, enrollments, etc.). `revalidatePath("/students")`. Wrapped in try/catch returning a generic failure string (comment above says the try/catch was "removed" but it's still present — stale comment, `:33-44`).

### Server queries

**`src/server/queries/students.ts`** — typed selects + the orchestrator.
- `studentSelect` (`:10-100`) — precise field selection incl. `learnerProfile {personalityData, learningStyleData, interestsData}`, `courseEnrollments` (+course/subject/strand), `activityProgress` (take 10), `courseProgress`, `personalizedResources` (take 5), `organizationId`. Exposes `StudentWithRelations` type.
- `getStudentById(studentId, orgId)` — `cache()`-wrapped; `findUnique` then **manual org check** returning null on mismatch (`:179-191`).
- `getStudentMasterContext` — delegates to `getMasterContext` (subsystem 06).
- `getStudentObjectives(courseIds)` — objectives where `subtopic.topic.strand.courses` includes any course id, `take: 20` (`:212-237`). **Risk:** filters by *strand membership of the course*, not by the student's actual subtopic progress — so it returns up to 20 objectives across all strands the student's courses belong to, ordered by `sortOrder`, regardless of grade/mastery. Functionally a "sample of objectives for these strands", not "the student's current objectives."
- `getRelevantBooks(orgId, subjectIds, strandIds)` — org-scoped books matching subject OR strand, `take: 10`.
- `getStudentProfileData(studentId, orgId)` — top orchestrator (`:274-302`). Fetches student, derives course/subject/strand ids, then `Promise.all([masterContext, objectives, books])`. Returns `null` if student not in org. This is the single entry the detail page uses.

### AI

**`src/server/ai/personality.ts`** — the assessment "brain". Three Zod schemas + three `generateObject` functions.
- `PersonalityProfileSchema` (`:11-32`): `motivationalDriver` (The Why/Win/List/Story), `creativityPreference`, `feedbackStyle` (Cheerleader/Coach/Socratic), `frustrationResponse`, `workStyle`, derived `gamificationMode:boolean`, `scaffoldingLevel` (High/Medium/Low), `toneInstructions:string`, and **`suggestedSystemPrompt:string`** — "a complete, ready-to-use system prompt (2-4 sentences) an AI tutor can adopt." This is THE field consumed downstream by `buildPersonalizedPrompt`.
- `LearningStyleSchema` (`:42-57`): `inputMode`, `contentDensity` (note enum typo `"Mirco-Learning"`, `:48`), `outputMode`, `processingMode`, derived `formatInstructions`.
- `InterestProfileSchema` (`:67-87`): `hookThemes[]`, `specificEntities[{category,favorite}]`, `expertTopics[]`, `integrationMode` (Surface/Deep/Reward), derived `analogyStrategy`.
- `generateStudentProfile(answers, name)` (`:94-118`) — model `getModelForTask(AITaskType.PERSONALITY_PROFILING)`. Prompt explicitly asks it to also synthesize `suggestedSystemPrompt`.
- `generateLearningStyleProfile` (`:123-143`) — `LEARNING_STYLE_ANALYSIS` task.
- `generateInterestProfile` (`:148-164`) — reuses `PERSONALITY_PROFILING` task; JSON-stringifies the interest answers into the prompt.
- **Model reality:** despite `config.ts` comments claiming these "MUST use Gemini 3 Pro", `taskModelMap` downgrades both `PERSONALITY_PROFILING` and `LEARNING_STYLE_ANALYSIS` to **`models.flash` (gemini-2.5-flash)** "for reliability" (`lib/ai/config.ts:62-63`). `pro3`/`pro` both resolve to `gemini-2.5-pro` (the `gemini-3-pro-preview` was retired by Google ~2026-06; see `config.ts:10`). So all comments referencing "Gemini 3 Pro" are doc-drift.

### Schemas

**`src/lib/schemas/students.ts`** — `studentSchema` (Zod): `firstName` (req), `lastName?`, `preferredName?`, `birthdate:z.date()` (req), `currentGrade` (req), `sex` enum MALE/FEMALE optional, `learningDifficulties:string[]?`, and the support trio `supportLabels:string[]?`, `supportProfile:z.record(string,any)?`, `supportIntensity:string?`. Exports `StudentFormData`. (`deleteStudentSchema` lives in `lib/schemas/actions`, out of scope.)

### Client components — `src/components/students/`

**`CreateStudentForm.tsx`** (`"use client"`) — RHF via `useZodForm(studentSchema)`. POSTs to `/api/students` with `birthdate` as `YYYY-MM-DD` (`:53-60`). On success `router.push("/students/{id}")`. Embeds `<SupportProfileWizard register setValue watch />`. Default values seed `learningDifficulties:[]`, `supportLabels:[]`, `supportProfile:{}`. The `as unknown as UseFormReturn<StudentFormData>` cast (`:47`) papers over a resolver type mismatch.

**`DynamicCreateStudentForm.tsx`** / **`DynamicAssessmentWizard.tsx`** (`"use client"`) — thin `next/dynamic` wrappers, `ssr:false`, Phosphor spinner loading state. Exist so the heavy client forms aren't server-rendered. `new/page.tsx` and `assessment/page.tsx` import the Dynamic variants.

**`AssessmentWizard.tsx`** (`"use client"`, ~530 lines) — the 3-step wizard.
- Hard-coded questionnaires: `PERSONALITY_QUESTIONS` (5), `LEARNING_STYLE_QUESTIONS` (4), `INTEREST_WORLDS` (6), `INTEREST_STRATEGIES` (3). Steps: `intro → personality → learning → interests → success`.
- `handleSaveStep` POSTs `{step, answers}` to `/api/students/{studentId}/assessment`, advances on success, `toast` feedback (`:205-243`).
- Personality/learning "Next" buttons disabled until `Object.keys(answers).length === questions.length` (`:327, :374`) — interests step has no completeness gate (`:485`).
- **Data-shape bug:** `LEARNING_STYLE_QUESTIONS.contentDensity` offers an option `value:"Overwhelmed"` (`:131`) but `LearningStyleSchema.contentDensity` enum is `["Skimmer","Deep Reader","Mirco-Learning"]` (`personality.ts:47-48`) — "Overwhelmed" is not a valid enum member. Since answers are free-text fed into the LLM prompt (not validated against the schema directly), the model maps it, but the option↔schema mismatch is real drift.
- Cosmetic copy bugs: "How should Inkling talk to expectations?" (`:292`), missing space in `bg-qc-surface-raisedpy-12` className (`:519`).
- Uses the brand name **"Inkling"** throughout the UI; the runtime chat assistant is named **"Thinkling"** (`lib/thinkling.ts`). Inconsistent naming.

**`SupportProfileWizard.tsx`** (`"use client"`) — embedded in `CreateStudentForm`, driven by RHF `register/setValue/watch`. Progressive disclosure: gateway Yes/Not sure/No → optional labels (`OPTIONAL_LABELS`, 9 incl. ADHD/ASD/Dyslexia…) → `CORE_SUPPORTS` (8 categories A–H, 4 options each) → intensity (LOW/MODERATE/HIGH). Writes `supportLabels:string[]`, `supportProfile:Record<category, string[]>`, `supportIntensity:string` into the form.
- **Dead-data risk:** `supportProfile` (the detailed per-category accommodation picks) is persisted to `Student.support_profile` (Json) but **never read anywhere** — confirmed: only writers are this wizard + create route; no consumer in `src/{app,lib,server,components}`. Only `support_labels` is consumed, and only by `src/lib/ai/prompt-builder.ts:42`. `support_intensity` is likewise write-only. So ~80% of this wizard's output is collected but ignored by content generation and by the student-detail UI.

**`StudentCard.tsx`** (`"use client"`) — list card. `hasProfile = !!learnerProfile`; `profileComplete = hasProfile && !!personalityData` (`:30-31`) — i.e. "complete" only requires the personality step, not learning/interests. Renders DiceBear avatar via `getStudentAvatarUrl(name, avatarConfig)` (remote `api.dicebear.com`). Links: Profile, `/transcripts/{id}`, assessment ("Start/Complete Setup"). Delete via `AlertDialog` → `deleteStudent({id})` server action + toast. `student` prop typed `any`.

### Avatar — `src/components/profile/AvatarCustomizer.tsx`

(`"use client"`) — Dialog-based DiceBear **Lorelei** editor.
- Uses `@dicebear/core` `createAvatar(lorelei, …)` rendered **client-side** to an SVG string injected with `dangerouslySetInnerHTML` (`:264-269, :351`). (Contrast: the list/card path uses the **remote** `api.dicebear.com/9.x/lorelei/svg` URL via `getStudentAvatarUrl`. Two different rendering paths for the same avatar — local SVG in the editor, remote HTTP image everywhere else.)
- Large hard-coded palettes (hair/skin/eye/lip/earring/eyeglass colors) and per-feature option lists (`OPTIONS`, sampled here: hair variant01–48, eyes 01–24, mouth happy/sad, etc., `:116-148`).
- `FeatureSlider` handles optional features (glasses/earrings/freckles) via a `-1 = None` slider position that sets `{feature}Probability` to 0/100 (`:168-214`). `randomize()` forces those probabilities too (`:305-334`).
- `handleSave` → `cleanConfig` (drops null/empty) → `saveStudentAvatarConfig(studentId, finalConfig)` server action, toast, `onSave` callback (`:285-303`).
- Only rendered from `StudentDashboard.tsx` (dashboards subsystem) — not wired into the `/students` detail page or list.

---

## Data models & tenancy

All from `prisma/schema.prisma`. Tenancy key is `Student.organizationId` (`@map("account_id")`).

**`Student`** (`:279-315`, table `students`):
- Identity: `firstName`, `lastName?`, `preferredName?`, `birthdate (Date)`, `sex (Sex?)`, `currentGrade (String)`.
- Support: `support_intensity:String?`, `support_labels:String[]`, `support_profile:Json?`, `learningDifficulties:String?` (comma string), `avatarConfig:Json?`.
- Relations (many): `learnerProfile (LearnerProfile?)`, `courseEnrollments (CourseStudent)`, `courseProgress`, `activityProgress`, `personalizedResources (Resource)`, `resourceAssignments`, `classroomEnrollments`, `transcripts`, `safetyFlags (SafetyFlag[])`, plus discipleship relations (prayer/memory/catechism/schedule/customEvents). `organization` relation `onDelete: Cascade` — deleting the org cascades to students; deleting a student cascades to its children.

**`LearnerProfile`** (`:350-364`, table `learner_profiles`):
- `studentId @unique` (1:1 with Student), `completedAt:DateTime?`.
- The three AI outputs: `personalityData:Json?`, `learningStyleData:Json?`, `interestsData:Json?`.
- **Unused columns:** `rawQuestionnaireResponses:Json?` and `questionnaireVersion:String?` exist in the schema but are **never written or read** anywhere in the code — the assessment route stores only the derived JSON, discarding the raw answers. Half-built / planned.
- `onDelete: Cascade` from Student.

**`SafetyFlag`** (`:317-334`, table `safety_flags`):
- `studentId`, `severity ("CONCERN"|"DANGER")`, `category ("BULLYING"|"SELF_HARM"|"GROOMING"|"VIOLENCE"|"OTHER")`, `message`, `reasoning`, `isResolved`, `alertSent`, `resolution?`, `implicatedCaregiver`, timestamps.
- **Owned by the Thinkling/safety subsystem, not this one.** This subsystem only declares the `safetyFlags SafetyFlag[]` relation on Student (`:312`). No code in the Students/Assessment files reads or writes SafetyFlag. The flags are produced by the chat-safety pipeline (see `lib/thinkling.ts` and the safety subsystem) and merely hang off the Student via cascade.

**Tenancy posture summary:** Every server entry point that touches a specific student re-checks org ownership — `getStudentById` (manual null), `getStudentProfileData` (via the former), both server actions (`assertStudentInOrg` / inline check), the create route (`getCurrentUserOrg`), and the assessment route (404-on-mismatch). The one un-guarded surface is the **assessment page component** (`students/[id]/assessment/page.tsx`) which renders without any auth/org check.

---

## Entry points & end-to-end flows

### Flow A — Create a student
1. `/students/new` (RSC, no guard) renders `DynamicCreateStudentForm` → `CreateStudentForm` (client).
2. User fills name/grade/birthdate/sex + walks the `SupportProfileWizard` (labels, per-category supports, intensity).
3. Submit → `POST /api/students` with JSON (`birthdate` as `YYYY-MM-DD`).
4. Route: `auth()` → `getCurrentUserOrg()` (self-heals org if missing) → `studentSchema.parse` → `db.student.create` → `db.learnerProfile.create({studentId})` (empty) → `revalidatePath("/students")`.
5. Client `router.push("/students/{id}")`.

### Flow B — Run the assessment (the core AI flow)
1. From a card/header/profile CTA → `/students/{id}/assessment` (RSC, **no guard**) → `DynamicAssessmentWizard` → `AssessmentWizard` (client).
2. Per step (personality, then learning, then interests), client `POST /api/students/{id}/assessment` with `{step, answers}` (raw option values / interest objects).
3. Route: `auth()` (401) → load student → `getCurrentUserOrg()` org-match (404 else) → call the matching `generate*Profile()` (Gemini Flash `generateObject` against the Zod schema) → `db.learnerProfile.upsert` storing the **derived** JSON into `personalityData|learningStyleData|interestsData` + `completedAt`.
4. Wizard advances; on the interests step it finishes to a success card linking back to `/students/{id}`.

### Flow C — View student profile
1. `/students/{id}` (RSC, guarded) → `getStudentProfileData(id, orgId)`:
   - `getStudentById` (org-checked) → derive course/subject/strand ids → `Promise.all` of `getMasterContext`, `getStudentObjectives`, `getRelevantBooks`.
2. `serializeMasterContext(masterContext)` builds the AI-context preview text (06).
3. Panels render personality/learning/interests + courses/objectives/books + discipleship card.

### Flow D — Profile feeds AI generation (downstream, cross-subsystem)
- **Content generation:** `buildPersonalizedPrompt(studentId, basePrompt)` (`lib/utils/prompt-builder.ts:113-156`) loads `learnerProfile`, and if `personalityData` exists, injects `personalityData.suggestedSystemPrompt` (plus `communicationStyle`/`primaryDrivers` — note these two keys are **not** in `PersonalityProfileSchema`, so they're always empty). This is the single concrete consumer of the assessment's headline field.
- **Master context / context-serializer (06):** `master-context.ts` types a `profile` block with `personalityData/learningStyleData/interestsData` (`:65-90, :523-529`); `context-serializer.ts` renders `scaffoldingLevel`, `toneInstructions`, `formatInstructions`, `analogyStrategy`, etc. (`:155-196`) into the prompt text.
- **Thinkling chat (20):** `lib/thinkling.ts` builds a base system prompt and folds in `learnerProfile.interestsData` and `learningStyleData` as JSON strings (`:32-35`) — it does **not** use `personalityData.suggestedSystemPrompt`.
- **Other support-data path:** `lib/ai/prompt-builder.ts:40-56` merges `support_labels` + `learningDifficulties` into a "Helpful Supports & Accommodations" line. `support_profile` and `support_intensity` are not used here or anywhere.

---

## External dependencies & services

- **Vercel AI SDK** (`ai` → `generateObject`) + **`@ai-sdk/google`** (Gemini). API key shim: `GEMINI_API_KEY` → `GOOGLE_GENERATIVE_AI_API_KEY` (`lib/ai/config.ts:4-6`). Models actually used by this subsystem: `gemini-2.5-flash` (both profiling tasks, per `taskModelMap`).
- **Zod** — input validation (`studentSchema`) and AI structured-output schemas.
- **DiceBear** — `@dicebear/core` + `@dicebear/collection` (Lorelei) for client-side SVG in `AvatarCustomizer`; **remote** `https://api.dicebear.com/9.x/lorelei/svg` for list/card/dashboard rendering (`lib/utils.ts:8-23`).
- **Prisma 7 / Postgres** — `db` from `@/server/db`; types from `@/generated/client`.
- **NextAuth** — `auth()` from `@/auth`; org resolution via `getCurrentUserOrg` (`lib/auth-helpers.ts`).
- **react-hook-form** (via `useZodForm`), **sonner** (toasts), **@phosphor-icons/react** (icons), **next/cache** (`revalidatePath`).
- **`cacheQuery`** (`@/lib/utils/prisma-cache`) — Next `unstable_cache`-style wrapper used by the list page.

---

## Auth / security posture

- **Guarded:** list page, detail page, create API, assessment API, both server actions — all enforce auth + org ownership (404/redirect/throw on mismatch). Cross-org access is consistently blocked at the data layer.
- **Unguarded:** `students/[id]/assessment/page.tsx` (no `auth()`/org check). It only renders a client wizard and leaks no server data, but it's the one student page without a guard; the real protection is the assessment API route.
- **Minor:** error responses in `api/students/route.ts` (`:87`) and the assessment route (`:85`) echo `error.message` to the client (`details`) — verbose internal error leakage. The self-healing org-create in the create route is a silent state mutation.
- **`dangerouslySetInnerHTML`** in `AvatarCustomizer` injects DiceBear-generated SVG. The SVG is produced locally from a fixed schema (not user free-text), so XSS surface is low, but `config` is persisted Json that flows back into both the local generator and the remote URL query string.
- No CSRF tokens on the JSON POST routes (relies on same-site session cookie + NextAuth).

---

## Risks, drift, dead-code & half-built

1. **Assessment page has no auth/org guard** (`students/[id]/assessment/page.tsx`) — only student page without one. (security)
2. **`support_profile` + `support_intensity` are write-only** — collected by `SupportProfileWizard`, stored, never consumed by any prompt/context/UI. Only `support_labels` is read (one prompt builder). Most of the support wizard's output is dead data. (half-built)
3. **`LearnerProfile.rawQuestionnaireResponses` / `questionnaireVersion` never written or read** — schema columns with no code. (half-built/dead)
4. **`suggestedSystemPrompt` is never shown in the UI** — `PersonalityProfile.tsx` renders other fields but not the one that drives the AI; parents can't see/verify the actual tutor prompt. (visibility gap)
5. **Model-comment drift:** `config.ts` repeatedly claims profiling "MUST use Gemini 3 Pro"; actual map uses Gemini 2.5 Flash, and `pro3`/`pro` both point at `gemini-2.5-pro` (Gemini 3 preview retired). (doc-drift)
6. **`buildPersonalizedPrompt` reads `communicationStyle`/`primaryDrivers`** off `personalityData` — keys not present in `PersonalityProfileSchema`, so always empty strings/array in the prompt. (dead branch)
7. **Enum/option mismatches:** learning-style option `"Overwhelmed"` not in schema enum; schema typo `"Mirco-Learning"`. (bug/drift)
8. **`getStudentObjectives` doesn't reflect the student** — returns objectives by strand-of-course, capped at 20 by `sortOrder`, ignoring grade/progress. Labeled "current objectives" but isn't. (misleading)
9. **`revalidateTag("students")` commented out** in create route while the list page caches with `tags:["students"]` — tag invalidation is dead; only path revalidation saves it. (cache drift)
10. **`saveStudentAvatarConfig` has no revalidation** — avatar edits don't bust the cached list/dashboard. (stale UI)
11. **`completedAt` set on every assessment step**, so it means "last saved," and `profileComplete` (StudentCard) only checks `personalityData` — a student with only step 1 reads as "✓ Complete." (semantics)
12. **Two avatar rendering paths** (local `@dicebear/core` SVG in editor vs remote `api.dicebear.com` image elsewhere) can diverge visually and add a third-party network dependency for every list/card render. (consistency/availability)
13. **Pervasive `as any` typing** on `student`, `personalityData`, etc. across panels, `StudentCard`, list page — defeats the precise `StudentWithRelations` types that exist. (type safety)
14. **Suspense boundaries on the detail page are cosmetic** — all data is pre-awaited; skeletons never render. (no-op)
15. **Stale comments:** `student-actions.ts:33-34` says the try/catch was removed; it wasn't. `api/students/route.ts:71` "Invalidate students cache" sits above commented-out code. (doc-drift)
16. **Zod v4 error detection** in create route uses `error.name === "ZodError"`; if that doesn't hold, validation errors return 500 not 400. (bug)

---

## Cross-links to other subsystems

- **06 Context Engine:** `getMasterContext` / `serializeMasterContext` (`lib/context/master-context.ts`, `context-serializer.ts`). Reads `learnerProfile.{personalityData,learningStyleData,interestsData}` and renders them into prompt text. Owns `AIContextPreview.tsx`, `ContextCompleteness.tsx`, `ContextBadges`.
- **05 AI Core / Prompt building:** `lib/utils/prompt-builder.ts` (`buildPersonalizedPrompt` consumes `suggestedSystemPrompt`; `buildMasterPrompt`); `lib/ai/prompt-builder.ts` (`setStudentContext` consumes `support_labels`). `lib/ai/config.ts` (model selection).
- **20 Thinkling / Chat + Safety:** `lib/thinkling.ts` builds the student chat persona from `interestsData`/`learningStyleData`; the safety pipeline writes `SafetyFlag` rows that hang off `Student`.
- **Dashboards:** `StudentDashboard.tsx` / `StudentProfileSwitcher.tsx` / `ParentDashboard.tsx` render avatars (`getStudentAvatarUrl`) and host the `AvatarCustomizer`; `StudentDashboard` calls `getStudentAssignments`.
- **Courses / Generators / Living Library / Transcripts:** linked from panels and cards (`/generators?studentId=…`, `/courses/{id}`, `/living-library/{id}`, `/creation-station`, `/transcripts/{id}`).
- **Family Discipleship:** `StudentDiscipleshipCard` rendered on the detail page.

---

## Open questions

1. Is the un-guarded `assessment/page.tsx` intentional (relying solely on the API route), or an oversight? It diverges from every other student page.
2. Were `support_profile`/`support_intensity` and `LearnerProfile.rawQuestionnaireResponses`/`questionnaireVersion` planned for a future generation path that never landed? They're collected/declared but unused.
3. Should `suggestedSystemPrompt` be surfaced (and editable) for parent review, given it's the field steering the tutor?
4. `buildPersonalizedPrompt` expects `communicationStyle`/`primaryDrivers` keys that the schema doesn't produce — was the schema renamed (Driver vs primaryDrivers) without updating the consumer?
5. Should `getStudentObjectives` be re-scoped to the student's actual subtopic/grade progress, or is the strand-level sample intentional?
6. Should avatar rendering standardize on one path (local SVG vs remote DiceBear API) to remove the third-party network dependency and visual drift?
