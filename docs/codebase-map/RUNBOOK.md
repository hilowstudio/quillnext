# QuillNext Implementation RUNBOOK

> **Purpose.** This is the single executable backlog for QuillNext ("Quill & Compass"),
> synthesized from the 22 per-subsystem improvement docs in `.runbook-parts/` and reconciled
> against `00-INDEX.md`'s risk list. Every active item from those docs appears here exactly once:
> cross-subsystem duplicates (the same IDOR, the dead `/dashboard` proxy, the `deleteCourse` call-shape
> bug, the `resource_kind` contract, the `getBibleText` raw-string bug) have been merged into one task
> that lists all source docs and all affected locations. Tasks are ordered into four execution phases
> and given stable IDs by area.

## How to use this runbook

- **Do Phase 0 before any real launch.** The P0 tasks are cross-tenant leaks, auth bypasses, a
  child-safety notification leak, and a non-atomic full-tenant delete. They gate a launch; nothing
  else ships safely until they are closed.
- **Each task is self-contained.** It states the problem, the exact `path:line` locations, concrete
  code-grounded fix steps, a way to verify, and its dependencies. You can hand a single task to one
  engineer.
- **Verify before checking off.** Run the stated verification (a `tsc`/build/test/manual repro) and
  confirm the output before marking a box done. Do not assert "done" from reading code alone.
- **Trust the code over the prose docs.** The repo's `.cursor/*`, `README.md`, and QSF artifacts are
  stale planning documents. Where they disagree with the code, the code wins. All locations below were
  re-grounded against `main` on 2026-06-16.
- **Sequencing matters where noted.** Establish the canonical `auth()` + `getCurrentUserOrg()` +
  `where:{organizationId}` guard pattern (the IDOR-safe reference is `generate-tool.tsx:47-49`) first,
  then sweep the IDOR sites. Add a missing route before wiring its form. Stand up the test runner once,
  then let every "add tests" task hang off it.

## Already done (2026-06-16)

- **AI model-stack refresh** is complete and live-verified. `flash=gemini-3.5-flash`,
  `pro`/`pro3=gemini-3.1-pro-preview` wrapped in `withRetirementFallback` → stable `gemini-2.5-pro`,
  `flashLite=gemini-3.1-flash-lite`, `imageGen=gemini-3-pro-image` (off the broken Imagen cast),
  embeddings `gemini-embedding-2` @1536 dims with `RETRIEVAL_DOCUMENT`/`RETRIEVAL_QUERY` taskTypes
  (`src/lib/ai/config.ts`). The only remaining model work is **comment/copy drift** ("Gemini 3 Pro" /
  "only model that processes YouTube" / "with caching"), captured as HYG tasks below.
- **The codebase map is complete** — `00-INDEX.md` plus the 21 subsystem docs and addendum, all
  verified against source. This runbook is built from them.

## Summary table

| Phase | Theme | Task count |
|---|---|---|
| Phase 0 | P0 Security (cross-tenant / auth / data-loss / child-safety) | **12** (SEC-1…SEC-12) |
| Phase 1 | Make half-built features work (or remove) | **26** (FEAT-1…FEAT-26) |
| Phase 2 | Correctness bugs | **28** (BUG-1…BUG-28) |
| Phase 3 | Drift, dead-code, infra & hygiene | **53** (HYG-1…HYG-53) |
| **Total** | | **119** |

**Highest-priority handful — do these first, in this order:**

1. **SEC-2** — Authn/org-guard the grading AI-feedback actions (`generateItemFeedback`/`generateOverallFeedback`); no `auth()` at all, fully attacker-controlled org/student ids. *(docs 05, 16; indexed in 06)*
2. **SEC-1** — Derive `organizationId` from session in `POST /api/context/inspect` (reads org from request body → any authed user reads any org's master context). *(doc 06)*
3. **SEC-7** — Wrap `deleteAccount` in one `$transaction` **and** role-gate it (non-atomic full-tenant delete callable by any member). *(doc 04)*
4. **SEC-9** — Stop `bible-memory/page.tsx` from seeding the UI with a global-first `db.student.findFirst()` (cross-tenant student leak). *(doc 19)*
5. **SEC-11** — Stop safety pattern-escalation from overriding the caregiver hard-stop (can email a fear/abuse disclosure to the implicated caregiver). *(doc 20)*

Establish the canonical tenant guard once, then SEC-1/2/3/4/5/6 (and the re-filed SEC-12 `reorderBlocks` IDOR) are mechanical sweeps. Rough total effort across all 119 tasks: on the order of **40–55 engineer-days** (Phase 0 ≈ 4–6 days; Phase 1 ≈ 18–24 days, dominated by grading/activity-authoring/video-unification; Phase 2 ≈ 8–10 days; Phase 3 ≈ 12–16 days incl. the test harness and the large dead-asset deletions).

---

## Phase 0 — P0 Security (do first)

Cross-tenant / IDOR / auth-bypass / data-loss / child-safety. These gate a real launch.
**Sequencing:** SEC-1…SEC-6 (and SEC-12) all apply the same fix (re-derive org/user from session via
`getCurrentUserOrg()`, ignore client-supplied ids, scope every write by `organizationId` — pattern at
`generate-tool.tsx:47-49`). Land the pattern once, then sweep. SEC-10 (DB RLS) is the long-term
backstop and may run in parallel.

- [x] **SEC-1 — Derive `organizationId` from session in `/api/context/inspect`** (P0, S, security-idor)
  - **Problem:** The route only checks that a session exists, then passes the **request body** straight into `getMasterContext(params)`. The body supplies `organizationId`/`studentId`, so any authenticated user reads another org's family/student/library/schedule context. The student fetcher's `organizationId !== organizationId` guard can't help — the attacker controls both halves.
  - **Locations:** `src/app/api/context/inspect/route.ts:8-18` (esp. `:14-15`); guard at `src/lib/context/master-context.ts:445-447`; safe pattern `src/app/actions/generate-tool.tsx:47-49`.
  - **Fix:** 1) Import `getCurrentUserOrg` from `@/lib/auth-helpers`. 2) After `auth()`, resolve `const { organizationId } = await getCurrentUserOrg();`, 403 if null. 3) Read the body for narrowing ids only (`studentId`, `objectiveId`, `courseId`) and call `getMasterContext({ organizationId, ...narrowingIds })` using the **session** org, ignoring any body `organizationId`. 4) (Defense-in-depth) validate `studentId` belongs to the org.
  - **Verify:** As org A, `POST` with `{ "organizationId":"<orgB>", "studentId":"<orgB student>" }` returns org A's context (or empty), never org B's. `tsc --noEmit` clean.
  - **Depends on:** none. *(Source: 06)*

- [x] **SEC-2 — Enforce caller-org ownership in the grading AI-feedback actions** (P0, S, security-idor)
  - **Problem:** `generateItemFeedback` and `generateOverallFeedback` are `"use server"` actions with **no `auth()`/`getCurrentUserOrg()` at all**; they take `organizationId`/`studentId`/`courseId` straight from the client and forward them into `buildMasterPrompt` → `getMasterContext` → `getFamilyContext`, which fetches org+classroom by id with no membership check. A user in org A can pass org B's `organizationId` and exfiltrate B's classroom name, philosophy, faith background, and instructor names into returned feedback. `getStudentContext` suppresses a foreign `studentId`, but the org/family branch is not protected.
  - **Locations:** `src/app/actions/grading-actions.ts:24-58` and `:60-98`; leak sink `src/lib/context/master-context.ts:264-268`; unvalidated course read `:722-739`; callers `src/components/grading/GradingInterface.tsx:42-48,68-75`; safe pattern `generate-tool.tsx:47-50`.
  - **Fix:** 1) At the top of both actions, `const { organizationId } = await getCurrentUserOrg();` (import from `@/lib/auth-helpers`); throw if null. 2) **Drop `organizationId` from the params** and derive it server-side (delete it from the param interfaces and the client call sites). 3) Validate `studentId` (and optionally `courseId`) belong to that org via `db.student.findFirst({ where:{ id, organizationId } })` before building the prompt. 4) Update `GradingInterface.tsx` to stop passing `organizationId`.
  - **Verify:** `tsc --noEmit` after the param change; call with a foreign `studentId`/`organizationId` → "Forbidden"; legitimate flow still produces feedback.
  - **Depends on:** none. *(Source: 05, 16; cross-ref index P0 #2)*

- [x] **SEC-3 — Org-scope the course branch in `getSmartDefaults`** (P0, S, security-idor)
  - **Problem:** The `courseId` branch does `db.course.findUnique({ where:{ id: courseId } })` with **no org filter**, then reads `course.students[0].studentId` and the course's objectives. A crafted URL-supplied `courseId` (caller: `creation-station/[id]/page.tsx:86`) surfaces another org's enrolled student id and objective list.
  - **Locations:** `src/lib/context/smart-defaults.ts:25-41` (lookup at `:26`); caller `src/app/creation-station/[id]/page.tsx:86`.
  - **Fix:** 1) Change to `db.course.findFirst({ where:{ id: courseId, organizationId }, include:{...} })` so a foreign course resolves to `null` and the branch falls through to no defaults. 2) (Defensive) confirm `course.students[0].student.organizationId === organizationId` before assigning `suggestedStudentId`.
  - **Verify:** `getSmartDefaults(orgA, courseIdOfOrgB)` → `{}`. `tsc --noEmit` clean.
  - **Depends on:** none. *(Source: 06; cross-ref index P0 #5)*

- [x] **SEC-4 — Filter `getCourseBooks`/`getBookChapters` by caller's org + verify course ownership** (P0, M, security-idor)
  - **Problem:** `getCourseBooks` looks up a `Course` by arbitrary client `courseId` with no auth/org check, then queries `Book` by `subjectId OR strandId` **without** filtering `Book.organizationId`, so any authed user can enumerate other orgs' book titles + full `tableOfContents` for shared subjects. The sibling `getBookChapters` reads a `Book` by raw `bookId` with no org filter, exposing any org's TOC by id.
  - **Locations:** `src/app/actions/curriculum-actions.ts:19-44` (getCourseBooks), `:46-67` (getBookChapters); pattern to mirror `src/app/actions/course-resource-actions.ts:43-63`.
  - **Fix:** 1) Import `getCurrentUserOrg`. 2) In `getCourseBooks`, resolve the org, verify course ownership (`findFirst({ where:{ id: courseId, organizationId } })` or post-check), and add `organizationId` to the `book.findMany` where. 3) In `getBookChapters`, scope the lookup to `findFirst({ where:{ id: bookId, organizationId } })`. (Also pairs with HYG-15 TOC hardening.)
  - **Verify:** `tsc --noEmit`; cross-org `courseId`/`bookId` → empty; same-org calls from `courses/[id]/blocks/new/page.tsx:14,122,129` still work.
  - **Depends on:** none. *(Source: 07; cross-ref index P0 #4)*

- [x] **SEC-5 — Org-scope the "Similar Books" sidebar (`findSimilarBooks` cross-org leak)** (P0, S, security-idor)
  - **Problem:** `findSimilarBooks` runs raw cosine SQL across **all** `books` rows with no `account_id` filter; the book-detail page renders the returned titles + summaries, leaking other orgs' books. (`searchBooks` shares the un-scoped SQL but its API re-scopes results; the leak is specifically the detail sidebar.)
  - **Locations:** `src/lib/utils/vector.ts:73-99` (no org filter; DB column is `account_id`); call site + render `src/app/living-library/[id]/page.tsx:58,222-237`.
  - **Fix:** 1) Add an `organizationId` param to `findSimilarBooks`. 2) In the raw SQL self-join add `AND b2.account_id = ${organizationId}` (bound param). 3) Pass `organizationId` (already in scope via `getCurrentUserOrg()` at `:23`) from the caller.
  - **Verify:** Two orgs with embedded books; org A's detail sidebar never shows org B titles. `tsc --noEmit`.
  - **Depends on:** none. *(Source: 15; cross-ref index P0 #3)*

- [x] **SEC-6 — Validate `compileCurriculumAction` input server-side (constraints / durationDays)** (P0, M, security-idor)
  - **Problem:** The action types `constraints: any` and `durationDays: number` and persists them with no server validation (only a bypassable client zod schema). An arbitrary `durationDays` (e.g. 100000) flows into `explode-bundle`'s `Array.from({ length: duration })`, attempting that many `CourseBlock` rows in one `$transaction` — a self-DoS / data-bloat vector. Constraints JSON is echoed verbatim into LLM prompts and the manifest.
  - **Locations:** `src/app/actions/compile-curriculum-action.ts:9-15,23-33`; client schema `src/app/creation-station/compiler/SpecForm.tsx:22-33`; explode loop `src/app/actions/explode-bundle.ts:99,171`.
  - **Fix:** 1) Lift the form schema into shared `src/lib/validation/curriculum-spec.ts` (`constraints` = four booleans; `durationDays = z.coerce.number().int().min(1).max(20)`) imported by both `SpecForm` and the action. 2) In the action, take `data: unknown` and `CurriculumSpecSchema.parse(data)` after `auth()`. 3) Add a defensive clamp at `explode-bundle.ts:99` (`Math.min(Math.max(1, durationDays), 20)`).
  - **Verify:** `tsc --noEmit`; calling with `durationDays:9999` throws a zod error; `SpecForm` submit still works end-to-end.
  - **Depends on:** none (shared schema also unblocks FEAT-13). *(Source: 09; cross-ref index P0)*

- [x] **SEC-7 — Make `deleteAccount` atomic **and** role-gate it** (P0, M, data-integrity + auth)
  - **Problem:** Two P0 defects in one action. (a) It deletes a ~20-query dependency graph **un-transacted**, ending with `organization.delete` then `user.delete`; a mid-way failure leaves an irrecoverable half-deleted tenant. (b) It has **no role check** and cascades to the entire `Organization` (`User.organization` FK is `onDelete: Cascade`), so any member — including a non-owner — can destroy every other user, student, course, transcript, and library item.
  - **Locations:** `src/app/actions/account-actions.ts:37-138` (chain `:53-135`; auth check `:37-50` has no role logic); cascade `prisma/schema.prisma:162`; UI caller `src/components/navigation/ProfileSettingsDialog.tsx:120`.
  - **Fix:** 1) Wrap every write from `:53` through `db.user.delete` (`:135`) in one `db.$transaction(async (tx) => {...})` (mirror `blueprint.ts:42`), keep the bottom-up order, raise timeout to ~30s. 2) After fetching the user, select `role` and count org members; if `orgId && memberCount > 1`, require `role === "OWNER"` (or, preferred, only detach a non-owner: delete just their personal rows + `user.delete`). 3) Surface distinct error states around `ProfileSettingsDialog.tsx:120`.
  - **Verify:** `tsc --noEmit`; force a mid-way error → nothing changed (no orphan org/user); as a non-owner in a 2-user org → org + other user survive; owner behaves per chosen semantics.
  - **Depends on:** none (do both edits together). *(Source: 04; cross-ref index P0 #6)*

- [x] **SEC-8 — Hard-fail `exportUserData` when `orgId` is null** (P0, S, security-idor)
  - **Problem:** When the user has no org, the org-scoped `findMany` calls use `where:{ organizationId: orgId ?? undefined }`; in Prisma `{ organizationId: undefined }` **drops the filter**, matching ALL rows across ALL tenants — a cross-tenant leak in a GDPR-export surface. Latent today only because un-onboarded users are redirected away.
  - **Locations:** `src/app/actions/data-export.ts:61,73,85,88,91,94` (the six `orgId ?? undefined` filters); transcripts/classrooms already branch at `:115-129`.
  - **Fix:** 1) After the org lookup, if `!orgId` return early (or return only user-scoped discipleship/`generatedResources` + empty org section) — never run an org `findMany` with an undefined filter. 2) Change the six filters to plain `organizationId: orgId`. 3) Drop the redundant second `db.user.findUnique` at `:35-40`.
  - **Verify:** Seed a user with `organizationId = null`, call `exportUserData` → returns no other tenant's rows; onboarded user still exports only their org.
  - **Depends on:** none. *(Source: 04; cross-ref index P0 #6)*

- [x] **SEC-9 — Stop `bible-memory/page.tsx` from seeding the UI with a cross-tenant student** (P0, M, security-idor)
  - **Problem:** The page calls `db.student.findFirst()` with **no org/auth scoping**, returning an arbitrary student from ANY org ("Get the first student for demo purposes"), then renders that student's id/name and verses to whoever loads `/family-discipleship/bible-memory`.
  - **Locations:** `src/app/family-discipleship/bible-memory/page.tsx:6-19` (esp. `:9`), `:21-25`.
  - **Fix:** 1) Add an auth gate (`auth()`, redirect `/login` if no session). 2) Derive `organizationId` from `getCurrentUserOrg()`; read `?studentId` (the dashboard appends it), validate it belongs to the caller's org, else fall back to `db.student.findFirst({ where:{ organizationId } })`. 3) Accept `searchParams` in the page signature. 4) Keep the "No Student Found" empty branch.
  - **Verify:** As org A only org A students appear; org B never sees org A's student; logged-out → redirect to `/login`. `tsc --noEmit`.
  - **Depends on:** none. *(Source: 19; cross-ref index P0 #7)*

- [ ] **SEC-10 — Add Postgres RLS policies + a non-superuser app role (close the RLS-theater gap)** (P0/P1, L, security-idor)
  - **Problem:** RLS is *enabled* on every table by the `rls_auto_enable` trigger, but the repo has **zero `CREATE POLICY`** statements and the app connects as the Supabase `postgres` superuser (BYPASSRLS). RLS is a no-op; isolation is 100% application-level `where:{ organizationId }`. Any forgotten filter (see SEC-1…SEC-6) leaks across tenants, and the "RLS enabled" flag falsely reassures.
  - **Locations:** `prisma/migrations/00000000000000_extensions_rls/migration.sql:12-50`; `src/server/db.ts:8-11`; `src/lib/auth-helpers.ts:9-30`.
  - **Fix:** 1) Decide the boundary model with the team. 2) If making RLS real: add a migration creating per-table policies keyed on a session GUC (`current_setting('app.current_org', true)`) for `account_id`/`organization_id`, set the GUC per-request in `db.ts` (Prisma `$extends`/`SET LOCAL`); provision a dedicated **non-BYPASSRLS** role and repoint `DATABASE_URL`, keeping the superuser only for migrations/`DIRECT_DATABASE_URL`. 3) If keeping app-level filtering: add the code-level guardrail (HYG-3) and correct the docs so nobody trusts the enable flag.
  - **Verify:** As the app role, a cross-tenant `SELECT` on `students`/`books` returns 0 rows for another org; `SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user;` is `f`.
  - **Depends on:** boundary-model decision; Supabase role/connection-string config. Pairs with HYG-3. *(Source: 02)*

