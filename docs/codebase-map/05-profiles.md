# 05 — Profiles Subsystem
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope

| File | Role |
|---|---|
| `src/server/profiles/active-profile.ts` | Load/sign/clear the active-profile session (cookie-backed); `getActiveProfile` request-cache; `setActiveProfile`/`clearActiveProfile` cookie mutators. |
| `src/server/profiles/active-profile.test.ts` | Fail-closed unit tests for `loadActiveProfile` (8 cases). |
| `src/server/profiles/avatar-actions.ts` | `setProfileAvatar` server action — PIN-gated avatar write that syncs Profile + linked Learner. |
| `src/server/profiles/avatar-actions.test.ts` | Tests for org-scope, no-PIN, wrong-PIN, correct-PIN paths. |
| `src/server/profiles/backfill.ts` | Pure `buildProfileBackfill` planner (one PARENT/user, one STUDENT/learner). |
| `src/server/profiles/backfill.test.ts` | Tests owner-flagging, PIN copy, idempotency. |
| `src/server/profiles/guards.ts` | `assertParentProfile` defense-in-depth gate (OWNED here; summarized in 04). |
| `src/server/profiles/guards.test.ts` | Tests PARENT/STUDENT/null. |
| `src/server/profiles/ids.ts` | Deterministic `parentProfileId`/`studentProfileId` id factories. |
| `src/server/profiles/ids.test.ts` | Convention-lock test. |
| `src/server/profiles/my-learning.ts` | `getMyLearning` — parent-as-learner enrollments + available courses. |
| `src/server/profiles/pin-actions.ts` | `setProfilePin`/`removeProfilePin`/`verifyProfilePin` (bcrypt + throttle). |
| `src/server/profiles/pin-actions.test.ts` | Tests for all three PIN actions incl. lockout. |
| `src/server/profiles/pin-verify.ts` | `verifyPinWithThrottle` — the single shared shape→throttle→bcrypt verify (Q-05-002/003). |
| `src/server/profiles/pin-verify.test.ts` | Direct unit tests for the helper (shape-reject, lockout, record/clear). |
| `src/server/profiles/pin-reset.ts` | Owner PIN recovery (`requestOwnerPinReset`/`confirmOwnerPinReset`, email) + `resetChildPinWithParentPin` (parent-PIN-gated clear of a child's PIN). |
| `src/server/profiles/pin-reset.test.ts` | Tests: token-bound owner clear + Resend send + no-leak/no-config + child-reset (parent-PIN gate, STUDENT-only). |
| `src/server/profiles/pin-throttle.ts` | Pure throttle math + DB-backed check/record/clear (5 fails / 30s). |
| `src/server/profiles/pin-throttle.test.ts` | Pure-function tests for `evaluateThrottle`/`nextStateOnFailure`. |
| `src/server/profiles/profile-card.ts` | `toProfileCard` mapper — strips `pinHash`, exposes only `hasPin`. |
| `src/server/profiles/profile-card.test.ts` | Tests hash never leaks. |
| `src/server/profiles/queries.ts` | `listOrganizationProfiles` (picker cards) + `getLearnerIdForProfile`. |
| `src/app/select-profile/page.tsx` | Picker route — loads org profiles + pending assessments. |
| `src/app/select-profile/actions.ts` | `selectProfile`, `enterProfileManagement`, `enterAssessment`, `switchProfile`. |
| `src/app/select-profile/actions.test.ts` | Tests `selectProfile` PIN/throttle/org-scope. |
| `src/app/manage-profiles/page.tsx` | PARENT-gated PIN-management route. |
| `src/components/profile/AvatarCustomizer.tsx` | DiceBear `lorelei` avatar editor dialog (client). |
| `src/components/profile/ManageProfiles.tsx` | Per-profile Set/Change/Remove PIN UI (client). |
| `src/components/profile/ProfilePicker.tsx` | The picker: choose/PIN/avatar-edit/manage/assess flows (client). |
| `src/components/providers/StudentProfileProvider.tsx` | `?studentId` query-state context (parent-peek), NOT the active-profile session. |
| `src/components/navigation/ProfileSettingsDialog.tsx` | Account Settings dialog (NextAuth user, NOT a Profile). |
| `src/app/actions/my-learning.ts` | `enrollSelfInCourse` — lazily creates parent's Learner + enrollment. |
| `src/lib/schemas/pin.ts` | `pinSchema` — `^\d{4}$`. |
| `src/lib/profile-pin-reset-token.ts` | JWS sign/verify for the 15-min, single-purpose owner-PIN-reset link (Prisma-free). |
| `src/lib/profile-pin-reset-token.test.ts` | Sign/verify/expiry/tamper tests. |
| `src/app/select-profile/reset-pin/page.tsx` | Owner-PIN-reset landing — validates the token, renders the confirm step. |
| `src/app/select-profile/reset-pin/ResetPinConfirm.tsx` | Client confirm button — the click is what clears the PIN. |
| *(referenced, owned by 04)* `src/lib/active-profile-cookie.ts` | JWS sign/verify + cookie attrs; the cookie contract used here. |
| *(referenced, owned by 04)* `src/proxy.ts` | The Next 16 proxy — restamps the PARENT cookie (sliding idle, §3.3) + gates `/select-profile/*`. |

## 2. Purpose / intent
A homeschool org ("classroom") has one NextAuth login but several humans who use it: the account-owner parent, optional co-parents, and each student. The Profiles subsystem is a Netflix-style profile picker layered ON TOP of the single login. Each `Profile` (PARENT or STUDENT) gets an avatar, an optional 4-digit PIN, and a per-type session encoded in a signed `active_profile` cookie. PARENT profiles can administer the classroom; STUDENT profiles see only their own learner dashboard. "My Learning" lets a PARENT enroll themselves as an adult learner. A one-off backfill migrates legacy orgs (one User → one PARENT profile, one Learner → one STUDENT profile). This is the best-tested subsystem in the repo (10 test files, all I/O-mocked, pure logic isolated).

## 3. Architecture & key files
- **Cookie contract** lives in `src/lib/active-profile-cookie.ts` (owned by 04): HS256 JWS over `{profileId,type,uid,org}` + `iat`. `idleTtlMs` = 15 min for PARENT, ∞ for STUDENT. Cookie name `__Secure-active_profile` in prod (`active-profile-cookie.ts:73`), `httpOnly`+`lax`+`secure(prod)`+`domain .quillandcompass.app(prod)` (`:77-81`).
- **Session load** (`active-profile.ts`): `loadActiveProfile` is fail-closed at every step (auth → org → cookie → verify → uid/org binding → DB load → org match), wrapped in React `cache()` as `getActiveProfile` (`:75`). `activeProfileSelect` (`:15`) deliberately omits `pinHash`.
- **Session write** (`active-profile.ts:84`): `setActiveProfile` re-derives `uid`/`org` from the live session and signs; callers MUST pre-authorize. `clearActiveProfile` (`:100`) writes a `maxAge:0` cookie.
- **PIN engine**: `pin-throttle.ts` separates pure math (`evaluateThrottle`, `nextStateOnFailure`) from DB ops; `pin-actions.ts` composes bcrypt(10) + throttle + `assertParentProfile`. `verifyProfilePin` is deliberately NOT parent-gated (`pin-actions.ts:66`) so the picker can PIN-check avatar edits before any active profile exists. **The throttle→shape→bcrypt.compare→record/clear verify sequence lives in ONE place — `verifyPinWithThrottle` (`pin-verify.ts`)** — shared by `verifyProfilePin`, `selectProfile`, and `enterAsOwnerParent` (Q-05-002/003, Session 10). It shape-validates with `pinSchema` *after* the throttle gate (so a locked-out caller still gets "Too many attempts") but *before* bcrypt (so a malformed PIN never runs a compare).
- **PIN recovery** (Q-05-010, Session 10) — two paths, by who the locked-out profile is:
  - **Owner PARENT** (no one above them): `requestOwnerPinReset` (`pin-reset.ts`) emails the signed-in owner's **own verified Google email** a 15-min single-purpose JWS link (`profile-pin-reset-token.ts`) to `/select-profile/reset-pin`; `confirmOwnerPinReset` re-checks the token is bound to the same login+org, then clears the owner PARENT `pinHash`+throttle. Out-of-band factor = inbox possession (the shared family login can't distinguish owner-from-student). The reset route is nested under `/select-profile` precisely so the proxy's no-active-profile gate (`profileGateDecision`) lets a locked-out owner reach it.
  - **Child (STUDENT)** (a parent is the authority above them): `resetChildPinWithParentPin(childId, parentPin?)` verifies the org's owner PARENT PIN through the shared `verifyPinWithThrottle` (rate-limited; an owner with no PIN passes through), then clears the child's `pinHash`+throttle. STUDENT-only by `where:{type:"STUDENT"}` (a parent's own PIN never resets this way). No email — the parent is present.
- **Cards**: `profile-card.ts` `toProfileCard` is the single hash-stripping boundary; `queries.ts:listOrganizationProfiles` reads `pinHash` server-side only to compute `hasPin`.
- **Routing**: `app/page.tsx:22` gates on `getActiveProfile`; STUDENT → own learner dashboard with `viewMode` (`page.tsx:30`), PARENT → full dashboard + `getMyLearning` (`page.tsx:43`).
- **Backfill**: pure `backfill.ts` planner driven by the privileged script `scripts/backfill-profiles.ts` (postgres role, RLS bypass). The planner *can* copy an owner PIN, but the live script passes `ownerPinHashByOrg: {}` (`backfill-profiles.ts:57`, "instructor_pin dropped (HYG-12)"), so no PIN is copied at runtime — owner PINs are set during onboarding instead.

## 4. Data flow
**Picker → session (happy path):**
1. `select-profile/page.tsx:17` → `listOrganizationProfiles()` returns `ProfileCard[]` (no hash) → `ProfilePicker`.
2. User clicks a no-PIN card → `ProfilePicker.choose` (`ProfilePicker.tsx:49`) → `selectProfile(p.id)` (`actions.ts:21`).
3. `selectProfile` loads the profile org-scoped (`actions.ts:26`), verifies org match (`:36`), (PIN branch skipped), calls `setActiveProfile` (`:53`) which signs+sets the cookie (`active-profile.ts:93`), then `redirect("/")` (`actions.ts:54`).
4. `app/page.tsx:22` `getActiveProfile()` re-validates the cookie and renders the dashboard.

**PIN-gated select:** `ProfilePicker.submitPin` (`ProfilePicker.tsx:62`) → `selectProfile(id,pin)`. `actions.ts:41` throttle check → `bcrypt.compare` (`:45`) → on fail `recordProfilePinFailure` + `{ok:false}` (`:47-48`); on success `clearProfilePinThrottle` (`:50`) → cookie → redirect.

**Avatar edit from picker (PIN-gated, no active profile yet):** `ProfilePicker.startAvatarEdit` (`:120`) → if `hasPin`, `submitAvatarPin` calls `verifyProfilePin` (`:134`); on ok, opens `AvatarCustomizer` holding `avatarPin`; on save, `setProfileAvatar(id, config, pin)` (`:362`) → `avatar-actions.ts:27` re-verifies the PIN server-side then updates `Profile.avatarConfig` and the linked `Learner.avatarConfig` (`avatar-actions.ts:35-37`).

**Manage Profiles:** `ProfilePicker.startManage` (`:72`) → `enterProfileManagement(pin?)` (`actions.ts:99`) → `enterAsOwnerParent` PIN-checks the org's `isOwner` PARENT (`actions.ts:66`) → sets it active → `redirect("/manage-profiles")`. `manage-profiles/page.tsx:8` re-asserts PARENT, renders `ManageProfiles`, whose `submitPin`/`remove` call `setProfilePin`/`removeProfilePin` (both `assertParentProfile`-guarded).

**Assess-from-picker:** `enterAssessment(studentId,pin?)` (`actions.ts:111`) validates `studentId` charset (`:112`), then org-scope-verifies the learner exists (`learner.findFirst`, Q-05-004), becomes owner PARENT, `redirect(/students/${id}/assessment)`.

**My Learning:** `MyLearningCard` → `enrollSelfInCourse(courseId)` (`app/actions/my-learning.ts:17`) → `assertParentProfile` (`:18`) → lazily `learner.create` linked to the parent's profile (`:36`) → idempotent `courseStudent.create` (`:52`) → `revalidatePath("/")`. Read side: `getMyLearning` (`my-learning.ts:17`).

**Backfill:** `scripts/backfill-profiles.ts:9` swaps to `DIRECT_DATABASE_URL`, `:10` RLS off; per org reads users/learners/existing profiles + earliest user as owner (`:49`) → `buildProfileBackfill` (`:55`, with empty `ownerPinHashByOrg`) → `profile.create` (deterministic id) + `learner.update profileId` link.

**switchProfile / sign-out:** `AccountMenu` → `switchProfile()` (`actions.ts:119`) → `clearActiveProfile` + `redirect("/select-profile")`. Account Settings + Sign Out live in `ProfileSettingsDialog` (NextAuth `signOut`, `:344`).

**Forgot owner PIN (Q-05-010):** `ProfilePicker` "Forgot your parent PIN?" (shown when `owner.hasPin`) → `requestOwnerPinReset()` (`pin-reset.ts`) loads the org's owner PARENT, and if it has a PIN signs a 15-min token (`signPinResetToken`) and Resend-emails `${origin}/select-profile/reset-pin?token=…` to the session user's email (returns `ok` even with nothing to send, to avoid leaking). The owner opens the link → `reset-pin/page.tsx` validates the token (bound to this login+org) and renders `ResetPinConfirm`; the button → `confirmOwnerPinReset(token)` re-validates + `withTenant` clears the owner PARENT `pinHash`+`pinFailedCount`+`pinWindowStart` → owner returns to the picker (now no PIN) and sets a new one in Manage Profiles.

**Forgot child PIN (parent resets it):** in the child's PIN prompt (`pinFor.type==="STUDENT"`), "Forgot PIN? A parent can reset it." → `startChildReset` closes the child prompt and (if `owner.hasPin`) opens a "Enter your parent PIN to reset [child]'s PIN" dialog; submit → `resetChildPinWithParentPin(childId, parentPin)` verifies the owner PARENT PIN (`verifyPinWithThrottle`) then clears the child's `pinHash`+throttle → `toast` + `router.refresh()` (the child's lock badge disappears, they can now select with no PIN). If the owner has no PIN, the reset runs directly with no prompt (mirrors `startManage`/`startAssess`).

## 5. Status table
| Unit | Status | Evidence |
|---|---|---|
| `loadActiveProfile`/`getActiveProfile` | DONE | wired in `app/page.tsx:22`, `manage-profiles/page.tsx:8`, guards.ts:11. |
| `setActiveProfile`/`clearActiveProfile` | DONE | called from `select-profile/actions.ts:53,90,120`. |
| `setProfileAvatar` | DONE | `ProfilePicker.tsx:362`. |
| `buildProfileBackfill` | DONE (one-off) | driven by `scripts/backfill-profiles.ts:55`; EXPERIMENTAL runtime (admin script, not a route/job). |
| `assertParentProfile` | DONE | used by pin-actions, my-learning, transcript, course/student/account/resource actions (Grep §6). |
| `parentProfileId`/`studentProfileId` | DONE | backfill.ts:1, used in onboarding/add-learner per ids.ts header. |
| `getMyLearning` | DONE | `app/page.tsx:43`. |
| `setProfilePin`/`removeProfilePin` | DONE | `ManageProfiles.tsx:41,54`. |
| `verifyProfilePin` | DONE | `ProfilePicker.tsx:134`, `avatar-actions.ts:28`; now delegates to `verifyPinWithThrottle`. |
| `verifyPinWithThrottle` | DONE | the shared verify helper; called by `verifyProfilePin`, `selectProfile`, `enterAsOwnerParent` (Session 10). |
| `requestOwnerPinReset`/`confirmOwnerPinReset` | DONE | `ProfilePicker.tsx` (request) + `reset-pin/ResetPinConfirm.tsx` (confirm); Session 10. |
| `resetChildPinWithParentPin` | DONE | `ProfilePicker.tsx` child PIN prompt "Forgot PIN?"; parent-PIN-gated child-PIN clear (Session 10). |
| `signPinResetToken`/`verifyPinResetToken` | DONE | `pin-reset.ts` + `reset-pin/page.tsx`. |
| `pin-throttle` (all) | DONE | consumed by pin-verify + pin-throttle's own callers. |
| `toProfileCard` | DONE | `queries.ts:26`. |
| `listOrganizationProfiles` | DONE | `select-profile/page.tsx:17`, `manage-profiles/page.tsx:11`. |
| `getLearnerIdForProfile` | DONE | `app/page.tsx:27`. |
| `selectProfile`/`enterProfileManagement`/`enterAssessment`/`switchProfile` | DONE | ProfilePicker + AccountMenu. |
| `enrollSelfInCourse` | DONE | `MyLearningCard.tsx:26`. |
| `pinSchema` | DONE | `pin-actions.ts:7,27`. |
| `ProfilePicker`/`ManageProfiles`/`AvatarCustomizer` | DONE | routed/rendered (§6). |
| `StudentProfileProvider`/`useStudentProfile` | DONE | mounted in `app/layout.tsx`; drives `?studentId` parent-peek (separate from the active-profile session). |
| `ProfileSettingsDialog` | DONE | `AccountMenu.tsx:80` (the legacy `UserNav.tsx` consumer was deleted 2026-06-19 — ch.06 Q-06-003). |
| KID view branch | STUB | `StudentDashboard.tsx:39-41` — `if (viewMode==="KID")` falls through with a `TODO(kid-view)`; `viewMode` is plumbed end-to-end but renders identically. |

## 6. Integration points
- **Imports in:** `getCurrentUserOrg` (`@/lib/auth-helpers`), `withTenant`/`db` (`@/server/db`), `@/lib/active-profile-cookie` (sign/verify/cookie opts), `bcryptjs`, `jose` (cookie module + `profile-pin-reset-token`), `resend` (PIN-reset email, mirrors `safety-alert.ts`), `next/headers` (`requestOrigin`), `@dicebear/core`+`collection` (AvatarCustomizer), `nuqs` (StudentProfileProvider), `next-auth/react` (ProfileSettingsDialog).
- **Importers out:** `app/page.tsx` (getActiveProfile, getLearnerIdForProfile, getMyLearning), `app/layout.tsx` (StudentProfileProvider), `MyLearningCard`, `AccountMenu`, `StudentDashboard` (AvatarCustomizer + viewMode), and `assertParentProfile` consumers: `server/actions/transcript.ts`, `app/actions/{course,student,account,resource-library}-actions.ts`, `app/api/courses/[id]/blocks/[blockId]/route.ts`.
- **Env vars:** `AUTH_SECRET`/`NEXTAUTH_SECRET` (active-profile.ts:27 + the PIN-reset token), `NODE_ENV` (cookie prefix/secure + reset-link proto), `RESEND_API_KEY` + `ACCOUNT_EMAIL_FROM` (PIN-reset email), `DIRECT_DATABASE_URL`/`DATABASE_URL`/`RLS_ENABLED` (backfill script).
- **Prisma models:** `Profile` (pinHash, pinFailedCount, pinWindowStart, viewMode, isOwner, userId, avatarConfig), `Learner` (profileId 1:1, avatarConfig, courseEnrollments), `Course`/`Subject`, `CourseStudent`, `User`, `Organization`. See 02-data-model.md.
- **External APIs:** Resend (owner-PIN-reset email, Q-05-010). **Inngest jobs:** none.
- See 04-security-auth-tenancy.md for the cookie/RLS machinery and the canonical tenant gate.

## 7. Findings

Q-05-001  [MED]  ❌ DISMISSED 2026-06-19 (Session 10) — does NOT reproduce; the PARENT idle IS sliding. PARENT "idle" window is actually an absolute 15-min cap, not a sliding idle  — src/lib/active-profile-cookie.ts:63, src/server/profiles/active-profile.ts:95
  Evidence (original): `verifyActiveProfile` rejects when `now - iat*1000 > idleTtlMs(type)`, and `iat` is only set at sign time (`signActiveProfile`); the finding asserted "nothing re-signs the cookie on activity", so a continuously-active parent is bounced exactly 15 min after selecting the profile.
  Impact (original): UX/correctness drift — claimed the model is an absolute session lifetime, not an idle timeout.
  Status: ❌ DISMISSED — re-verified 2026-06-19 at the cited `file:line`: the claim is **false**. The proxy re-signs the PARENT cookie with a fresh `iat` whenever it is older than `RESTAMP_AFTER_SECONDS` (5 min) on any non-API page request (`proxy.ts:74-89`), so a continuously-active parent's `iat` advances → a genuine **sliding idle** (also documented in ch.04 §3.3:93 + §1:13). Server actions POST to page routes (run the proxy), so normal use restamps. The restamp predates the doc's own SHA (added in `ef686d9`, an ancestor of `b585c1e`), so the finding overlooked `proxy.ts`. The `active-profile.ts:95` comment ("PARENT idle is still enforced server-side via iat") is therefore **accurate**. Only a parent active >15 min via `/api/*` fetches *alone* (zero navigations/server-actions) would be bounced — contrived, and not the scenario the finding describes; no new finding raised. No code change. (see CHANGELOG.md)

Q-05-002  [MED]  ✅ RESOLVED 2026-06-19 (Session 10) — PIN shape is now validated server-side in the shared verify helper. `selectProfile` accepts a PIN with no shape validation; only avatar/pin-set paths use `pinSchema`  — src/app/select-profile/actions.ts:45
  Evidence: `selectProfile` and `enterAsOwnerParent` passed `pin` straight to `bcrypt.compare` with no `pinSchema.safeParse`; `setProfilePin` validated (`pin-actions.ts:27`) but the verify paths did not. The 4-digit constraint was only enforced client-side (`ProfilePicker` `slice(0,4)`). Re-verified 2026-06-19 (reproduced).
  Impact: low security risk (bcrypt.compare is safe), but an oversized/garbage `pin` still consumed a bcrypt compare + a throttle-failure write per attempt; no server-side guarantee the PIN is 4 digits.
  Status: ✅ resolved — the three verify paths now delegate to `verifyPinWithThrottle` (`src/server/profiles/pin-verify.ts`), which runs `pinSchema.safeParse` on every attempt: a non-4-digit PIN is rejected with "Incorrect PIN." and **records a throttle failure WITHOUT a bcrypt.compare** (closes the per-attempt compare cost), while a valid PIN keeps the exact prior throttle→compare→record/clear behavior + error strings. Adversarial-corrected order is gate → shape → compare (a locked-out caller still gets "Too many attempts"; garbage still counts toward the throttle, exactly as before). Realized impact was nearer LOW (bcrypt truncates input to 72 bytes; the 5/30s throttle caps cost) but it is resolved outright. Covered by `pin-verify.test.ts`. Bundled with Q-05-003. (see CHANGELOG.md)

Q-05-003  [LOW]  ✅ RESOLVED 2026-06-19 (Session 10) — triplication collapsed into one shared helper (bundled with Q-05-002). Duplicated PIN-verify-with-throttle logic across `verifyProfilePin` and the two select-profile actions  — src/app/select-profile/actions.ts:40-51, :77-88; src/server/profiles/pin-actions.ts:79-87
  Evidence: `selectProfile` and `enterAsOwnerParent` each re-implemented the exact throttle→bcrypt.compare→record/clear sequence that `verifyProfilePin` already encapsulated, instead of calling it — three copies. Re-verified 2026-06-19 (reproduced).
  Impact: drift risk — a future change to the throttle policy or error message had to be made in three places; one was already missed (only `setProfilePin` validated `pinSchema` — the separate MED Q-05-002).
  Status: ✅ resolved — `verifyPinWithThrottle(profileId, organizationId, pinHash, pin)` (`src/server/profiles/pin-verify.ts`) is now the single source of truth for the throttle→shape→bcrypt.compare→record/clear sequence; `verifyProfilePin` + `selectProfile` + `enterAsOwnerParent` all call it (shape (b): reuse the already-fetched `pinHash`, no double-fetch). Direct unit test added (`pin-verify.test.ts`); the existing suites are unchanged (they now `vi.mock("server-only")` since they transitively import the new module). LOW 63 → 62. (see CHANGELOG.md)

Q-05-004  [LOW]  ✅ RESOLVED 2026-06-19 (Session 9) — added an org-scoped learner existence check before the redirect. `enterAssessment` redirect-path injection is blocked, but only by a regex, with no existence/ownership check before redirect  — src/app/select-profile/actions.ts:111-116
  Evidence: `studentId` was charset-validated (`/^[A-Za-z0-9_-]+$/`) then interpolated into `redirect(/students/${studentId}/assessment)` without confirming the id is a real in-org Learner. (Verified 2026-06-19: the destination page `students/[id]/assessment/page.tsx` does NO check; enforcement is downstream at `POST /api/students/[id]/assessment` route.ts:38-42.)
  Impact: low — the charset guard prevents path traversal/smuggling and the assessment API enforces tenancy on submit (no cross-tenant exposure); worst case was a redirect to an empty wizard for a well-formed bogus id.
  Status: ✅ resolved — `enterAssessment` now resolves the caller's org and `withTenant`-checks `learner.findFirst({ id: studentId, organizationId })` before becoming the owner PARENT; a bogus id returns `{ ok:false, "Invalid student." }` without setting the parent session. Covered by 3 new tests in `select-profile/actions.test.ts`. (see CHANGELOG.md)

Q-05-005  [LOW]  ✅ ACCEPTED 2026-06-19 (Session 9) — owner: correct-by-design; won't-fix. `setProfileAvatar` lets ANY org member overwrite ANY profile's avatar (no PIN required for unprotected profiles, no parent gate)  — src/server/profiles/avatar-actions.ts:12-30
  Evidence: The action's only authorization is org membership (`getCurrentUserOrg` + org match) plus a PIN check *iff* the target has a PIN. A STUDENT session (or any signed-in org user) can overwrite an unprotected sibling's or the parent's avatar; the docstring explicitly says "Anyone in the org may edit (it's cosmetic)".
  Impact: low (cosmetic, in-tenant), an intentional authz relaxation. Re-verified 2026-06-19: the sole caller is the pre-active-profile picker (`ProfilePicker.tsx:362`), where a PARENT assertion is **structurally impossible** (no active profile yet — same reason `verifyProfilePin` is not parent-gated, pin-actions.ts:62-66); writes are in-tenant (org-match :25), cosmetic, reversible, and any profile can opt into the rate-limited PIN path by setting a PIN.
  Status: ✅ accepted (correct-by-design; closes & decrements) — no code change; `avatar-actions.test.ts` already pins the four-case contract (cross-org reject / no-PIN / wrong-PIN / PIN-verified). Entry kept for the audit trail. (see CHANGELOG.md)

Q-05-006  [LOW]  ✅ RESOLVED 2026-06-19 (Session 9) — owner: fix all consumers now. My-Learning creates a `Learner` for the PARENT that other org-wide learner queries may surface as a "student"  — src/app/actions/my-learning.ts:36-44
  Evidence: `enrollSelfInCourse` does `learner.create` with `profileId = active.id` (the PARENT profile) and only `firstName`/`avatarConfig`. This adult learner has no birthdate/grade/safety/personality, but it is a normal `Learner` row in the org. **Audit (2026-06-19) CONFIRMED the leak is real, not hypothetical:** real students always get a STUDENT `Profile` (api/students/route.ts:74-85 + the backfill) and a `learnerProfile` assessment row, so a parent-learner (`profile.type === PARENT`, `learnerProfile === null`) is distinguishable — yet every org-wide consumer filtered only by `organizationId`. The sharpest symptom: `listStudentsNeedingAssessment` (students.ts:213-216, `learnerProfile: {is:null}`) matched the parent-learner and surfaced it on the picker's "needs a personality assessment" nudge (`select-profile/page.tsx:33`).
  Impact: data-model drift — the self-enrolled parent appeared in `/students`, the parent dashboard student list, the "needs assessment" nudge, and student counts.
  Status: ✅ resolved — added a shared `excludeParentLearners` where-fragment (`src/server/queries/learner-filters.ts`, `NOT: { profile: { is: { type: "PARENT" } } }` — preserves null-profile legacy students; unit-tested) and applied it to all 12 student-facing roster/count queries: `students.ts:listStudentsNeedingAssessment`, `dashboard.ts:getParentDashboardData`, `students/page.tsx`, `context-suggestions.ts`, `blueprint/page.tsx` (×2 counts), `thinkling/page.tsx`, `grading/page.tsx`, `living-library/page.tsx`, `transcripts/page.tsx`, `smart-defaults.ts`, `student/dashboard/page.tsx` (orphaned route, applied for uniformity). **Deliberate carve-outs (NOT filtered):** `data-export.ts` (data-sovereignty — the parent's own learner data must export) and `getMyLearning` (the parent's OWN My-Learning view, which fetches by `profileId` not an org roster); point-lookups-by-id are untouched. (see CHANGELOG.md)