- [x] **SEC-11 — Stop pattern-escalation from overriding the caregiver hard-stop** (P0, S, child-safety / security)
  - **Problem:** The "Minimum Social Responsibility" invariant says when a caregiver is implicated OR `disclosureRisk === "HIGH"`, **no caregiver is ever notified**. But the escalation gate only excludes `INTERNAL_LOG_ONLY`/`SUPPORTIVE_ONLY` — not a hard-stopped `STUDENT_OPTIONAL_OUTREACH`. So a caregiver-implicated `STUDENT_OPTIONAL_OUTREACH` can be upgraded to `PARENT_SUMMARY_SAFETY_COACH` and emailed to OWNER/PARENT/ADMIN — i.e. to the very caregiver the child fears. A child-safety-critical disclosure leak.
  - **Locations:** `src/inngest/functions/safety-scan.ts:24-64` (gate `:25`, upgrade `:58-62`); `src/lib/safety/policy.ts:14-22`.
  - **Fix:** 1) Compute the hard-stop condition (`result.implicatedCaregiver || result.disclosureRisk === "HIGH"`) and skip the whole escalation block when true — extend the guard at `:25`. 2) Alternatively, have `decideSafetyResolution` tag hard-stop resolutions as non-escalatable. 3) Keep the existing exclusions.
  - **Verify:** Unit test: assessment with `implicatedCaregiver:true, severity:"CONCERN"` + 2 prior same-category flags → final resolution stays `STUDENT_OPTIONAL_OUTREACH` and `sendSafetyAlert` is NOT called.
  - **Depends on:** none. *(Source: 20; cross-ref index P0)*

- [x] **SEC-12 — Scope `reorderBlocks` updates to the verified course (cross-org block IDOR)** (P0, S, security-idor)
  - **Problem:** `reorderBlocks` authenticates and verifies the caller owns `courseId`, but then issues each `db.courseBlock.update({ where:{ id: update.id } })` keyed **only on the client-supplied block id** — never scoped to that `courseId`/`organizationId`. A crafted drag-save payload can therefore reposition or re-parent (`parentBlockId`) **another org's** blocks while passing one of your own courses as `courseId`. The `ReorderSchema` is also **declared but never parsed**, so `position`/`parentBlockId` are unvalidated. This is a genuine cross-tenant write IDOR; per the audit rule (any cross-tenant/IDOR item is P0/Phase 0) it is re-filed here from the former one-line mention inside the P3 HYG-52 Courses grab-bag.
  - **Locations:** `src/app/actions/course-actions.ts:18-57` (ownership check `:30-36`; unscoped per-block `update` `:43-53`; unused `ReorderSchema` `:10-16`).
  - **Fix:** 1) Parse the input: `const safeUpdates = ReorderSchema.parse(updates);` after `getCurrentUserOrg()`. 2) Re-fetch the course's own block ids (`db.courseBlock.findMany({ where:{ courseId }, select:{ id:true } })`) and **reject** (throw) if any `update.id` is not in that set — so you can only reorder blocks that belong to the verified course. 3) Scope every write: `db.courseBlock.updateMany({ where:{ id: update.id, courseId }, data:{ position, parentBlockId } })` (or include `courseId` in the `update` where via a compound check), so a foreign block id matches zero rows. 4) (Defensive) validate each `parentBlockId` is also one of the course's own block ids before assigning.
  - **Verify:** As org A, craft a `reorderBlocks(myCourseId, [{ id: <org B block>, position: 0, parentBlockId: null }])` → org B's block is unchanged (0 rows affected / throws); legitimate same-course drag-reorder still persists. `tsc --noEmit`.
  - **Depends on:** none (mechanical; reuses the `getCurrentUserOrg()` pattern already in the file). *(Source: 10; re-filed from HYG-52)*

---

## Phase 1 — Make half-built features work (or remove)

P1 non-functional / 404 features. Each says BUILD or REMOVE. **Sequencing:** add a missing route
before wiring its form (FEAT-3 → its form); decide the canonical generation engine (FEAT-24) before
investing in either path; build assessment authoring (FEAT-16) before the taking flow (FEAT-17).

- [ ] **FEAT-1 — Repoint or remove the phantom `/dashboard` guard in `proxy.ts`** (P1, M, BUILD-or-REMOVE)
  - **Problem:** `proxy.ts` (and the dead `authorized()` callback) only positively guard `/dashboard`, but **no `/dashboard` route exists** (real home is `/`, student view `/student/dashboard`). The proxy is a no-op for security; any new page that forgets its own `auth()` is silently public.
  - **Locations:** `src/proxy.ts:11-15` (the dead branch), `:18-22` (live `/onboarding` branch); duplicate dead logic `src/auth.config.ts:15-33`.
  - **Decision: BUILD or REMOVE.** Either (a) make the proxy a real guard against the actual protected prefixes (`/`, `/students`, `/courses`, `/planner`, `/transcripts`, `/living-library`, `/grading`, `/creation-station`, `/blueprint`, `/context`, `/thinkling`, `/student/dashboard`), redirecting to `/login`; or (b) keep per-page `auth()` as the sole gate and **delete** the misleading `/dashboard` branch so the file documents reality. Either way add a PR-checklist note that new protected pages still need their own `auth()`.
  - **Verify:** Logged out, hit a protected page by URL → redirected to `/login` (option a) or per-page redirect still fires (option b). `tsc --noEmit`.
  - **Depends on:** HYG-9 (delete the dead `authorized()` callback) — keep consistent. *(Source: 04)*

- [ ] **FEAT-2 — Enforce the instructor PIN gate (or remove the field)** (P1, L, BUILD-or-REMOVE)
  - **Problem:** The PIN is validated, bcrypt-hashed, and stored, but **nothing ever verifies it** — no `bcrypt.compare`/`verifyPin` anywhere. The advertised PIN-lock / switch-to-instructor-mode feature does not exist on the read side; the privacy page claims PINs are hashed (true) but implies a feature that is absent.
  - **Locations:** hash/write `src/server/actions/blueprint.ts:39,123`; schema `prisma/schema.prisma:253`; regex `src/lib/schemas/onboarding.ts:19`; UI `src/components/onboarding/classroom-step.tsx:237-252`; privacy claim `src/app/privacy/page.tsx:258`.
  - **Decision: BUILD or REMOVE.** BUILD: add `verifyInstructorPin(classroomId, pin)` (loads caller org via `getCurrentUserOrg`, fetches the org-scoped `ClassroomInstructor`, returns `bcrypt.compare` — never returns the hash) + a client "switch to instructor mode" gate that flips a short-lived server-validated flag. REMOVE: drop PIN capture from `classroom-step.tsx`, the schema/onboarding field, migrate out `instructor_pin`, and remove the privacy claim (and HYG-12 becomes moot).
  - **Verify:** Correct PIN unlocks instructor mode, wrong rejected; or onboarding completes with the field removed. `tsc --noEmit`.
  - **Depends on:** product decision; interacts with HYG-12 (PIN-hash export). *(Source: 04)*

- [ ] **FEAT-3 — Build the missing Activity creation endpoint** (P1, M, BUILD)
  - **Problem:** The "Add Activity" form POSTs to `/api/courses/{id}/blocks/{blockId}/activities`, but **that route does not exist**, so every submission `alert("Failed to create activity")`. Activity creation — a core authoring feature — is non-functional; the form comment admits the endpoint was never confirmed.
  - **Locations:** `src/app/courses/[id]/blocks/[blockId]/activities/new/page.tsx:86-98` (POST target), `.../page.tsx:447-449` (link), `src/app/api/courses/[id]/blocks/[blockId]/` (only `route.ts` exists).
  - **Fix:** 1) Create `.../activities/route.ts` with a `POST` mirroring the sibling auth/tenancy pattern (`route.ts:99-114`: `auth()`→401, `getCurrentUserOrg()`, verify `course.organizationId` and `block.courseId === courseId`). 2) Add `activitySchema` to `src/lib/schemas/courses.ts` (title required; `activityType` enum; `description?`; `estimatedMinutes?`; `objectiveId?`). 3) Compute next `position`, `db.activity.create`, and create the `ActivityObjective` join when `objectiveId` is present (resolve the `new:` sentinel — implement or remove). 4) `revalidatePath` the block page.
  - **Verify:** Add an activity on a LESSON block → 200 and it appears in the block's activities list. `tsc --noEmit`.
  - **Depends on:** none (add `activitySchema` as part of the work). *(Source: 10; cross-ref index P1)*

- [ ] **FEAT-4 — Pass the real `organizationId` to `ResourcePicker`** (P1, S, BUILD)
  - **Problem:** `CourseBuilder` renders `<ResourcePicker organizationId={courseId} ...>` — a courseId where an orgId is expected. It flows into `getLibraryResources(organizationId)`, so every library tab returns nothing and "Add Resource" is effectively broken. The correct `organizationId` is already a prop in scope.
  - **Locations:** `src/components/courses/CourseBuilder.tsx:683` (the bug), `:387` (real prop); `src/app/actions/resource-library-actions.ts:14-35`.
  - **Fix:** Change `organizationId={courseId}` → `organizationId={organizationId}`; confirm `courses/[id]/builder/page.tsx` passes `organizationId`; grep for other `ResourcePicker` callers repeating the mistake.
  - **Verify:** Add a book/video, open the picker on a block → the tab lists the org's resources; attach writes the FK. `tsc --noEmit`.
  - **Depends on:** none. *(Source: 10; cross-ref index P1 `ResourcePicker` mis-scoping)*

- [ ] **FEAT-5 — Fix multi-instructor onboarding save (unique-constraint crash)** (P1, M, BUILD)
  - **Problem:** `saveClassroomStep` creates every instructor with `userId: index === 0 ? userId : userId` (always the same id); `ClassroomInstructor` has `@@unique([classroomId, userId])`, so adding a 2nd instructor throws inside the `$transaction` and rolls back the entire Step 1 save. The UI offers "Add Instructor", so any family with a co-instructor cannot complete onboarding.
  - **Locations:** `src/server/actions/blueprint.ts:113-128` (ternary `:118`); schema `prisma/schema.prisma:245-262` (unique `:260`, `userId` non-null `:248`); UI `src/components/onboarding/classroom-step.tsx:67-72`.
  - **Fix:** 1) Make `ClassroomInstructor.userId` nullable (`schema.prisma:248,258`) + migration so co-instructors without accounts can exist. 2) Set `userId: index === 0 ? userId : null`; keep `role: index === 0 ? "PRIMARY" : "ASSISTANT"`. 3) Regenerate the client.
  - **Verify:** Onboard with 2+ instructors → Step 1 saves; one PRIMARY (user_id set) + N ASSISTANT (user_id null). `tsc --noEmit`. Add a regression test.
  - **Depends on:** DB migration; coordinate with anything joining `ClassroomInstructor.user` non-optionally; pairs with FEAT-22 (PIN re-entry, same code block). *(Source: 13; cross-ref index P1)*

- [ ] **FEAT-6 — Wire the real FileUpload into Quick Create (FILE source unreachable)** (P1, M, BUILD)
  - **Problem:** The FILE tab renders `<p>File upload coming soon...</p>` instead of the imported-but-unrendered `FileUpload`, so `fileContent` is never populated, `handleGenerate` rejects "Please upload a file", and the button never enables. FILE generation is dead from the UI even though the core has a working FILE branch.
  - **Locations:** `src/app/creation-station/GeneratorsClient.tsx:308-313` (placeholder), `:18,58-59,110-118,145,395`; `src/components/generators/SimpleInputs.tsx:29-44`.
  - **Fix:** 1) Replace the placeholder with `<FileUpload onFileSelect={setFile} />`. 2) Confirm the FileReader effect populates `fileContent`; note `readAsText` only works for txt/md — drop `.pdf` from `accept` or add PDF extraction. 3) Verify `handleGenerate` forwards `fileContent`/`fileName` into the core FILE branch (`generate-resource-core.ts:143-147`).
  - **Verify:** `tsc`; pick FILE, upload `.txt`, generate → a `Resource` opens at `/living-library/resource/<id>` reflecting the content.
  - **Depends on:** none (PDF extraction optional). *(Source: 08)*

- [ ] **FEAT-7 — Make YOUTUBE_PLAYLIST a complete source path (guard + template filter)** (P1, M, BUILD)
  - **Problem:** A `YOUTUBE_PLAYLIST` tab, `YouTubeImport`, and a core branch exist, but `hasSource` and the template-filter logic never account for `YOUTUBE_PLAYLIST`, so after import the guard treats the source as incomplete. The "deep vision" tier only prompt-instructs the model to "watch/search" with no grounding tool, so output is unverifiable.
  - **Locations:** `src/app/creation-station/GeneratorsClient.tsx:194-200,122-137,183-192`; `src/app/actions/generate-resource-core.ts:148-175,152-161`.
  - **Fix:** 1) Add `(sourceType === "YOUTUBE_PLAYLIST" && (url || sourceId))` to `hasSource` and the button `disabled` guard. 2) Decide template filtering (likely leave all). 3) For real grounding, attach a Google search-retrieval/URL-context tool in the DEEP_VISION branch, or downgrade the UX/copy to admit metadata-only; remove the stale "in a real production app" comments.
  - **Verify:** `tsc`; import a playlist → Generate enables and a `Resource` is produced.
  - **Depends on:** guard/filter is S; grounding sub-task depends on AI SDK Google grounding. *(Source: 08)*

- [ ] **FEAT-8 — Add an interactive renderer for JSON (quiz/worksheet) resources** (P1, M, BUILD)
  - **Problem:** The resource detail view renders any non-MARKDOWN content as `JSON.stringify(...)` in a `<pre>`. Every QUIZ/WORKSHEET shows as a raw JSON blob — the structured-output feature has no presentation layer.
  - **Locations:** `src/app/living-library/resource/[id]/page.tsx:55-68`.
  - **Fix:** 1) Branch on `resourceKind.contentType`/`storageType==="JSON"`. 2) Render `QuizView`/`WorksheetView` client components driven by the canonical `QuizSchema`/`WorksheetSchema` (parse content, fall back to `<pre>` on failure). 3) Reuse the inline card markup from `generate-tool.tsx:146-173,221-235`.
  - **Verify:** `tsc`; open a generated quiz and worksheet → formatted interactive view.
  - **Depends on:** BUG-2 (unify the divergent quiz/worksheet schemas — renderer needs one shape). *(Source: 08)*