Q-05-008  [INFO]  ✅ ACCEPTED 2026-06-19 — owner: a 30s same-org lockout is negligible; won't-fix (revisit at co-parent scale). Throttle is per-profile global, not per-IP/session; a denial-of-access vector exists  — src/server/profiles/pin-throttle.ts:25-32
  Evidence: `checkProfilePinThrottle` keys solely on `profileId`+`organizationId`. Any org member (or anyone who can reach the action) submitting 5 wrong PINs in 30s locks that profile for everyone for the rest of the window.
  Impact: low — bounded to 30s and same-org, but a sibling student could repeatedly lock a parent out of the picker. Acceptable for a family product; documented for completeness.
  Status: documented (not fixed)

Q-05-009  [INFO]  Backfill planner's owner-PIN-copy branch is dead at runtime — the live script never supplies a hash  — src/server/profiles/backfill.ts:39, src/app/../scripts/backfill-profiles.ts:57
  Evidence: `buildProfileBackfill` sets `pinHash: isOwner ? (opts.ownerPinHashByOrg[org] ?? null) : null` (`backfill.ts:39`), exercised by `backfill.test.ts:29`. But the only caller passes `ownerPinHashByOrg: {}` (`backfill-profiles.ts:57`, comment "instructor_pin dropped (HYG-12); owner PIN now set at onboarding"), so every created PARENT profile gets `pinHash: null`. The PIN-copy path is tested but unreachable in production.
  Impact: none functionally (owner PIN is now captured at onboarding); noting the planner-vs-runtime divergence so a future reader does not assume the backfill seeds PINs.
  Status: documented (not fixed)