- [ ] **FEAT-9 — Add live bundle-status polling instead of `window.location.reload()`** (P1, M, BUILD)
  - **Problem:** After a compile is enqueued the UI does a hard reload and never subscribes to bundle status; a long `COMPILING` bundle only updates on manual reload, and `BundleView` shows an indefinite "Generating artifacts..." spinner. The headline feature feels hung.
  - **Locations:** `src/app/creation-station/CreationStationClient.tsx:41-61` (`:53`); `src/app/creation-station/compiler/BundleView.tsx:86-90`; `src/app/creation-station/page.tsx:18-28`.
  - **Fix:** 1) Add an org-scoped `getBundleStatuses(bundleIds)` server action. 2) In `CreationStationClient`, when any bundle is `COMPILING`, `setInterval` (~4s) merging results into state; stop when none are `COMPILING`; remove the reload and push the new id optimistically.
  - **Verify:** Compile a bundle; card transitions COMPILING → Ready/Failed without reload; polling stops once terminal.
  - **Depends on:** none (coordinate the shared `Bundle` type with HYG-23). *(Source: 09)*

- [ ] **FEAT-10 — Remove or build the book "Deep Extraction" / summary pipeline** (P1, S-remove / L-build, BUILD-or-REMOVE)
  - **Problem:** Books are created `NOT_EXTRACTED` and nothing ever sets `Book.summary`/`tableOfContents` or advances `extractionStatus`, yet the detail page renders an "Inkling-Generated Summary" block, an "Extraction Status" card, and `BookScanner` shows a "Deep Extraction (Alpha)" promo for ToC upload that does not exist — dead/misleading UI.
  - **Locations:** `src/app/living-library/[id]/page.tsx:153-162,243-273`; `src/components/library/BookScanner.tsx:328-331`; create `src/app/api/library/books/route.ts:87`.
  - **Decision: REMOVE (recommended near-term)** the Deep-Extraction promo and relabel/remove the permanently-`NOT_EXTRACTED` status card; **or BUILD** an Inngest extraction worker that fills `summary`/`tableOfContents`, advances `EXTRACTING→EXTRACTED`, stamps `extractedAt`, and re-embeds.
  - **Verify:** Removed → no UI references an unpopulated field. Built → adding a book transitions to `EXTRACTED` with a real summary.
  - **Depends on:** none. *(Source: 15; cross-ref index P1 book deep-extraction)*

- [ ] **FEAT-11 — Wire up (or remove) the semantic book search UI** (P1, M-wire / S-remove, BUILD-or-REMOVE)
  - **Problem:** `GET /api/library/search?q=` is implemented and org-scopes results, but **no UI calls it** (zero callers). The changelog advertises "semantic search" as shipped; users have no input to invoke it.
  - **Locations:** `src/app/api/library/search/route.ts:9-70` (functional, unreferenced).
  - **Decision: BUILD or REMOVE.** BUILD: add a search input on the Books tab (`BookList`/`LibraryClient`) that GETs the route and renders org-scoped results. REMOVE: delete the route (then see HYG-44 `searchVideos`).
  - **Verify:** A query returns ranked org-scoped results; or the route is gone and `searchBooks`'s caller is removed.
  - **Depends on:** none. *(Source: 15; cross-ref index P1 semantic search)*

- [ ] **FEAT-12 — Fix dead login redirects to the non-existent `/auth/login` route** (P1, S, BUILD)
  - **Problem:** Two surfaces redirect unauthenticated visitors to `/auth/login`, which **does not exist** (only `src/app/login/page.tsx`). Users hit a 404 instead of the login page. Most of the app correctly uses `/login`.
  - **Locations:** `src/app/living-library/page.tsx:15` (`redirect("/auth/login")`); `src/app/family-discipleship/prayer/page.tsx:11` (`redirect("/auth/login")`).
  - **Fix:** Change both to `/login` (the prayer one to `/login?callbackUrl=/family-discipleship/prayer`, matching heart-check). Grep the repo for any other `"/auth/login"` usages.
  - **Verify:** Logged out, hit `/living-library` and `/family-discipleship/prayer` → land on `/login` (200), not 404.
  - **Depends on:** none. *(Source: 15, 19; cross-ref index P2 prayer redirect)*

- [ ] **FEAT-13 — Wire or remove the `groupWork` / `visualAid` compiler constraints** (P1, S, BUILD-or-REMOVE)
  - **Problem:** The spec's `constraints` object has four booleans but only `noDevices`/`lowPrep` have checkboxes; `groupWork`/`visualAid` are submitted at fixed defaults with no UI, yet flow verbatim into every generation prompt and the manifest — a silent un-editable behavior.
  - **Locations:** `src/app/creation-station/compiler/SpecForm.tsx:27-32,53-58,139-178`.
  - **Decision: BUILD or REMOVE.** BUILD: add two `FormField` checkboxes mirroring the existing two. REMOVE: drop them from the schema/defaults and stop emitting them. Confirm the prompt builders (`compile-curriculum.ts:97,129,160,190,221`) reflect only real values.
  - **Verify:** Toggle each constraint; persisted `CurriculumSpec.constraints` and a generated artifact's prompt/manifest match the UI.
  - **Depends on:** SEC-6 (shared schema) — do that first so the shape is defined once. *(Source: 09)*

- [ ] **FEAT-14 — Wire or remove the planner "Auto-Reschedule" dead button** (P1, S-remove / L-build, BUILD-or-REMOVE)
  - **Problem:** `<Button>Auto-Reschedule</Button>` has no `onClick`, no `Link`, and no backing action anywhere — a prominent primary button that does nothing.
  - **Locations:** `src/app/planner/page.tsx:57`; related dead field `prisma/schema.prisma:1316` (`isLocked`).
  - **Decision: REMOVE** (delete the button) **or BUILD** a `rescheduleWeek` action that re-runs `getNextSchoolDays` over the week's `PENDING` items, skipping `isLocked`, then `revalidateTag` (RSC page → move the button into a small client wrapper).
  - **Verify:** Removed → button gone, lint/tsc pass. Built → clicking re-dates unlocked items and respects `isLocked`.
  - **Depends on:** product decision; if building, depends on BUG-9 (read `schoolDaysOfWeek`). *(Source: 11)*

- [ ] **FEAT-15 — Wire or remove the hard-coded "Daily Liturgy" dashboard card** (P1, M, BUILD-or-REMOVE)
  - **Problem:** The parent dashboard's "Daily Liturgy" card always renders the same static "Psalm 23" stub regardless of data, looking like a live "today's discipleship focus" — a misleading non-functional feature on the most-visited authenticated surface.
  - **Locations:** `src/components/dashboard/ParentDashboard.tsx:46-64`.
  - **Decision: BUILD or REMOVE.** BUILD: fetch the org's current devotional in `getParentDashboardData`, thread a `dailyLiturgy` prop, render real `reference`/`excerpt` and point "Start" at the item, with an empty state. REMOVE: delete the card section and collapse the grid.
  - **Verify:** Two orgs with different/zero devotional data show real data or the card is hidden. `tsc --noEmit`.
  - **Depends on:** family-discipleship devotional/liturgy data model; product decision. *(Source: 14)*

- [ ] **FEAT-16 — Build assessment authoring (create `Assessment` / `AssessmentItem`)** (P1, L, BUILD)
  - **Problem:** **No code anywhere creates `Assessment` or `AssessmentItem` rows.** The `/grading` assessment `<select>` is empty on a real DB, and `NewAttemptForm` points users at a course Assessments page that does not exist. The grading product cannot be populated through the app — the headline gap.
  - **Locations:** `src/components/grading/NewAttemptForm.tsx:20-28`; models `prisma/schema.prisma:590-628`; empty source `src/app/grading/page.tsx:33-37`.
  - **Fix:** 1) Add `createAssessment(courseId, {...items[]})` (org-guard via `course.organizationId`, mirror `assessment-actions.ts:20-29`). 2) Transactional `db.assessment.create` with nested `items.create`. 3) Authoring UI under `src/app/courses/[id]/assessments/`; set `createdByUserId` from session. 4) Repoint the `NewAttemptForm` empty-state copy. 5) Decide `totalPoints` vs sum(item.points) (see BUG-23).
  - **Verify:** Create an assessment via the new UI → row exists; reload `/grading` → it appears in the select; end-to-end create + grade an attempt.
  - **Depends on:** coordinates with BUG-23 (max points); pairs with FEAT-17. *(Source: 16; cross-ref index P1 grading)*

- [ ] **FEAT-17 — Capture real student responses (assessment-taking flow)** (P1, L, BUILD)
  - **Problem:** `createAssessmentAttempt` seeds every `AssessmentItemResponse` with `responseData: {}`, and the grading UI renders `JSON.stringify(responseData)` (literal `{}`). The schema supports real responses but **no capture UI exists**; the taking flow is unbuilt.
  - **Locations:** `src/app/actions/assessment-actions.ts:7-14,44-50`; render `src/components/grading/GradingInterface.tsx:151-161`; model `prisma/schema.prisma:875-893`.
  - **Fix:** 1) Define a `responseData` JSON contract per `AssessmentItemType`. 2) Build a student-facing take route (e.g. `src/app/students/[id]/take/[assessmentId]`) creating an `IN_PROGRESS` attempt, rendering inputs by item type, writing `responseData`, transitioning to `SUBMITTED`. 3) Render typed responses in `GradingInterface`. 4) Keep `createAssessmentAttempt` as a teacher "record paper submission" shortcut.
  - **Verify:** Student completes a take flow → `responseData` holds real answers; grading screen shows them readably.
  - **Depends on:** FEAT-16 (needs assessments/items to take). *(Source: 16; cross-ref index P1 grading)*

- [ ] **FEAT-18 — Add `/grading` to primary navigation** (P1, S, BUILD)
  - **Problem:** `/grading` is not linked from any nav/sidebar/header — reachable only by typing the URL, so the feature is effectively hidden.
  - **Locations:** navigation components (no `/grading` reference); self-link `src/app/grading/[id]/page.tsx:87`.
  - **Fix:** Add a "Grading" link to `/grading` (with an icon, gated to authed org users) in the primary nav/sidebar; mark active state.
  - **Verify:** Signed-in, a Grading entry appears and routes to `/grading`.
  - **Depends on:** none (low value until FEAT-16 exists). *(Source: 16)*

- [ ] **FEAT-19 — Restore per-student context lost by `DiscipleshipDashboard` tiles** (P1, M, BUILD)
  - **Problem:** Per-student tiles link to `/family-discipleship/<tool>?studentId=…` (GLOBAL routes), but the child pages never read `?studentId`. Opening Catechism from a student's discipleship dashboard renders with no `studentId` and **tracks no progress** — contradicting the "Student View" header. Only `/students/[id]/family-discipleship/catechism` actually tracks.
  - **Locations:** `src/components/family-discipleship/DiscipleshipDashboard.tsx:20-22,28-87,95`; ignored param `src/app/family-discipleship/catechism/page.tsx:5-14`.
  - **Fix:** 1) For per-student-capable tools, point tiles at the real per-student routes (`/students/${studentId}/family-discipleship/catechism`). 2) For tools without a per-student route (devotionals, bible-study), either build the `/students/[id]/...` route forwarding `studentId`, or make the global pages read `searchParams.studentId` (with `assertStudentInOrg`). 3) Audit all 9 tiles; only append `?studentId` to tiles whose target consumes it. 4) Stop tiles falsely implying per-student tracking.
  - **Verify:** From `/students/[id]/family-discipleship`, Catechism lands on a route that mounts `InteractiveCatechism` with `studentId`; a correct answer fires/persists `markQuestionAsMastered`; progress reloads.
  - **Depends on:** pairs with SEC-related FEAT-20 (per-student auth). *(Source: 18)*

- [ ] **FEAT-20 — Add page/layout auth+org guards to `/students/[id]/family-discipleship/*`** (P1, M, BUILD)
  - **Problem:** Both per-student pages `await params` and render with **no `auth()` and no org check**; there is no `src/middleware.ts` and no layout under `src/app/students/`. So these routes render the shell for any visitor (incl. unauthenticated); data is protected only because `student-catechism.ts` actions throw. Net: cross-org users see the shell and get runtime errors instead of a clean redirect/403.
  - **Locations:** `src/app/students/[id]/family-discipleship/page.tsx:4-16`, `.../catechism/page.tsx:5-22` (no guard); enforcement only in `src/app/actions/student-catechism.ts:9-13`.
  - **Fix:** 1) Add server guards to both pages (`getCurrentUserOrg()`, verify the `[id]` student belongs to the org; redirect/`notFound()` otherwise). 2) Prefer a shared `src/app/students/[id]/layout.tsx` doing the check once. 3) Extract `assertStudentInOrg` into a reusable helper. 4) (Optional) add `src/middleware.ts` for `/students/*`.
  - **Verify:** Anon → redirect to login; org-A user on an org-B student → 404/403 (no shell); owning org renders and tracks.
  - **Depends on:** none (pairs with FEAT-19). *(Source: 18)*

- [ ] **FEAT-21 — Build a caregiver-facing SafetyFlag review/resolution surface** (P1, L, BUILD)
  - **Problem:** `SafetyFlag` rows are written but **no page/query reads them** — email is the only output and it's gated to two `PARENT_SUMMARY_*` resolutions. `isResolved`/`resolvedAt`/`resolution` are set once at creation and never updated; there is no resolution workflow, and lower-severity concerns are invisible to caregivers.
  - **Locations:** writes only `src/inngest/functions/safety-scan.ts:70-82`; no reader; tenancy via `SafetyFlag.student.organizationId` (`prisma/schema.prisma:317-334`).
  - **Fix:** 1) Add an org-scoped query joining through `student.organizationId`. 2) Add a caregiver/admin-only page (role-gate to match the email recipient policy) listing flags (strip `[EVIDENCE:...]` like the email) with a "Mark resolved" action setting `isResolved`/`resolvedAt`. 3) Wire it into nav. 4) Decide whether TEACHER sees flags.
  - **Verify:** A triggered flag renders only for its org; resolving persists; another org cannot see it.
  - **Depends on:** none. *(Source: 20)*

- [ ] **FEAT-22 — Stop forcing PIN re-entry on every classroom edit** (P1, M, BUILD)
  - **Problem:** `instructorPin` defaults to `""` and is `.regex(/^\d{4}$/)`-required, so editing classroom info later (via `/blueprint` → `?step=1`) forces re-typing the PIN or the save fails. `saveClassroomStep` also `deleteMany`s + recreates all instructors every save, re-hashing the PIN, so a blank PIN can't mean "keep existing".
  - **Locations:** default `src/components/onboarding/classroom-step.tsx:56`; schema `src/lib/schemas/onboarding.ts:19`; hash + delete/recreate `src/server/actions/blueprint.ts:39,108-128`.
  - **Fix:** 1) Make the PIN optional-on-edit (allow empty when an instructor exists, or a separate "change PIN" schema). 2) When blank and instructors exist, preserve the existing hash instead of re-hashing. 3) Indicate in the UI that blank keeps the current PIN.
  - **Verify:** Edit classroom info with a blank PIN → save succeeds and the old PIN still authenticates.
  - **Depends on:** touches the same delete/recreate block as FEAT-5 (do together). Moot if FEAT-2 removes the PIN. *(Source: 13)*

- [ ] **FEAT-23 — Reconcile the onboarding wizard step model with `getBlueprintProgress`** (P1, M, BUILD)
  - **Problem:** The wizard ships 3 steps, but `getBlueprintProgress` returns `step: hasSchedule ? 3 : 2` where `hasSchedule` = "start & end dates exist" — and those are ALWAYS set by placeholders on classroom create. So after Step 1 progress always reports `3` ("done"), and a stale comment says "we only have 2 steps". Separately `OnboardingWizard` ignores its `initialStep` prop (URL `?step` drives everything), so the computed resume step has no effect.
  - **Locations:** `src/server/actions/blueprint.ts:99-100,301-309`; `src/components/onboarding/onboarding-wizard.tsx:24-31`; `src/app/onboarding/page.tsx:15-19`.
  - **Fix:** 1) Make `hasSchedule` meaningful (distinguish placeholder dates from real Step-2 data, or add a `scheduleCompleted Boolean` column). 2) Return `step` as the first incomplete step. 3) Wire `initialStep` into the wizard (seed `?step` from `initialStep` when the URL has none; keep explicit deep-links authoritative). 4) Update stale comments (HYG-29).
  - **Verify:** Fresh user → step 1; classroom-only → step 2; schedule done → step 3/done; deep-links still honored. `tsc --noEmit`.
  - **Depends on:** cleanest version needs a `scheduleCompleted` column (migration); pairs with FEAT-? Environment-rehydrate (BUG-25). *(Source: 13)*