Q-05-010  [MED]  ✅ RESOLVED 2026-06-19 (Session 10) — built an email-verified owner-PIN reset (owner: "build it now, RESEND is configured"). No in-app recovery for a forgotten PARENT PIN — owner lockout risk  — src/server/profiles/pin-actions.ts:25,46; src/app/actions/account-actions.ts
  Evidence: the only PIN mutations were `setProfilePin`/`removeProfilePin` (pin-actions.ts:25,46), BOTH gated by `assertParentProfile` — i.e. they require already being in the PARENT profile, which the PIN itself gates. The owner PIN is set at onboarding (`saveClassroomStep`). There was no "forgot PIN" / email-reset flow anywhere; account-actions.ts has deactivate/delete/transferOwnership but no PIN reset.
  Impact: if the sole owner-parent forgot their PIN, they were locked out of all parent-only features with no in-app recovery (only a direct DB clear of `profiles.pin_hash`).
  Status: ✅ resolved — added a "Forgot your parent PIN?" affordance on the picker (`ProfilePicker.tsx`, shown when the owner has a PIN). It calls `requestOwnerPinReset` (`src/server/profiles/pin-reset.ts`), which emails the **signed-in owner's own verified Google email** (via Resend) a 15-min, single-purpose link (`signPinResetToken`, `src/lib/profile-pin-reset-token.ts`) to `/select-profile/reset-pin` (nested under select-profile so the proxy lets a profile-less owner reach it — `isSelectProfilePath`). The reset page only **validates** the token; an explicit button calls `confirmOwnerPinReset`, which re-checks the token is bound to the same login+org and clears `pinHash` + throttle counters for the org's owner PARENT (so a prefetch/scan GET can't consume it). The out-of-band factor is **inbox possession** — the shared family login cannot prove owner-vs-student, so the email is the second factor. New files: `pin-reset.ts` (+test), `profile-pin-reset-token.ts` (+test), `reset-pin/{page,ResetPinConfirm}.tsx`; new env `ACCOUNT_EMAIL_FROM` (falls back to Resend's test sender). **Companion capability (same session, owner-requested):** a locked-out **child** PIN is recovered differently — `resetChildPinWithParentPin` (`pin-reset.ts`) lets a parent clear a STUDENT profile's PIN from the picker by entering the **parent PIN** (rate-limited via `verifyPinWithThrottle`; STUDENT-only), no email. (see CHANGELOG.md)