- [ ] **FEAT-24 — Decide & consolidate the two parallel generation engines** (P1, L, BUILD-or-REMOVE)
  - **Problem:** Flow A (`generateResourceCore`) and Flow B (`generateLearningTool`/`streamUI` in `generate-tool.tsx`) duplicate the entire prompt-building, model-selection, and persistence stack with incompatible quiz/worksheet schemas — the root cause of BUG-2 (schema divergence), BUG-3 (silent-fail persistence), and FEAT-8 (no JSON renderer). Flow B also only saves inside the quiz/worksheet tools (markdown is never persisted) and swallows save errors.
  - **Locations:** `src/app/actions/generate-resource-core.ts` (Flow A); `src/app/actions/generate-tool.tsx` (Flow B); callers `GeneratorForm.tsx:55-68`, `SmartDefaultsSuggestions.tsx`, `courses/[id]/builder/page.tsx:292`.
  - **Decision:** Pick a canonical engine (Flow A is also the Compiler primitive — it should win). Route `GeneratorForm`/course-builder links through `generateResourceCore` (add streaming if needed) and delete Flow B's duplicate persistence; OR keep both but at minimum share the Zod schemas and persistence helper. Record the decision in the codebase-map doc.
  - **Verify:** One persistence path produces one shape from both entry points. `tsc --noEmit`.
  - **Depends on:** BUG-2; BUG-3. *(Source: 08; subsumes the doc-05 "two engines" note)*

- [ ] **FEAT-25 — Repoint the `ResourceList` filter submit from the nonexistent `/library` to `/living-library`** (P1, S, BUILD)
  - **Problem:** The generated-resource filter form pushes `router.push(\`/library?${params}\`)`, but **no `/library` route exists** — the real hub is `/living-library`. Applying any student/course/book/tool-type filter on the Resources tab navigates to a 404, so resource filtering is completely broken. (Distinct from FEAT-12, which only repoints the two `/auth/login` redirects.)
  - **Locations:** `src/components/library/ResourceList.tsx:41` (the `router.push(\`/library?...\`)`); hub already reads the params at `src/app/living-library/page.tsx:44-47`.
  - **Fix:** 1) Change the target to `router.push(\`/living-library?${params.toString()}\`)`. 2) Confirm the hub `page.tsx` reads `studentId`/`courseId`/`bookId`/`toolType` from `searchParams` (it does) so the round-trip filters server-side. 3) Grep for any other `"/library"` push/redirect/`<Link>` targets and repoint them.
  - **Verify:** On the Resources tab, set a filter and submit → URL becomes `/living-library?...&tab=resources` (200) and the list narrows; no 404. `tsc --noEmit`.
  - **Depends on:** none. *(Source: 15; cross-ref index P1)*

- [ ] **FEAT-26 — Verify/configure the Resend sender domain so caregiver safety emails actually deliver** (P1, S, infra-ci / child-safety)
  - **Problem:** **The single biggest safety-delivery risk.** `sendSafetyAlert` only flips `SafetyFlag.alertSent = true` after Resend confirms delivery. `from` falls back to Resend's test sender `onboarding@resend.dev` when `SAFETY_ALERT_FROM` is unset (delivers ONLY to the Resend account owner). `.env:55` does set `SAFETY_ALERT_FROM="Quill & Compass Safety <safety@quillandcompass.app>"`, but **if the `quillandcompass.app` domain is not verified in the Resend dashboard, `resend.emails.send` returns an error and `alertSent` stays `false`** — i.e. a detected self-harm/abuse concern produces NO delivered caregiver alert, silently. This is an env/ops/deliverability item, not just the cosmetic docstring-TLD fix folded into HYG-37.
  - **Locations:** `src/lib/notifications/safety-alert.ts:108-148` (sender fallback `:113`, error→`sent:false` path `:141-144`, the `alertSent` update `:147`); env `.env:55` (`SAFETY_ALERT_FROM`), `:53` (`RESEND_API_KEY`); same-TLD docstring at `safety-alert.ts:22` (HYG-37 fixes the comment).
  - **Fix:** 1) In the Resend dashboard, verify the `quillandcompass.app` domain (SPF/DKIM/DMARC) and confirm `safety@quillandcompass.app` is an allowed sender. 2) Ensure **prod** actually sets `SAFETY_ALERT_FROM` and `RESEND_API_KEY` in Vercel (don't rely on the `.env` dotfile). 3) Add a smoke-test/health check that calls `resend.emails.send` to a known inbox and asserts no error. 4) Add a fallback alerting channel (Slack/webhook/pager) triggered when `sendSafetyAlert` returns `sent === false`, so an undeliverable safety alert is never silent.
  - **Verify:** Send to a real external address from a non-owner account → confirm receipt and that the corresponding `SafetyFlag.alertSent` flips to `true`; `grep` prod env for both vars. With an unverified domain, confirm the failure now also reaches the fallback channel (not just `console.error`).
  - **Depends on:** Resend account + DNS access; pairs with HYG-37 (docstring TLD). *(Source: 20)*

---

## Phase 2 — Correctness bugs (P2)

- [ ] **BUG-1 — Truthful `/api/health` provider label** (P2, S)
  - **Problem:** `/api/health` hard-codes `provider: "accelerate"`, but the runtime uses the `pg` driver adapter (`PrismaPg`), not Accelerate — actively misleading on-call during an incident.
  - **Locations:** `src/app/api/health/route.ts:24`; contradicted by `src/server/db.ts:8-11`.
  - **Fix:** Change to a truthful label, e.g. `provider: "pg-adapter"` (or derive from a constant so it can't drift).
  - **Verify:** `curl /api/health` returns the new value; `tsc --noEmit`.
  - **Depends on:** none. *(Source: 01, 03 — merged)*

- [ ] **BUG-2 — Unify the two divergent quiz/worksheet JSON schemas** (P2, M)
  - **Problem:** Two engines write `storageType:"JSON"` `Resource.content` with incompatible shapes (`schemas.ts` `questions[]` with `id/type/points`, `sections[].items[]`; vs inline `generate-tool.tsx` `questions[]` with `question/options/correctAnswer`, `problems[]`). The same `ResourceContentType` can hold two structurally different blobs, breaking any single renderer.
  - **Locations:** canonical `src/lib/ai/schemas.ts:7-50`; inline `src/app/actions/generate-tool.tsx:98-108,178-187` (persist `:121-137,199-215`); separate `VideoContentSchema` `src/lib/ai/video-processing.ts:37-43`.
  - **Fix:** Pick `schemas.ts` as the single source; in `generate-tool.tsx` import `QuizSchema`/`WorksheetSchema` for its `inputSchema`s (or add a documented shared "lite" schema); update the JSX renderers to the canonical field names. Leave `VideoContentSchema` (different domain).
  - **Verify:** `tsc`; generate a quiz/worksheet via both paths → persisted `content` validates against the canonical schema and renders in the same component.
  - **Depends on:** none (unblocks FEAT-8, FEAT-24). *(Source: 05, 08 — merged)*

- [ ] **BUG-3 — Stop the streaming engine silently swallowing save failures / never persisting markdown** (P2, M)
  - **Problem:** `generate-tool.tsx` saves a `Resource` only inside the quiz/worksheet tools and only when `resourceKindId` is present; save errors are caught and `console.error`'d, so a "successful" generation can persist nothing. Markdown/plain-text streamed outputs are never saved at all, so most `/creation-station/[id]` generations are ephemeral and silently lost.
  - **Locations:** `src/app/actions/generate-tool.tsx:119-142` (swallowed catch `:138-141`), `:197-219` (`:216-218`), `:87-94` (text stream never persists).
  - **Fix:** Per the FEAT-24 decision: if Flow B is canonical, persist markdown (collect streamed text and `db.resource.create` a MARKDOWN resource after `streamUI` resolves) and replace swallowed catches with a surfaced error state; if deprecated, route through `generateResourceCore` and delete the duplicate persistence.
  - **Verify:** `tsc`; a forced DB error reflects a failure in the UI; a markdown tool output now persists a row.
  - **Depends on:** FEAT-24 decision (Flow A vs B). *(Source: 08)*

- [ ] **BUG-4 — Quick-Create core never writes `generatedForStudentId` lineage** (P2, S)
  - **Problem:** `generateResourceCore` loads the `Student` for prompt context but never sets `generatedForStudentId` on the created `Resource` (unlike `generate-tool.tsx`), so Quick-Create resources tied to a student lose lineage and won't surface under the Living Library student filter.
  - **Locations:** `src/app/actions/generate-resource-core.ts:61-66,244-257`; contrast `generate-tool.tsx:130,208`; consumer `src/app/living-library/page.tsx:44`.
  - **Fix:** Add `generatedForStudentId: additionalData?.studentId || null` to the create data block; optionally persist COURSE/TOPIC/URL/FILE/PLAYLIST lineage that currently lives only in `generationContext`.
  - **Verify:** `tsc`; generate with a `studentId` → row has it set and appears under the student filter.
  - **Depends on:** none. *(Source: 08)*

- [ ] **BUG-5 — URL source does not fetch the page (ungrounded output)** (P2, M)
  - **Problem:** The URL branch embeds the URL string in the prompt with a note that "AI will attempt to access knowledge about this URL"; no scrape/fetch happens, so output is unverifiable/likely hallucinated. The UI claims "Original content will be fetched and synthesized" — over-promising.
  - **Locations:** `src/app/actions/generate-resource-core.ts:137-142`; false copy `src/components/generators/SimpleInputs.tsx:20`; contrast `addArticle` cheerio scrape in `resource-library-actions.ts`.
  - **Fix:** Fetch + extract the page server-side (reuse `addArticle`'s cheerio approach), set `context` to the extracted text; handle fetch failure with a clear error; if deferred, fix the `UrlInput` copy. **Apply the SEC-? SSRF guard (BUG-12) before fetching.**
  - **Verify:** `tsc`; generate from a known article URL → output reflects the article's actual content.
  - **Depends on:** BUG-12 (SSRF guard) should land with this. *(Source: 08)*

- [ ] **BUG-6 — Re-enable the image-tool multi-step loop (`generate_image` cannot complete)** (P2, M)
  - **Problem:** In the markdown `generateText` branch the `generate_image` tool is given but `maxSteps` is commented out "due to type definition mismatch", so a tool call's result is not fed back for a follow-up generation — the image tool is unreliable/non-functional.
  - **Locations:** `src/app/actions/generate-resource-core.ts:218-238` (`:237`).
  - **Fix:** Replace `maxSteps` with `stopWhen: stepCountIs(3)` (import `stepCountIs` from `ai`); remove the `as any` cast on `tool({...})` and fix the underlying type mismatch; confirm the tool result is interpolated into the final text.
  - **Verify:** `tsc`; generate a markdown resource whose prompt asks for a diagram → an embedded image renders.
  - **Depends on:** best done with HYG-19 (image blob storage). *(Source: 08)*

- [ ] **BUG-7 — `distributeCourse` never busts the planner cache** (P2, S)
  - **Problem:** `getWeeklySchedule` is cached under tag `schedule-${org}` with a 1h fallback, but `distributeCourse` writes via `createMany` and returns with **no `revalidateTag`**, and its caller doesn't `router.refresh()`. A freshly distributed course doesn't appear on `/planner` until the 1h TTL or another mutation busts the tag — the core "schedule → see it" flow is broken.
  - **Locations:** `src/server/actions/scheduling.ts:130-137,194-197`; `src/components/courses/CourseDistributor.tsx:41-44`.
  - **Fix:** After the `createMany` succeeds, call `revalidateTag(\`schedule-${course.organizationId}\`)` (already imported at `:5`); optionally `router.refresh()` in `CourseDistributor`. Match the exact tag string.
  - **Verify:** Distribute a course; reload `/planner` for that week → items render immediately (not after 1h). `tsc --noEmit`.
  - **Depends on:** none. *(Source: 11; cross-ref index P2)*

- [ ] **BUG-8 — `getNextSchoolDays` hardcodes Mon–Fri, ignoring `classroom.schoolDaysOfWeek`** (P2, S)
  - **Problem:** It sets `const schoolDaysOfWeek = [1,2,3,4,5]` instead of reading the classroom's persisted config, so a 4-day / Sun–Thu / year-round family gets lessons on the wrong days. `isSchoolDay` already accepts the param — the value just isn't sourced.
  - **Locations:** `src/server/actions/scheduling.ts:50,54`; source `prisma/schema.prisma:225` (written by `blueprint.ts:193`).
  - **Fix:** Replace the literal with `((classroom.schoolDaysOfWeek as number[]) ?? []).length ? (classroom.schoolDaysOfWeek as number[]) : [1,2,3,4,5]` (Mon–Fri only as empty-config fallback); confirm the column is selected; keep the runaway guard.
  - **Verify:** Classroom `schoolDaysOfWeek=[1,3,5]`, distribute 6 lessons → dates fall only on Mon/Wed/Fri (skipping holidays). `tsc --noEmit`.
  - **Depends on:** none (FEAT-14 reschedule depends on this). *(Source: 11; cross-ref index P2 distributeCourse)*

- [ ] **BUG-9 — `distributeCourse` picks an arbitrary classroom for multi-enrolled students** (P2, S)
  - **Problem:** `db.classroomStudent.findFirst({ where:{ studentId } })` has no `orderBy`, so a student in multiple classrooms gets a non-deterministic classroom (and thus holidays/school-day config) for scheduling.
  - **Locations:** `src/server/actions/scheduling.ts:98-107`.
  - **Fix:** Add deterministic `orderBy` (e.g. `{ createdAt: 'asc' }` or order by `classroom.createdAt`); long-term pass an explicit `classroomId` from `CourseDistributor` when the student is in >1.
  - **Verify:** Student in two classrooms with different `schoolDaysOfWeek` → distributing twice selects the same classroom. `tsc --noEmit`.
  - **Depends on:** none. *(Source: 11)*

- [ ] **BUG-10 — `DailyScheduleList` optimistic state never re-syncs to prop changes** (P2, M)
  - **Problem:** `useState(items)` seeds local state only on mount; when the parent RSC re-renders with new server `items` (switching student/date) the checklist shows the stale list until a full remount. The intended `useOptimistic` approach was never built.
  - **Locations:** `src/components/dashboard/DailyScheduleList.tsx:34-39`; consumer `src/app/student/dashboard/page.tsx:84-88`.
  - **Fix:** Replace with React 19 `useOptimistic(items, reducer)` so the base always tracks the prop; toggle inside `startTransition` and rely on the server action's `revalidateTag` + RSC re-render to settle (or add `useEffect(() => setOptimisticItems(items), [items])` as a lighter touch).
  - **Verify:** Toggle an item, switch student and back → reflects server truth (no stale list). `tsc --noEmit`.
  - **Depends on:** none. *(Source: 11)*

- [ ] **BUG-11 — `router.refresh()` fires un-awaited and races `addAdHocEvent`** (P2, S)
  - **Problem:** In `handleResourceSelected`, `router.refresh()` runs immediately after `toast.promise(addAdHocEvent(...))` without awaiting, so the refresh re-pulls the schedule before the `CustomEvent` insert + `revalidateTag` complete; the new event often doesn't appear until a later refresh.
  - **Locations:** `src/components/planner/PlannerGrid.tsx:115-123`.
  - **Fix:** `await addAdHocEvent(...)`, surface success/error via `toast` (mirror `handleDragEnd` at `:138-144`), then `router.refresh()` only on success; optionally clear the slot/picker.
  - **Verify:** Add a smart-slot activity → the event pill appears on the first refresh. `tsc --noEmit`.
  - **Depends on:** none. *(Source: 11)*

- [ ] **BUG-12 — SSRF guard on user-supplied URLs (`addArticle`, document `http` branch)** (P2, M)
  - **Problem:** `addArticle` `fetch`es a fully user-supplied URL with no allow-list / private-IP guard (e.g. `http://169.254.169.254/`); the Inngest worker's `http` branch shares the shape.
  - **Locations:** `src/app/actions/resource-library-actions.ts:123`; `src/inngest/functions/process-document.ts:49-54`.
  - **Fix:** Add a shared `assertPublicHttpUrl(url)` (require `http(s):`, reject creds-in-URL, resolve host and reject private/loopback/link-local/metadata ranges, optional allow-list); call it before both fetches; cap response size + timeout.
  - **Verify:** `addArticle("http://169.254.169.254/...")` is rejected and performs no fetch; a normal public URL still imports; unit-test the helper.
  - **Depends on:** none (also gates BUG-5). *(Source: 15; cross-ref index P2 security)*

- [ ] **BUG-13 — Org-scope `VideoProcessor` upsert/updateMany (global `youtubeVideoId`)** (P2, M)
  - **Problem:** The idempotency `findFirst` is org-scoped, but the subsequent `upsert({ where:{ youtubeVideoId } })` and failure-path `updateMany` key **solely** on the global-unique `youtubeVideoId`. So if org B already added a video, org A processing the same URL flips B's record to `EXTRACTING`/overwrites its summary — mutating another org's data.
  - **Locations:** `src/server/services/video-processor.ts:39-50,80-83`; create-route dedup `src/app/api/library/videos/route.ts:59-68`.
  - **Fix:** Either (a) make `youtubeVideoId` unique per org (`@@unique([organizationId, youtubeVideoId])` + migration, update the dedup), or (b) keep global uniqueness but `create` a new same-org record instead of `upsert` on the bare id, and scope the failure-path `updateMany` by `organizationId`.
  - **Verify:** Orgs A and B add the same URL → B's record/status/summary is never altered by A. `tsc --noEmit` + migration applies.
  - **Depends on:** pairs with HYG-46 (unify the two video-add flows). *(Source: 15)*

- [ ] **BUG-14 — Fix Zod v4 error detection in the students create route (validation → 500)** (P2, S)
  - **Problem:** The catch branches on `error.name === "ZodError"`, but on Zod `^4` the thrown error's `name` is `"$ZodError"` (or otherwise not the literal), so the check misses and validation failures fall through to a generic 500. Client form errors surface as 500 "Failed to create student" instead of an actionable 400.
  - **Locations:** `src/app/api/students/route.ts:41-44,76-91`.
  - **Fix:** Import `ZodError` from `zod`; replace the name check with `if (error instanceof ZodError)`; return `{ error:"Validation failed", details: error.issues }`; keep the 500 branch but stop echoing `error.message` (HYG-?? overlaps BUG-15).
  - **Verify:** POST an invalid body → 400 with field-level details, not 500. `tsc --noEmit`.
  - **Depends on:** none (do with BUG-15). *(Source: 12)*

- [ ] **BUG-15 — Stop echoing internal `error.message` to the client in students API routes** (P2, S)
  - **Problem:** Both POST routes return `details: error instanceof Error ? error.message : String(error)` in 500 responses, leaking Prisma/internal text.
  - **Locations:** `src/app/api/students/route.ts:84-89`; `src/app/api/students/[id]/assessment/route.ts:82-87`.
  - **Fix:** Keep `console.error` server-side but return a generic `{ error: "..." }` without `details` (optionally a correlation id). Pairs with BUG-14 so genuine validation errors still return safe field-level 400s.
  - **Verify:** Force a server error → 500 body has no internal text; server log still has the full error.
  - **Depends on:** BUG-14 (do together). *(Source: 12)*

- [ ] **BUG-16 — `buildPersonalizedPrompt` reads keys the schema never produces (dead branch)** (P2, M)
  - **Problem:** It casts `personalityData` to include `communicationStyle?`/`primaryDrivers?` and injects "Communication Style: …" / "Primary Drivers: …", but neither key exists in `PersonalityProfileSchema` (which has `motivationalDriver`, `feedbackStyle`, `toneInstructions`, `suggestedSystemPrompt`, …). Those lines are always empty. The same phantom keys are read in `grading/[id]/page.tsx:133,137-143`.
  - **Locations:** `src/lib/utils/prompt-builder.ts:134-150`; schema `src/server/ai/personality.ts:11-32`; second consumer `src/app/grading/[id]/page.tsx:133,137-143`.
  - **Fix:** Map to real fields (`toneInstructions`/`feedbackStyle` for "communication style"; `motivationalDriver` for "drivers") or drop the two lines and rely on `suggestedSystemPrompt`; remove the phantom keys from the cast; apply the same correction to the grading page panel.
  - **Verify:** For a student with a completed profile, the built string contains mapped values (no trailing-empty lines). `tsc --noEmit`.
  - **Depends on:** none (HYG-?? `as any` typing will expose it). *(Source: 12)*

- [ ] **BUG-17 — Remove the invalid "Overwhelmed" option / fix the "Mirco-Learning" enum typo** (P2, S)
  - **Problem:** The wizard offers `contentDensity: "Overwhelmed"`, not a member of the schema enum `["Skimmer","Deep Reader","Mirco-Learning"]`; the enum member is also a typo of "Micro-Learning".
  - **Locations:** wizard `src/components/students/AssessmentWizard.tsx:131`; schema `src/server/ai/personality.ts:47`.
  - **Fix:** Fix the enum to `"Micro-Learning"`; change the option `value` to a valid member (keep label "Overwhelmed", set `value:"Micro-Learning"`); grep for consumers comparing the literal `"Mirco-Learning"`.
  - **Verify:** `rg "Mirco-Learning"` / `rg '"Overwhelmed"'` return nothing; the model returns an enum-valid `contentDensity`. `tsc --noEmit`.
  - **Depends on:** none. *(Source: 12)*

- [ ] **BUG-18 — `profileComplete` / `completedAt` overstate assessment completion** (P2, S)
  - **Problem:** The assessment route sets `completedAt: new Date()` on EVERY step (so it means "last step saved"), and `StudentCard` computes `profileComplete = hasProfile && !!personalityData` (only the personality step). A student who finished only step 1 shows "✓ Complete" and the CTA disappears.
  - **Locations:** `src/app/api/students/[id]/assessment/route.ts:46`; `src/components/students/StudentCard.tsx:31,90-95,119-124`.
  - **Fix:** Require all three derived blocks in `StudentCard` (`personalityData && learningStyleData && interestsData`); set `completedAt` only when all three are present (or on the `interests` step); keep the "⚠ Partial" badge.
  - **Verify:** Personality-only → "⚠ Partial" + "Complete Setup"; all three → "✓ Complete" with `completedAt` set. `tsc --noEmit`.
  - **Depends on:** none. *(Source: 12)*

- [ ] **BUG-19 — Persist Step 2 schedule fields the action silently drops** (P2, M)
  - **Problem:** `schedule-step.tsx` collects `daysPerWeek`, `hoursPerDay`, `isYearRound`, `dailyTimesVary`, and `breaks`, but `saveScheduleStep` writes none of them. The `Classroom` model has columns for the first four; `breaks` has no column. All this data is silently discarded.
  - **Locations:** `src/server/actions/blueprint.ts:188-200`; columns `prisma/schema.prisma:231-234` (no `breaks`); client `src/components/onboarding/schedule-step.tsx:189-204`.
  - **Fix:** Write `dailyTimesVary`/`isYearRound`/`daysPerWeek`/`hoursPerDay` in the `update` data; mirror the client's mutual-exclusivity sanitization server-side; for `breaks`, add a `breaks Json?` column (+migration) and persist, or drop breaks from schema/UI.
  - **Verify:** Submit Step 2 with varies-weekly + times-vary + a break → the `classrooms` row has the populated columns (and breaks JSON if added). `tsc --noEmit`.
  - **Depends on:** breaks persistence needs a migration. *(Source: 13; cross-ref index P2)*

- [ ] **BUG-20 — Fix the raw-string call to `getBibleText` that empties auto-fetched verse text** (P2, S)
  - **Problem:** `addVerseToUser` calls `getBibleText(data.reference)` with a **raw string**, but `getBibleText` Zod-parses `{ reference }`. The parse throws, the surrounding `try/catch` swallows it, and `text` becomes `""`. Verses added without supplied text persist with empty bodies. (The feature limps because `PracticeMode` re-fetches client-side with the correct shape.)
  - **Locations:** `src/app/family-discipleship/bible-memory/actions.ts:121` (call); `src/server/actions/bible-study.ts:127-129,250-251`; correct shape in `PracticeMode.tsx`.
  - **Fix:** Change to `getBibleText({ reference: data.reference })`; optionally log instead of silently swallowing; grep for other raw-string `getBibleText`/`getBiblePassage`/`getBibleAudio` callers and normalize to `{ reference }`.
  - **Verify:** Add a memory verse without typing text → `BibleMemory.text` is the ESV passage, not `""`.
  - **Depends on:** none. *(Source: 18, 19 — merged)*

- [ ] **BUG-21 — Fix the stale-closure `!showAnswer` guard in the catechism mastery rule** (P2, S)
  - **Problem:** `checkAnswer` calls `setShowAnswer(true)` then gates mastery on `!showAnswer`, which reads the **previous** render's value. The "mastery only if you did NOT peek" rule reflects the prior render, making it easy to mark questions mastered after peeking.
  - **Locations:** `src/app/family-discipleship/catechism/InteractiveCatechism.tsx:370,383-388`.
  - **Fix:** Capture `const wasShowingAnswer = showAnswer;` at the top of `checkAnswer`; base the mastery guard on the local; decide whether `setShowAnswer(true)` should auto-reveal on every check.
  - **Verify:** Peek then answer correctly → `markQuestionAsMastered` NOT called; answer without peeking → it IS called.
  - **Depends on:** none. *(Source: 18)*

- [ ] **BUG-22 — Stop the `title`-change effect from wiping rehydrated catechism progress** (P2, S)
  - **Problem:** A `[title]` effect unconditionally `setProgress({})`; the async load-progress effect rehydrates mastered questions. On mount both fire; if the load resolves after the reset, rehydrated "Mastered" badges get clobbered in the UI (server data untouched, but confusing).
  - **Locations:** `src/app/family-discipleship/catechism/InteractiveCatechism.tsx:225-231,148-181`.
  - **Fix:** Remove `setProgress({})` from the `[title]` reset (rely on the load effect); if a true reset is needed only when title genuinely changes, track the previous title in a ref; or merge both into one `[studentId, catechismId, title]` effect that resets then loads in sequence.
  - **Verify:** Open a tracked catechism with prior mastery → badges appear on mount and persist; switch catechisms and back → mastery reloads correctly.
  - **Depends on:** none. *(Source: 18)*

- [ ] **BUG-23 — Make grade-save transactional and add server-side input validation** (P2, M)
  - **Problem:** `POST /api/grading/[id]` updates the attempt then loops `findFirst`+`update` per item **outside any transaction** (N+1, partial-graded on mid-loop failure), and writes `scorePoints`/`maxPoints`/`feedback`/per-item scores **verbatim** with no Zod/bounds — a caller can post `scorePoints > maxPoints`, negatives, or per-item scores exceeding item points (the client clamp is bypassable). Also "max points" is computed three inconsistent ways across the subsystem.
  - **Locations:** `src/app/api/grading/[id]/route.ts:19,37-71`; max-points divergence `src/app/actions/assessment-actions.ts:43,48` + `src/components/grading/GradingInterface.tsx:63-66,91-94` + `src/app/grading/page.tsx:97`.
  - **Fix:** 1) Wrap the attempt update + all item-response updates in `db.$transaction`; replace per-item `findFirst` with `tx.assessmentItemResponse.update({ where:{ attemptId_itemId: { attemptId: id, itemId } } })`. 2) Zod-validate the body (non-negative scores, `gradingMethod` enum); clamp `itemScore <= item.points` and `scorePoints <= maxPoints` server-side; 400 on failure. 3) Unify max points to one source (recommended: sum of item `points`; set `Assessment.totalPoints = sum` on authoring, and make the seed + `GradingInterface` save use the same derivation).
  - **Verify:** `tsc`; mid-loop bad itemId rolls back the whole save; `scorePoints > maxPoints` → 400; index and detail show the same max.
  - **Depends on:** max-points unification pairs with FEAT-16 (where `totalPoints` is set). *(Source: 16 — merges the transaction, validation, and max-points items)*

- [ ] **BUG-24 — Set `gradingMethod` honestly and write `letterGrade`/`isCorrect`** (P2, M)
  - **Problem:** `gradingMethod` is hardcoded/defaulted to `"AI_ASSISTED"` even for purely manual scoring, so `AUTO`/`MANUAL` are never produced; `letterGrade` and per-response `isCorrect` exist on the model but are never written.
  - **Locations:** `src/components/grading/GradingInterface.tsx:106`; `src/app/api/grading/[id]/route.ts:43,61-68`; schema `prisma/schema.prisma:859,882,599,618-619`.
  - **Fix:** Track AI-vs-manual in `GradingInterface` and send the honest `gradingMethod`; derive `letterGrade` at save from `scorePoints/maxPoints` against the org scale; set `isCorrect` for auto-gradable items by comparing `responseData` to `correctAnswer` when authoring data exists (or document the fields as reserved — see HYG-50).
  - **Verify:** Grade with only manual scores → `gradingMethod === "MANUAL"`; if implemented, `letterGrade` matches the percentage band.
  - **Depends on:** letterGrade needs a grading-scale source; isCorrect needs FEAT-16 authoring writing `correctAnswer`. *(Source: 16)*

- [ ] **BUG-25 — Rehydrate the Environment onboarding step from saved data** (P2, S)
  - **Problem:** `EnvironmentStep` hard-codes empty `defaultValues` and never reads `initialData`, so revisiting `/onboarding?step=3` (incl. the `/blueprint` "Edit Environment" deep-link) always starts blank even though the data is saved and read back by `getFamilyContext`.
  - **Locations:** `src/components/onboarding/environment-step.tsx:77-87` (`initialData` at `:66` unused); persisted `blueprint.ts:254-269`; read `master-context.ts:321-323`.
  - **Fix:** Hydrate `defaultValues` from `initialData.environmentPreferences` (philosophyPreferences/resourceTypes/goals/deviceTypes/challenges/faithBackground); confirm `getBlueprintProgress` returns the column (it returns the full classroom row).
  - **Verify:** Save Environment selections, reopen `?step=3` → chips/text pre-selected. `tsc --noEmit`.
  - **Depends on:** pairs with FEAT-23. *(Source: 13)*

- [ ] **BUG-26 — Add error handling to the `StudentDashboard` client data fetch** (P2, S)
  - **Problem:** `StudentDashboard` fetches assignments after mount with no try/catch; if `getStudentAssignments` rejects (network/`"Unauthorized"`), `setLoading(false)` is never reached and the dashboard is stuck on a permanent spinner with no error UI.
  - **Locations:** `src/components/dashboard/StudentDashboard.tsx:27-35,78-81`; throwing action `src/app/actions/student.ts:13-17`.
  - **Fix:** Add an `error` state; wrap the fetch in try/catch/finally (move `setLoading(false)` into `finally`); render an error branch with a "Retry" that re-invokes `loadData`.
  - **Verify:** Force the action to throw → error UI (not endless spinner) with working Retry. `tsc --noEmit`.
  - **Depends on:** none. *(Source: 14)*

- [ ] **BUG-27 — Handle the church-note unique-date collision + guard the unguarded `JSON.parse`** (P2, S)
  - **Problem:** `LocalChurchNotes` has `@@unique([userId, date])`; creating a second note for the same date throws a Prisma uniqueness error that surfaces as an unhandled rejection (the client has no try/catch — silent failure). Separately, `addChurchNote` does `JSON.parse(mainPointsRaw)`/`JSON.parse(songsRaw)` on raw FormData with no guard, so malformed JSON throws an unhandled server error; there's no Zod anywhere.
  - **Locations:** client `src/app/family-discipleship/church/ChurchNotesClient.tsx:56-70`; server `src/app/family-discipleship/actions.ts:121-168` (create `:150`, parses `:140-144`); constraint `prisma/schema.prisma LocalChurchNotes`.
  - **Fix:** 1) In `addChurchNote`, catch Prisma `P2002` and return `{ success:false, error:"A note already exists for that date" }` (return a result object, not void); wrap each `JSON.parse` in a helper returning `[]` on failure (or a small Zod schema). 2) In the client, wrap the call / check the result, `toast.error` on failure, only reset/close on success. (Optionally upsert on `[userId, date]` if same-date overwrite is desired.)
  - **Verify:** Submit two notes for one date → toast error, dialog stays open, no unhandled rejection; malformed `mainPoints` no longer throws.
  - **Depends on:** none. *(Source: 19 — merges the collision and JSON.parse items)*

- [ ] **BUG-28 — Fix the bare-string `deleteArticle(article.id)` call (article delete always throws)** (P2, S)
  - **Problem:** `ArticleList` calls `deleteArticle(article.id)` with a **bare string**, but the action does `deleteResourceSchema.parse(rawData)` where `deleteResourceSchema = z.object({ id: z.string().uuid() })`. Parsing a string against an object schema throws a ZodError on **every** call, so article deletion never works — the caught error just shows a generic toast. (This is a distinct call site from the sibling `deleteCourse(course.id)` shape bug already folded into the HYG-52 / cross-doc merge note; that fold-in covered only the `CourseList` caller.)
  - **Locations:** `src/components/library/ArticleList.tsx:130` (`deleteArticle(article.id)`); action + schema `src/app/actions/resource-library-actions.ts:230-247`.
  - **Fix:** 1) Change the call to `deleteArticle({ id: article.id })`. 2) (Consistency) confirm the other delete callers already pass the object shape — `BookList` `deleteBook({id})`, `DocumentList` `deleteDocument({id})` are correct; the `CourseList` `deleteCourse(course.id)` site is the one tracked in the cross-doc merge note.
  - **Verify:** Delete an article from the UI → it disappears with a success toast; no ZodError in server logs. `tsc --noEmit`.
  - **Depends on:** none. *(Source: 15)*

---

## Phase 3 — Drift, dead-code, infra & hygiene (P3)

Includes the no-tests / no-`next build`-in-CI gaps, doc-drift, dead nav/components, and tracked build
artifacts. **Sequencing:** stand up the test runner once (HYG-1), then every subsystem "add tests" task
hangs off it; do the calendar v9 migration (HYG-39) before/with the icon-library consolidation (HYG-42).

### Infra & CI

- [ ] **HYG-1 — Stand up a test runner + first smoke test + CI step** (P3, L) — No test framework anywhere (no Jest/Vitest/Playwright, no `test` script); CI runs only `tsc --noEmit` + `eslint`. Add Vitest (fits the ESM/Next 16/React 19 stack), a `"test": "vitest run"` script + minimal config, a first smoke test (`/api/health` or a pure util), and `- run: npm test` in `ci.yml`. **This is the prerequisite for HYG-2, HYG-30, HYG-31, HYG-32, HYG-33, HYG-34, HYG-35, HYG-36, HYG-37 and all per-subsystem test tasks.** *(Source: 01; every subsystem references it)*
- [ ] **HYG-2 — Add tenant-isolation tests + a static guard for missing `organizationId` filters** (P3, L) — Seed two orgs and assert each tenant-scoped query/route returns only its own rows (start with `students`, `books`, `courses`, `resources`); add an ESLint rule or small script that flags `db.<model>.find*` on tenant-owned models lacking `organizationId` in `where`; wire into CI. *(Source: 02; pairs with SEC-10)*
- [ ] **HYG-3 — Add `next build` to CI** (P3, M) — CI never runs the real production build (`next build --webpack`), so a webpack-only break (RSC/route-typing error not caught by `tsc`) passes green and breaks Vercel. Add `- run: npm run build` (or `npx next build --webpack` after prisma/postgenerate) to the `check` job; provide dummy public env if needed. Locations: `.github/workflows/ci.yml:22-26`; `package.json:9`. *(Source: 01)*
- [ ] **HYG-4 — Re-promote the ESLint mass-downgraded rules with a burndown** (P3, L) — `eslint.config.mjs:24-34` downgrades nine error-rules to `warn` (incl. `react-hooks/set-state-in-effect`, `react-hooks/error-boundaries` which mask real correctness bugs). Quantify per-rule (`eslint . -f json`), fix and re-promote the high-risk/low-volume ones first, leaving only genuinely large ones (likely `no-explicit-any`) as `warn` with a tracking note. *(Source: 01)*
- [ ] **HYG-5 — Confirm the proxy runtime (edge vs Node) and document it** (P3, S) — `proxy.ts` imports full `@/auth` (Prisma adapter graph); whether it runs on edge or is bumped to Node is unverified. Probe via deploy logs / `process.env.NEXT_RUNTIME`; either accept Node and document, or refactor to import only edge-safe `authConfig`. Needs a deploy environment. *(Source: 04)*
- [ ] **HYG-6 — Confirm/document Inngest signing-key verification for `/api/inngest`** (P3, S) — The route has no app `auth()` — protected only by `INNGEST_SIGNING_KEY`; the `curriculum/compile` event carries the `organizationId`/`userId` used for ALL writes, so a forged unsigned event = cross-tenant write. Confirm signing key/event key are set in every env and `serve` runs signed; document the trust assumption; optionally re-validate `userId ∈ organizationId` in `fetch-context`. Locations: `src/app/api/inngest/route.ts:7-14`; `src/inngest/functions/compile-curriculum.ts:60,65-80`. *(Source: 09)*

### Secrets, env & connection config

- [ ] **HYG-7 — Rotate the live Stripe + Sentry secrets in `.env`, then delete the vestigial vars** (P3/P1, S) — `.env:17-26` carries REAL `sk_live_…`/`rk_live_…` Stripe keys, webhook secret, `pk_live_…`, and a live `SENTRY_AUTH_TOKEN`/DSN for services with **zero usage** in code (no Stripe SDK, no `@sentry/*`). Treat as compromised: rotate/revoke in the dashboards, confirm `grep -rIn -E 'STRIPE|SENTRY' src/` is empty, delete the lines, store any genuinely-planned keys in Vercel not the dotfile. *(Source: 01)*
- [ ] **HYG-8 — Fix env-name mismatches: Supabase publishable key + Google Books key** (P3, S) — (a) `client.ts`/`server.ts:16` read `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` but `.env:49` defines `*_PUBLISHABLE_DEFAULT_KEY` (works only via `.env.local`); rename `.env:49` to the consumed name. (b) `youtube-actions.ts:10` and `library-lookup-actions.ts:15` read `GOOGLE_BOOKS_API_KEY` but `.env:25` only declares `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY`; add the non-public name (server actions) or repoint the reads. *(Source: 01 — merged two env items)*
- [ ] **HYG-9 — Repoint the stale Supabase MCP `project_ref` in `.claude/settings.json`** (P3, S) — `.mcp.json:5` uses `liflosyuonigkiyhwsny` (matches `.env.local`), `.claude/settings.json:5` uses stale `zykjofwwdephbiyydumc`. Update `.claude/settings.json:5` to match and grep for other stray refs. *(Source: 01)*
- [ ] **HYG-10 — Wire the connection URL into the Prisma datasource (or document the out-of-band requirement)** (P3, S) — The `datasource db` block declares no `url`/`directUrl`; `migrate`/`studio` need the URL via env/CLI, and the pooled `DATABASE_URL` is unsuitable for migrations. Add `url = env("DATABASE_URL")` + `directUrl = env("DIRECT_DATABASE_URL")` (runtime still uses the adapter), or document the required flags. Locations: `prisma/schema.prisma:8-10`. *(Source: 02)*
- [ ] **HYG-11 — Document/justify `ssl.rejectUnauthorized:false` on the Postgres connection** (P3, M) — `src/server/db.ts:10` disables TLS cert verification (MITM-weakening). Determine if Supabase requires it; if a CA is available switch to `{ ca, rejectUnauthorized:true }`; else add a comment stating why + the residual risk. *(Source: 01)*
- [ ] **HYG-12 — Omit `instructorPin` hashes from the data export** (P3, S) — `exportUserData` includes `classrooms.instructors` with full `ClassroomInstructor` rows, shipping bcrypt PIN hashes to the client JSON. Replace `include:{ instructors:true }` with an explicit `select` omitting `instructorPin`. Location: `src/app/actions/data-export.ts:122-129`. Moot if FEAT-2 removes the PIN. *(Source: 04)*
- [ ] **HYG-53 — Tighten Next image `remotePatterns` from any-https-host to known hosts** (P3, S, perf / security-idor) — `next.config.js` sets `remotePatterns: [{ protocol:'https', hostname:'**' }]`, so the Next image optimizer will fetch from **any** https host — an SSRF/abuse proxy surface (probe internal services, amplify bandwidth, cache-poison the optimizer) that also weakens any image CSP. This is a **distinct attack surface** from BUG-12 (the `addArticle`/document-fetch SSRF) and from the unrelated `next.config.js:1-5` `__dirname` dead-code in HYG-47. **Fix:** 1) Enumerate the hosts the app actually loads remote images from (Supabase storage, Google Books, YouTube thumbnails `i.ytimg.com`, DiceBear `api.dicebear.com`, any avatar CDNs). 2) Replace the `'**'` entry with one `remotePatterns` entry per real host (e.g. `*.supabase.co`, `books.google.com`, `i.ytimg.com`, `api.dicebear.com`). 3) Smoke-test image-heavy pages and add any missed host. Keep the list in code so it stays reviewable. Locations: `next.config.js:15-22`. *(Source: 01)*

### Auth/tenancy hardening (low-severity, posture)

- [ ] **HYG-13 — Decide & document tenancy for `getAcademicContext` (global objective lookup)** (P3, S) — `getAcademicContext(objectiveId)` resolves any objective's full hierarchy with no org filter; objectives are global Spine data so this may be intentional. Add a code comment stating it's intentionally org-agnostic, or thread `organizationId`. Location: `src/lib/context/master-context.ts:563-606`. *(Source: 06)*
- [ ] **HYG-14 — Add auth to unauthenticated metadata/catalog reads** (P3, S) — `GET /api/curriculum/resource-kinds` returns the full catalog to any caller, and `getSourceMetadata` does a bare `findUnique` leaking `subjectId`/`strandId` cross-org. Add `auth()` (401) to the route and `getCurrentUserOrg()` + org filter to `getSourceMetadata`. Locations: `src/app/api/curriculum/resource-kinds/route.ts:6-22`; `src/app/actions/generator-actions.ts:7-36`. *(Source: 08)*
- [ ] **HYG-15 — Org-filter the `[id]` generator page's display fetches + harden TOC parsing** (P3, S) — `creation-station/[id]/page.tsx:94-148` fetches student/objective/book/video by id with bare `findUnique` (cross-org name/title read); add `organizationId` to each `where`. Also harden `getBookChapters` TOC parsing (`curriculum-actions.ts:58-66`): Zod-validate the `Json?` array, log + return `[]` on malformed shape instead of garbage rows. *(Source: 08, 07 — merged display-scope + TOC-hardening)*
- [ ] **HYG-16 — Add `take` bounds (and optional auth) to the unbounded curriculum REST routes** (P3, S) — `subjects/strands/topics/subtopics/grade-bands/resource-kinds` have no `take` bound (unbounded payloads as the spine grows) and no auth gate. Add a sane `take` to each `findMany`; optionally gate behind `auth()` (401) without org filter (spine is global). Locations: the six `src/app/api/curriculum/*` routes. *(Source: 07)*
- [ ] **HYG-17 — Add page auth+org guard to the assessment wizard page** (P3, S) — `students/[id]/assessment/page.tsx` renders with no `auth()`/org check (the only student page without a guard); an unauth visitor can load the wizard for an arbitrary student id. Add `auth()`→`/login`, `getCurrentUserOrg()`, and `getStudentById(id, org)`→`/students` on null. Location: `:8-15`. *(Source: 12)*
- [ ] **HYG-18 — Make `getCommentary` and catechism/devotional reads consistent with their auth-gated siblings** (P3, S) — `getCommentary` (and `getCatechisms`/`getCatechismQuestions` + the catechism/devotionals pages) call no `auth()` while the ESV siblings 401 when logged out. Content is public-domain so risk is informational; either gate all read content behind `auth()` for consistency or document the intentional public access. Locations: `src/server/actions/bible-study.ts:392-394`; `src/app/family-discipleship/catechism/actions.ts:7,27` + `catechism/page.tsx:5` + `devotionals/page.tsx:7`. *(Source: 18)*
- [ ] **HYG-19 — Decide & apply auth gating for Missions/Neighbor public pages** (P3, S) — `missions/page.tsx`, `neighbor/page.tsx`, and all four `missions/actions.ts` reads are unauthenticated (inconsistent with Prayer/Church/Heart-Check) with zero rate-limiting on `getCountiesForState`/`getAllStates`. Decide policy: gate with `auth()` or document intentional public access + add light rate-limiting. *(Source: 19)*
- [ ] **HYG-20 — Decide whether Thinkling needs role gating** (P3, M) — Chat is gated by login+org but **not by role**; any org member can chat as any `Student` via the dropdown. Not a cross-tenant leak. Product decision: restrict TEACHER/PARENT to specific students or document org-wide access. Locations: `src/app/thinkling/page.tsx:12-35`; `src/app/api/chat/route.ts:14-54`. *(Source: 20)*
- [ ] **HYG-21 — Decide whether the curriculum REST taxonomy should require a session** (folded into HYG-16) — *(handled by HYG-16; no separate task)*

### Prompt safety & AI-core hygiene

- [ ] **HYG-22 — Delimit/escape untrusted text concatenated into prompts (prompt injection)** (P3, M) — Every DB-backed prompt builder inlines untrusted strings with no delimiting; the acute case is `buildPersonalizedPrompt` injecting the AI-generated stored `suggestedSystemPrompt` verbatim at the top of the prompt (stored prompt injection). **Also covers the safety-classifier:** the raw student message is string-interpolated into the deep-path classifier prompt (`guard.ts:163`), letting a crafted message steer it to `isSafe:true`. Wrap untrusted blocks in fenced delimiters labeled as data; move `suggestedSystemPrompt` out of the system position; strip/neutralize delimiters; add a length cap + override-phrase denylist on `suggestedSystemPrompt` at write time. Locations: `src/lib/utils/prompt-builder.ts:140-156,84-106,275-291`; `src/lib/ai/prompt-builder.ts:95-103,121-125`; `src/lib/safety/guard.ts:148-165`. *(Source: 05, 20 — merged prompt-injection items)*
- [ ] **HYG-23 — Decide whether Inkling guardrails apply to all generation paths** (P3, M) — `INKLING_BASE_PERSONALITY`/`ETHICAL_GUIDELINES` are injected only by the `PromptBuilder` class, and even there the structured `generateObject` calls pass persona-only (ethics dropped); streamUI, chat, master-prompt grading, personality, and safety inject neither. Add a `withGuardrails(system)` helper and apply it to the structured calls, streamUI, chat, and grading `generateText`; leave the safety guard out by design. *(Source: 05)*
- [ ] **HYG-24 — Align config comments & `model-selection.md` with the actual model stack** (P3, S) — Comments throughout `config.ts` and all of `model-selection.md` still describe a "Gemini 3 Pro (only model that processes YouTube)" world and claim personality/learning-style use Pro (they map to Flash). Update the enum/group comments to the real mapping; rewrite or delete `model-selection.md` (remove the unverified pricing table and the `getModelByComplexity` sample). **This and HYG-25 cover the same "Gemini 3 Pro" drift flagged in docs 05/08/12/15** (also `src/app/api/library/videos/[id]/extract/route.ts:37`, `src/components/library/AddVideoDialog.tsx:70`). *(Source: 05, 08, 12, 15 — merged)*
- [ ] **HYG-25 — Remove unused model-selection helpers + de-dupe the YouTube regex** (P3, S) — `getModelByComplexity`/`getDefaultModel`/`getStructuredModel`/`getGenerativeUIModel` (`config.ts:163-188`) have no importers — delete them. The identical YouTube regex is copy-pasted in `config.ts:217` and three times in `video-processing.ts:82,90` — define one exported `YOUTUBE_URL_REGEX` and reference it everywhere. *(Source: 05 — merged dead-helpers + regex items)*
- [ ] **HYG-26 — Remove deprecated/unused prompt-builder functions and relocate `calculateAge`** (P3, S) — `buildCompletePrompt` is `@deprecated` with no external callers; `buildSpineAwarePrompt`/`buildPersonalizedPrompt`/`buildFamilyContextPrompt` are only invoked by it (the live path is `buildMasterPrompt`). **`calculateAge` is the one shared concern across docs 05 and 06:** it's defined but never called, yet `ai/prompt-builder.ts:36-38` computes age with a naive year-diff (off by ~1 year). Relocate `calculateAge` to a shared util and call it from the naive site (BUG fix), then delete `buildCompletePrompt` and the now-orphaned builders (unless keeping `buildPersonalizedPrompt` for the injection fix). Locations: `src/lib/utils/prompt-builder.ts:205-229,294-302`; naive calc `src/lib/ai/prompt-builder.ts:36-38`. *(Source: 05, 06 — merged)*
- [ ] **HYG-27 — Resolve unwired generator/tool type schemas + drop the unused `@ai-sdk/openai` dep + verify YouTube ingestion** (P3, M) — (a) `src/lib/types/tools.ts:12-79` (`GeneratorConfigSchema`/`AvailableToolsSchema`/`GeneratorInputSchema`/`OmniGeneratorToolSchema`) have no importers; delete or banner as planned. (b) `@ai-sdk/openai` (`package.json:25`) is never imported — `npm uninstall`. (c) Verify `extractVideoContent` actually ingests a bare YouTube URL in a text prompt (now that `pro3` may fall back to `gemini-2.5-pro`); if not, switch to the AI-SDK file/video part API and mark low-confidence extractions `FAILED` so junk isn't embedded (`src/lib/ai/video-processing.ts:47-59`; consumers `video-processor.ts:53`, `extract/route.ts:38`). *(Source: 05 — merged dead-schema, dead-dep, and the P1 YouTube-ingestion verification)*
- [ ] **HYG-28 — Remove or wire the unused YouTube helpers in `video-processing.ts`** (P3, S) — `processYouTubeVideo` (freeform) and `generateVideoQuiz` have no call sites; delete both, keeping `extractVideoContent`/`isYouTubeUrl`/`extractYouTubeVideoId`. Locations: `src/lib/ai/video-processing.ts:16-31,65-76`. Depends on HYG-27 (resolve ingestion first in case the freeform helpers should be revived). *(Source: 05)*

### Comment/doc drift & naming

- [ ] **HYG-29 — Remove stale onboarding comments (`environmentPreferences`/"Step 3 removed")** (P3, S) — `blueprint.ts:228-233` claims `environmentPreferences` still needs adding (the column exists and is written), and `:305-309` says "we only have 2 steps" while the wizard ships 3. Replace with accurate notes. Do with FEAT-23. *(Source: 13)*
- [ ] **HYG-30 — Reconcile the two/three competing "completeness" definitions + disambiguate name collisions** (P3, M) — Three completeness rubrics disagree (the engine's 5-pillar `analyzeContextCompleteness`, `metadata.contextCompleteness.library`, the student-page 4-factor widget), and `/blueprint` computes a fourth 5-item score. Pick a canonical rubric (recommend 5-pillar), have `ContextInspectorClient` consume `metadata.contextCompleteness` instead of recomputing, align `/blueprint` to the shared value, and rename the student-local widget (e.g. `StudentContextCompleteness`) to resolve the `ContextCompleteness` / `ContextInspector` name collisions. Locations: `context-suggestions.ts:49-220`; `master-context.ts:249-255`; `students/[id]/_components/ContextCompleteness.tsx`; `ContextInspectorClient.tsx:28-34`; `blueprint/page.tsx:49-58`. *(Source: 06, 13 — merged)*
- [ ] **HYG-31 — Mark `.cursor/` + QSF docs as planning/aspirational and correct load-bearing facts** (P3, M) — `.cursor/CURSOR_RULES.md` asserts wrong facts (Next 16.0.7/Node 20.9+, a tRPC data layer that doesn't exist, a "No any" rule lint now warns). Add an aspirational/historical banner + date, correct the factual lines (Next 16.2.x, Node ≥24, Server Actions + route handlers not tRPC), and point readers to `docs/codebase-map/*`. *(Source: 01)*
- [ ] **HYG-32 — Reconcile "Inkling" vs "Thinkling" naming** (P3, S) — The assessment UI brands "Inkling" while the runtime chat is "Thinkling". Confirm the canonical name with product and global-find/replace the user-facing copy (keep code symbol names stable). Locations: `AssessmentWizard.tsx:253,256,275,292,507`; `PersonalityProfile.tsx:15,57,74`; `lib/thinkling.ts`. *(Source: 12)*
- [ ] **HYG-33 — Document the dual tenancy-column convention + the `account_id`↔organization landmine** (P3, S) — Most tenant tables map `organizationId → account_id`, but `Transcript` and `CurriculumSpec` use `organization_id`; the Auth.js `accounts` table is unrelated. Add a prominent comment block at the top of `schema.prisma` listing which tables use which column (and noting `account_id` is the org FK, not the OAuth table); optionally a grep check on raw SQL touching `transcripts`/`curriculum_specs`. Locations: `schema.prisma:127,147,…,769`. *(Source: 02, 04 — merged)*
- [ ] **HYG-34 — Canonicalize root-layout metadata to "Quill & Compass" + tidy the mid-file import** (P3, S) — `app/layout.tsx:22-25` sets `metadata.title = "QuillNext"` (engineering name) while all surfaces brand "Quill & Compass"; the `import { auth }` sits mid-file at `:27`. Update the metadata (consider a title template), move the import to the top block. *(Source: 21)*
- [ ] **HYG-35 — Reconcile the `terms` change-notice inconsistency + make `changelog` honest** (P3, S) — `terms/page.tsx` §7 (30 days notice) contradicts its plain-language summary; pick the canonical clause and align the copy. `changelog/page.tsx` is hard-coded static prose guaranteed to drift — drive from a committed data file or add a maintenance note and bump it to reflect the 2026-06-16 model change. *(Source: 21 — merged)*
- [ ] **HYG-36 — Reconcile unused Assessment model fields + disambiguate the personality "assessment" naming collision** (P3, S) — Document (schema comments) or wire the never-read `Assessment.timeLimitMinutes`, `AssessmentItem.questionData`/`correctAnswer`, `AssessmentAttempt.letterGrade`, `AssessmentItemResponse.isCorrect`, and the unused `AttemptStatus`/`GradingMethod` enum values. Separately, add a top-of-file comment to `api/students/[id]/assessment/route.ts` and `students/[id]/assessment/page.tsx` clarifying they are the LearnerProfile **calibration wizard**, not the gradeable `Assessment` product. *(Source: 16 — merged)*
- [ ] **HYG-37 — Update stale `SafetyFlag` schema comments + Resend docstring TLD** (P3, S) — `schema.prisma:320-326` comments understate the real stored `severity`/`category`/`resolution` values and call `message` "the content" (only a 100-char snippet is stored). Update to the real value sets from `guard.ts:8-9`/`types.ts`/`safety-scan.ts:76` (comments only, no migration). Fix the `safety-alert.ts:22` docstring `quillandcompass.com`→`.app`. *(Source: 20 — merged)*
- [ ] **HYG-38 — Fix wizard copy bugs + prayer-editor "none" sentinel + Thinkling prompt drift + combobox quotes + error-boundary leak** (P3, S) — A cluster of cosmetic/copy defects: (a) AssessmentWizard "How should Inkling talk to expectations?" and the fused `bg-qc-surface-raisedpy-12` className (`:292,:519`); (b) normalize the prayer category `"none"` sentinel to `null` (`PrayerJournalEditor.tsx:257,89-96`); (c) Thinkling system-prompt duplicate guideline #3 + mis-numbered list + "ALWAYS uses BULLET POINTS" typo (`thinkling.ts:47-48,42-52,72`); (d) strip literal quote chars around `{inputValue}` in `ComboboxWithCreate` (`combobox-with-create.tsx:95`); (e) stop `app/error.tsx:16` rendering raw `error.message` (show generic copy + keep `error.digest`); (f) drop the dead `weight-fill` class on Sidebar icons (`Sidebar.tsx:95`); (g) align `ui/textarea.tsx:10-13` tokens with the `qc-*` system. *(Source: 12, 19, 20, 21 — merged small copy/cosmetic items)*

### UI primitives & components

- [ ] **HYG-39 — Migrate `ui/calendar.tsx` from react-day-picker v8 API to the installed v9** (P3, M) — `package.json` installs `react-day-picker@9.12.0`, but `calendar.tsx:22-55` configures v8-era `classNames` keys (renamed in v9), so brand styling silently no-ops and the calendar renders broken. It's LIVE (both prayer-journal date pickers). Regenerate from the shadcn v9 template (or migrate keys + the `components` API `Chevron`) and re-apply `buttonVariants` styling; smoke-test both pickers. *(Source: 21)*
- [ ] **HYG-40 — Fix the `useFormField` dead null-guard + duplicate `Slot` import** (P3, S) — `useFormField` dereferences `fieldContext.name` before the `if (!fieldContext) throw` guard, so the guard never protects; there's a duplicate unused `RadixSlot` import. Move the guard before `getFieldState`, optionally guard `itemContext`, delete the duplicate import. Locations: `src/components/ui/form.tsx:42-46,4-5`. *(Source: 21)*
- [ ] **HYG-41 — Reveal the "Open Tool" affordance in `InklingToolkit` (missing `group` ancestor)** (P3, S) — The "Open Tool →" hint uses `group-hover:opacity-100` but no ancestor has `group`, so it's permanently invisible (live on the parent dashboard). Add `group` to the wrapping `<Link>`/`motion.div`. Locations: `InklingToolkit.tsx:86,62-72`. *(Source: 21)*
- [ ] **HYG-42 — Standardize on a single icon library (Phosphor vs lucide-react)** (P3, M) — The UI set mixes Phosphor and lucide-react with no convention. Pick Phosphor (brand primary), replace lucide icons in the primitives, remove `lucide-react` once unreferenced. Do with HYG-39 (calendar touches lucide chevrons). *(Source: 21)*
- [ ] **HYG-43 — Harden the free-form profile `image` URL beyond `z.url()` + standardize avatar rendering** (P3, S-M) — `updateProfile` validates the avatar URL only as a generic URL (no scheme/host restriction), letting an arbitrary external/tracking URL render as an avatar; tighten to `https:` + optional host allowlist (`user-actions.ts:8-11`). Separately, two DiceBear avatar paths exist (local `@dicebear/core` editor vs remote `api.dicebear.com` URL helper in `lib/utils.ts`), which can diverge and add a third-party dependency on every list render — standardize on one path (recommended: render locally), with graceful fallback + `referrerPolicy="no-referrer"` and a pinned DiceBear major if keeping the CDN. *(Source: 21, 12 — merged image-URL + avatar-path items)*

### Dead code & dead data

- [ ] **HYG-44 — Remove dead Living-Library surface: `/api/library/scan` ISBN route, `searchVideos`, `refreshBooks` prop** (P3, S-M) — `POST /api/library/scan` (non-vision) has no callers (the scanner uses `lookupBook` + `scan/vision`) — delete it. `searchVideos` in `vector.ts:104-134` has zero callers — delete (or wire with the video-search UI). `LibraryClient` passes `refreshBooks={() => {}}` and `BookList` requires it but never invokes it — remove the dead prop; reduce `any[]`/`@ts-ignore` at the list/`deleteResource` boundaries. *(Source: 15 — merged three dead-code items)*
- [ ] **HYG-45 — Trim `getLibraryResources` over-fetch (bundles) + audit revalidate coverage** (P3, S) — `getLibraryResources` fetches `curriculumBundles` the hub never uses (a wasted query) and is cached `revalidate: 3600` while not all mutate paths bust the `library-${orgId}` tag (REST video/book create don't). Remove the bundles query, add `revalidateTag` to the REST routes (or lower the window), verify the `revalidateTag(tag, {})` extra arg against the Next 16 signature. Also filter the bundle picker to `COMPLETED` so a `COMPILING`/`FAILED` bundle can't be selected (`resource-library-actions.ts:100-105`; explode gate `explode-bundle.ts:71-73`). Locations: `resource-library-actions.ts:19-118`. *(Source: 15, 09 — merged over-fetch + bundle-picker-filter)*
- [ ] **HYG-46 — Unify the two video-add flows and capture real YouTube metadata** (P3, L) — Two divergent video pipelines (hub `AddVideoDialog`→`VideoProcessor` auto-extract vs `/living-library/videos` REST create + manual extract) diverge in title/metadata/embedding timing; neither fetches real YouTube title/thumbnail/channel/duration; `DocumentResource` has no status column so worker failures are invisible. Pick `VideoProcessor` as the single pipeline (delegate the REST routes to it), fetch real metadata via the YouTube Data API, optionally add a `status` column to `DocumentResource`. Depends on BUG-13 (do the tenancy fix as part of unification). *(Source: 15)*
- [ ] **HYG-47 — Remove tracked dead files & the large unused asset trees** (P3, M) — A cluster of dead/oversized tracked artifacts: (a) orphan `gitignore` (no dot; dangerously ignores `prisma/migrations`), `prisma.config.ts.bak` (conflicting `engineType:"binary"`), and root `verify-seed.ts` — `git rm` all three; (b) stop tracking `tsconfig.tsbuildinfo` (`git rm --cached`; ignore rule already exists) so the phantom diff stops; (c) the unused `prisma/data/quill-standards/subjects/` shard tree (2,089 files) + ~19MB `_by_subject` blob + two methodology `.md`s (seed reads only the monolithic files) — confirm no producing pipeline then `git rm -r`; (d) the 29MB `src/server/data/counties_list.json` only used by the seed — move out of `src/` or add to deploy-ignore; (e) the unused `__dirname` computation in `next.config.js:1-5`, the `TIMEOUT_MS` constant in `seed-generator-content-types.ts:12`, and the empty `src/types/` barrel stub (`src/types/index.ts`). *(Source: 01, 03, 19, 90 — merged tracked-dead-file items)*
- [ ] **HYG-48 — Repair or delete the Prisma-7-broken seeds/scripts + clean seed cruft** (P3, S) — Several scripts build a bare `new PrismaClient()` with no driver adapter (throws under Prisma 7): `prisma/seed-book.ts` (orphan, no npm script — prefer delete) and `scripts/check-course-integrity.js` (debug artifact — delete or convert to the adapter pattern). Also convert `scripts/test-db.ts` from CommonJS `require("../src/server/db")` to an ESM `import` (it's type-checked in CI) and drop its engine-investigation logs / full-object dump; type the two `createMany` Json casts in `seed-catechisms.ts`/`seed-counties.ts` (`Prisma.<Model>CreateManyInput[]` instead of `as any`); rename `seed-discipleship.ts`/`db:seed:discipleship` to `seed-devotionals`/`db:seed:devotionals` (it seeds `Devotional`); make the generator-catalog seeder non-destructive (upsert-by-`code` instead of `deleteMany({})` so live `Resource.resourceKindId` FKs survive); make the `seed.ts` spine guard not mask a partial load (completeness detection instead of count>0); remove the vestigial `CacheTTL`/stale Accelerate JSDoc in `prisma-cache.ts`; decide the fate of the unused Supabase client layer (`lib/supabase/{client,server}.ts` — zero importers, RLS-unsafe). *(Source: 03, 01, 08 — merged seed/script hygiene)*
- [ ] **HYG-49 — Remove the dead auth components & unused enum values** (P3, S) — Delete the unused `authorized()` callback (`auth.config.ts:14-34`, never runs — NextAuth isn't wired as middleware) and the never-imported `SignInButton` (`sign-in-button.tsx`). Resolve the vestigial `UserRole.TEACHER`/`ADMIN` and `OrganizationType.MICROSCHOOL_COOP`/`CHURCH_PRIVATE_SCHOOL` enum values (app only ever writes `OWNER`/`PARENT`/`PARENT_INSTRUCTOR`; the `ADMIN` read in `safety-alert.ts:45` can never match) — remove via migration or document as planned. Collapse the duplicate `/login`+`/signup` pages into one shared component. *(Source: 04 — merged dead-auth items)*
- [ ] **HYG-50 — Remove dead context-engine surface** (P3, S) — Several dead artifacts in the context engine: delete the unused `ContextInspector.tsx` dev form (`:9`, no import sites, surfaces the IDOR in UI — do after SEC-1); hydrate or remove `bookPreferences` (always-empty titles/subjects, `master-context.ts:498-509,551-555`); remove the dead `whatStudentsCall` instructor field (covered by HYG-?? below); remove the never-produced `"enhancement"` suggestion branch (`context-types.ts:3`, `ContextCompleteness.tsx:53,57`); remove dead imports (`LibraryClient` in `ContextInspectorClient.tsx:6`, `Card*` in `context/page.tsx:7`); implement or remove the dead `modelType` serializer option (`context-serializer.ts:21,38`); replace `as any` hierarchy-walk casts with typed `Prisma.*GetPayload` selects (`master-context.ts:540,612,691,874,895`; `smart-defaults.ts:77`; `generate-tool.tsx:135`). *(Source: 06)*
- [ ] **HYG-51 — Resolve the `whatStudentsCall` schema/UI/context mismatch + the missing instructor `sex` input** (P3, S-M) — `whatStudentsCall` is collected by the Step-1 UI but has NO DB column, dropped on save and hardcoded `null` in Master Context (`master-context.ts:38,346`; `onboarding.ts:11`; `classroom-step.tsx:212-222`). `instructorSchema.sex` + the `ClassroomInstructor.sex` column exist but there's NO UI input, so `sex` never populates. For each: persist (add column/migration + UI input + write-through) or remove (drop from schema/UI). *(Source: 06, 13 — merged the `whatStudentsCall`/`sex` items)*
- [ ] **HYG-52 — Sweep remaining dead code & dead-data across feature subsystems** (P3, M) — A consolidated cleanup of per-subsystem dead surface confirmed by grep, each independent: **Courses** — `ResourcePicker`'s dead `loading` state (`:49`, gates never fire — use `isLoading`); unused `reorderBlocksSchema`/`createBlockSchema` in `actions.ts`; delete-or-wire `course-pacing.ts` (3 unused exports); stale `@ts-ignore` in `blocks/new/page.tsx:168`; no-op `bookId` "create from book" stub (`courses/new/page.tsx:49-52`); support PATCH of a block's `bookId`/`bookChapterId`. *(The `reorderBlocks` cross-org IDOR previously listed here has been re-filed as the standalone Phase 0 task **SEC-12**.)* **Planner** — server-only `getCurrentUserOrg` import in client `PlannerGrid.tsx:13`; unused `distributeCourseSchema` (wire it for validation); remove `(db as any)` casts on schedule models (the generated client DOES type them); the smart-slot `onGenerate` stub toast and BOOK smart-slot `// TODO: Add link`; the colon-parsing droppable-id fragility; unwritten lifecycle fields (`completedAt`/`isLocked`/recurrence); `SessionTimer` counts time-since-mount; planner header date range vs 7-day grid for non-Monday `?start`. **Students** — write-only `support_profile`/`support_intensity`; unused `rawQuestionnaireResponses`/`questionnaireVersion`; surface `suggestedSystemPrompt` in the panel; interests-step completeness gate; re-enable the `students` cache tag on create + revalidate on avatar save; `getStudentObjectives` strand-sample relabel; cosmetic Suspense boundaries; stale create/delete comments; `as any`→`StudentWithRelations`. **Dashboards** — leftover `// ... (auth checks) ...` comment, unused `studentsWithAssessment`/imports, double-default `classroomName`, learnerProfile over-fetch, `any` props, the partially-dead `StudentProfile` context API, pass `session` into `getCurrentUserOrg`, decide the divergent `/student/dashboard` route. **Compiler** — import `CURRICULUM_KIND_CODES` in `compile-curriculum.ts` instead of hardcoding the six strings; convert `CurriculumBundle.status` to an enum + add the `parentBundleId` FK; surface skipped optional artifacts; tighten `suggestCourseBlocks` session check; remove the dead `SpecForm.initialContext` prop; the two-`Bundle`-interface `as any` bridge. **Transcripts** — the `upsert where:{id:'new'}` duplicate-save bug; visible save-error toast; per-course narrative preview gate; printed-legend drift; fresh `gradingSettings:undefined`; per-year unweighted GPA; nav entry point; SSN cleartext; signature-capture/render-only fields; `deleteTranscript`/`isOfficial`/`getDefaultCoursesForGrade`/`validateCourse` dead; no-op effect/imports/`order`; the `(db as any)` index cast. **Discipleship** — `bible-memory.ts` cuid-validator schemas (delete), legacy prayer/verse actions in `family-discipleship/actions.ts`, `fetchUnreachedByCountry`, dead `startTransition`/`isPending` in `CountyIssuesLookup`, `hasGetInvolvedContent` always-true, counties-missing-fips key collision, cache Operation World stats, vendor the world GeoJSON, orphaned `createHeartCheckSchema`, devotional text-parsing/boxed-`String` types, `as any` page→component boundaries, `questionCount` flattened total, `heidelberg.json`-vs-`.ts` source ambiguity, cache `summarizeCommentary`, add `'use client'` to `InteractiveCatechism`, dead exports/imports in `bible-study.ts`, pervasive `any` in bible-memory/missions clients. **Shell** — delete the orphaned nav stack (`MainNav`/`CommandPalette`/`CreationDrawer`/`ContextNav`/`SidebarClientIslands`, incl. the dead ⌘K), the unused `lib/cache.ts`, the partially-adopted `lib/schemas/actions.ts` validation catalog (wire each consuming action's `safeParse` + replace `z.any()` for `avatarConfig`/`responses`), and audit the `getStudentAvatarUrl` external DiceBear dependency (see HYG-43). **Generators** — show the template `label` as the picker title; de-dupe the "Creation Station" `<h1>`/default tab; `WizardStep` dead type; `any`/`@ts-ignore` around the persisted `Resource` shape; image blob storage instead of inline base64 (pairs with BUG-6). **Course block hygiene** — fix the "Units" miscount label, relax the form Strand requirement, send `new:` topic/subtopic to the API, unify block `position` convention, enforce kind hierarchy on parent assignment, add Zod to `POST /api/courses` + scope `new:` taxonomy, drag-to-nest vs honest-tree, `window.location.reload()`→state refresh. **Data model** — `account_id`/`organization_id` indexes on tenant tables, `CurriculumBundle.status` enum (shared with Compiler), embedding-status column, `StudentCatechismProgress.catechismId` FK decision, camelCase column normalization, `Decimal(65,30)` right-sizing, org-teardown helper, pgvector `vector(1536)` + HNSW index, consolidate the three `getObjectives` helpers + remove false "with caching" comments + normalize the six curriculum routes + typed `PHILOSOPHY_PROMPTS` keys + `TopicSelector` cascade reset. **Auth hygiene** — `next-auth` module augmentation (typed `session.user.organizationId`), refresh `token.organizationId` after onboarding, type `getCurrentUserOrg`'s session param, re-evaluate `allowDangerousEmailAccountLinking` before a 2nd IdP, enforce-or-remove `deactivatedAt`, wire/remove `reactivateAccount`/`transferOwnership` (+ make `transferOwnership` atomic). **Thinkling/grading** — `alert()`→toasts + `router.refresh()` in `GradingInterface`; remove raw student-message `console.log`s from the chat route/component (privacy); add Inngest `step.run` idempotency to `scanMessage`; fail-closed on safety LLM error; fix the regex fast-path hardcoded target/relationship; decide the synchronous streaming guard + the `SUPPORTIVE_ONLY`/`STUDENT_OPTIONAL_OUTREACH` resolutions; remove dead `studentName`/query-param fallback/`Scales`/`recommendedResolution`; `as any` typing on the attempt query/props; dedupe `release_manifest` in the verification gate; harden the QA gate so a model failure doesn't silently pass weak content. — *Each bullet is a self-contained micro-task; split into tickets per subsystem as capacity allows.* *(Source: 06, 07, 08, 09, 10, 11, 12, 14, 16, 17, 18, 19, 20, 21, 02, 04 — consolidated residual P3 hygiene)*

> **Note on HYG-52.** This is a deliberately consolidated "residual hygiene" bucket so the runbook stays exhaustive without exploding into ~70 near-identical one-line dead-code tickets. The non-trivial or behavior-changing P3 items from each subsystem (e.g. the transcript `upsert:'new'` duplicate-save, the compiler `CURRICULUM_KIND_CODES` import, the `(db as any)` schedule casts, the orphaned nav stack, the pgvector index, the auth-augmentation) are called out explicitly within it and should each become their own ticket; the purely cosmetic dead-variable/import removals can be swept together per subsystem during the relevant feature work.

---

## Traceability — by subsystem

Maps each source doc to the task IDs sourced from it (a task appears under every doc it merges). Use
this to audit the runbook file-by-file against `.runbook-parts/`.

| Doc | Subsystem | Tasks sourced |
|---|---|---|
| 01 | Build, config, tooling & infra | HYG-1, HYG-3, HYG-4, HYG-7, HYG-8, HYG-9, HYG-11, HYG-31, HYG-47, HYG-48, HYG-53; BUG-1 |
| 02 | Data model (schema + migrations) | SEC-10, HYG-2, HYG-10, HYG-33, HYG-52 (indexes, `CurriculumBundle.status` enum, embedding-status, catechismId FK, camelCase, Decimal, org-teardown, pgvector) |
| 03 | DB layer, seeds & ops scripts | BUG-1, HYG-47, HYG-48 |
| 04 | Auth, tenancy, middleware, user/account | SEC-7, SEC-8; FEAT-1, FEAT-2; HYG-12, HYG-33, HYG-49, HYG-52 (next-auth augmentation, token refresh, `deactivatedAt`, reactivate/transferOwnership, `allowDangerousEmailAccountLinking`) |
| 05 | AI core | SEC-2; BUG-2; HYG-22, HYG-23, HYG-24, HYG-25, HYG-26, HYG-27, HYG-28; FEAT-24 (engines) |
| 06 | AI context engine | SEC-1, SEC-3; HYG-13, HYG-26, HYG-30, HYG-50, HYG-51, HYG-52 (`currentObjectives`/`learningDifficulties`, suggestion actionUrls); FEAT-? (resource-specific params, double `getMasterContext`, `getSectionType` — see HYG-50/52) |
| 07 | Academic spine & curriculum APIs | SEC-4; HYG-15, HYG-16, HYG-52 (consolidate `getObjectives`, false "with caching", normalize routes, typed `PHILOSOPHY_PROMPTS`, `TopicSelector` cascade) |
| 08 | Generators / Inkling Toolkit | FEAT-6, FEAT-7, FEAT-8, FEAT-24; BUG-2, BUG-3, BUG-4, BUG-5, BUG-6; HYG-14, HYG-15, HYG-19, HYG-24, HYG-48, HYG-52 (template label, dup title, `WizardStep`, `any` shape, image blob storage) |
| 09 | Curriculum Compiler | SEC-6; FEAT-9, FEAT-13; HYG-6, HYG-45, HYG-52 (`CURRICULUM_KIND_CODES`, status enum + `parentBundleId` FK, skipped artifacts, `suggestCourseBlocks` check, `initialContext`, `Bundle` types, dedupe manifest, QA gate) |
| 10 | Course builder, blocks, activities | SEC-12 (reorderBlocks cross-org IDOR + validation); FEAT-3, FEAT-4; HYG-52 (`new:` taxonomy, block position, kind hierarchy, `POST /api/courses` Zod, Strand requirement, "Units" label, `loading` state, unused schemas, `course-pacing.ts`, `@ts-ignore`, `bookId` stub, reload→refresh, PATCH book/chapter); BUG-? (deleteCourse call-shape — see cross-doc merge note / merged) |
| 11 | Planner & scheduling | FEAT-14; BUG-7, BUG-8, BUG-9, BUG-10, BUG-11; HYG-52 (client import, `distributeCourseSchema`, `(db as any)`, holidays, droppable-id, lifecycle fields, smart-slot stub/BOOK link, SessionTimer, header range) |
| 12 | Students & personality assessment | BUG-14, BUG-15, BUG-16, BUG-17, BUG-18; HYG-17, HYG-32, HYG-38, HYG-43, HYG-52 (support_profile, raw questionnaire, suggestedSystemPrompt panel, interests gate, cache tags, avatar revalidate, getStudentObjectives, Suspense, comments, `as any`) |
| 13 | Onboarding / Family Blueprint | FEAT-5, FEAT-22, FEAT-23; BUG-19, BUG-25; HYG-29, HYG-30, HYG-51, HYG-52 (`familyBlueprintSchema`/`coursesCount`/download form dead, alert→inline, `getCurrentUserOrg` typing) |
| 14 | Dashboards & home | FEAT-15; BUG-26; HYG-52 (placeholder comment, unused vars/imports, double-default, over-fetch, `any` props, StudentProfile context, pass `session`, `/student/dashboard` route) |
| 15 | Living Library & media | SEC-5; FEAT-10, FEAT-11, FEAT-12, FEAT-25; BUG-12, BUG-13, BUG-28; HYG-24, HYG-44, HYG-45, HYG-46 |
| 16 | Inkling Grading & attempts | SEC-2; FEAT-16, FEAT-17, FEAT-18; BUG-23, BUG-24; HYG-36, HYG-52 (`alert`→toasts, `any` typing, tests) |
| 17 | Transcripts & PDF export | HYG-52 (upsert:'new' duplicate-save, save-error toast, narrative gate, signature capture/validation, legend drift, `gradingSettings:undefined`, year unweighted GPA, nav entry, SSN, renderable-no-input fields, `deleteTranscript`/`isOfficial`/dead helpers/effect, `(db as any)`, server PDF) |
| 18 | Discipleship A (Bible/commentary/catechism/devotional) | BUG-20, BUG-21, BUG-22; FEAT-19, FEAT-20; HYG-18, HYG-52 (`'use client'`, dead exports, devotional parsing, `as any`, questionCount, heidelberg source, summarizeCommentary cache) |
| 19 | Discipleship B (memory/prayer/church/heart-check/missions/neighbor) | SEC-9; FEAT-12; BUG-20, BUG-27; HYG-19, HYG-38, HYG-52 (prayer category/date/tags/privacy persistence + reload, dead `bible-memory.ts`/legacy actions/`fetchUnreachedByCountry`/`startTransition`, `hasGetInvolvedContent`, fips key, cache stats, vendor GeoJSON, `createHeartCheckSchema`, `any` typing) |
| 20 | Thinkling chat & child-safety pipeline | SEC-11; FEAT-21, FEAT-26; HYG-20, HYG-22, HYG-37, HYG-52 (raw-message logging, `step.run` idempotency, fail-closed, regex target/relationship, streaming guard, `SUPPORTIVE_ONLY`/`STUDENT_OPTIONAL_OUTREACH`, dead `studentName`/fallback/`Scales`/`recommendedResolution`) |
| 21 | App shell, navigation & UI primitives | HYG-34, HYG-35, HYG-38, HYG-39, HYG-40, HYG-41, HYG-42, HYG-43, HYG-52 (orphaned nav stack, `lib/cache.ts`, `lib/schemas/actions.ts` catalog, DiceBear audit, smoke tests) |
| 90 | Addendum — vestigial `src/types/` barrel stub | HYG-47 |

**Cross-doc merges (deduplicated — appear once, listed under all sources):**

- `/api/health` "accelerate" label → **BUG-1** (docs 01, 03).
- Grading AI-feedback IDOR → **SEC-2** (docs 05, 16; indexed in 06's risk list).
- `deleteCourse({id})` call-shape bug (CourseList caller) → folded into **HYG-52 / BUG-set** (docs 10, 15 — same root; the `CourseList.tsx:65` call is fixed once). The **sibling `deleteArticle(article.id)` bug at a distinct call site** (`ArticleList.tsx:130`) is now its own task **BUG-28** (doc 15) — same bug class, different file, not covered by the `CourseList` fold-in.
- `reorderBlocks` cross-org block IDOR → **SEC-12** (doc 10) — re-filed out of the P3 HYG-52 Courses grab-bag into Phase 0 per the cross-tenant/IDOR ⇒ P0 audit rule.
- Dead `/auth/login` redirect → **FEAT-12** (docs 15 library hub, 19 prayer page — two call sites, one fix family). The separate **`ResourceList` filter push to the nonexistent `/library`** is **FEAT-25** (doc 15) — a distinct dead-route bug not covered by FEAT-12.
- Resend caregiver-safety email deliverability (verify `quillandcompass.app` sender domain) → **FEAT-26** (doc 20) — the P1 deliverability/child-safety item; HYG-37 only fixes the cosmetic `safety-alert.ts:22` docstring TLD.
- Next image `remotePatterns: hostname:'**'` SSRF/abuse surface → **HYG-53** (doc 01) — distinct from BUG-12 (`addArticle`/document fetch SSRF) and from the `next.config.js:1-5` dead-code in HYG-47.
- `getBibleText` raw-string bug → **BUG-20** (docs 18, 19).
- `calculateAge` dead helper + naive age calc → **HYG-26** (docs 05, 06).
- Quiz/worksheet schema divergence → **BUG-2**; two generation engines → **FEAT-24** (docs 05, 08).
- "Gemini 3 Pro" / "only model that processes YouTube" comment drift → **HYG-24** (docs 05, 08, 12, 15).
- Completeness-rubric reconcile + `ContextCompleteness`/`ContextInspector` naming → **HYG-30** (docs 06, 13).
- `whatStudentsCall` schema/UI/context mismatch → **HYG-51** (docs 06, 13).
- `account_id`↔organization naming / dual tenancy-column doc → **HYG-33** (docs 02, 04).
- No-tests / test-runner → **HYG-1** (every subsystem); `next build` in CI → **HYG-3** (doc 01).
- `prisma.config.ts.bak` removal & engine ambiguity → **HYG-47/HYG-48** (docs 01, 03).
- `scripts/test-db.ts` require→import → **HYG-48** (docs 01, 03).
