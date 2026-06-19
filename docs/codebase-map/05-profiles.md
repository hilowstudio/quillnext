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
| *(referenced, owned by 04)* `src/lib/active-profile-cookie.ts` | JWS sign/verify + cookie attrs; the cookie contract used here. |

## 2. Purpose / intent
A homeschool org ("classroom") has one NextAuth login but several humans who use it: the account-owner parent, optional co-parents, and each student. The Profiles subsystem is a Netflix-style profile picker layered ON TOP of the single login. Each `Profile` (PARENT or STUDENT) gets an avatar, an optional 4-digit PIN, and a per-type session encoded in a signed `active_profile` cookie. PARENT profiles can administer the classroom; STUDENT profiles see only their own learner dashboard. "My Learning" lets a PARENT enroll themselves as an adult learner. A one-off backfill migrates legacy orgs (one User → one PARENT profile, one Learner → one STUDENT profile). This is the best-tested subsystem in the repo (10 test files, all I/O-mocked, pure logic isolated).

## 3. Architecture & key files
- **Cookie contract** lives in `src/lib/active-profile-cookie.ts` (owned by 04): HS256 JWS over `{profileId,type,uid,org}` + `iat`. `idleTtlMs` = 15 min for PARENT, ∞ for STUDENT. Cookie name `__Secure-active_profile` in prod (`active-profile-cookie.ts:73`), `httpOnly`+`lax`+`secure(prod)`+`domain .quillandcompass.app(prod)` (`:77-81`).
- **Session load** (`active-profile.ts`): `loadActiveProfile` is fail-closed at every step (auth → org → cookie → verify → uid/org binding → DB load → org match), wrapped in React `cache()` as `getActiveProfile` (`:75`). `activeProfileSelect` (`:15`) deliberately omits `pinHash`.
- **Session write** (`active-profile.ts:84`): `setActiveProfile` re-derives `uid`/`org` from the live session and signs; callers MUST pre-authorize. `clearActiveProfile` (`:100`) writes a `maxAge:0` cookie.
- **PIN engine**: `pin-throttle.ts` separates pure math (`evaluateThrottle`, `nextStateOnFailure`) from DB ops; `pin-actions.ts` composes bcrypt(10) + throttle + `assertParentProfile`. `verifyProfilePin` is deliberately NOT parent-gated (`pin-actions.ts:66`) so the picker can PIN-check avatar edits before any active profile exists.
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

**Assess-from-picker:** `enterAssessment(studentId,pin?)` (`actions.ts:111`) validates `studentId` charset (`:112`), becomes owner PARENT, `redirect(/students/${id}/assessment)`.

**My Learning:** `MyLearningCard` → `enrollSelfInCourse(courseId)` (`app/actions/my-learning.ts:17`) → `assertParentProfile` (`:18`) → lazily `learner.create` linked to the parent's profile (`:36`) → idempotent `courseStudent.create` (`:52`) → `revalidatePath("/")`. Read side: `getMyLearning` (`my-learning.ts:17`).

**Backfill:** `scripts/backfill-profiles.ts:9` swaps to `DIRECT_DATABASE_URL`, `:10` RLS off; per org reads users/learners/existing profiles + earliest user as owner (`:49`) → `buildProfileBackfill` (`:55`, with empty `ownerPinHashByOrg`) → `profile.create` (deterministic id) + `learner.update profileId` link.

**switchProfile / sign-out:** `AccountMenu` → `switchProfile()` (`actions.ts:119`) → `clearActiveProfile` + `redirect("/select-profile")`. Account Settings + Sign Out live in `ProfileSettingsDialog` (NextAuth `signOut`, `:344`).

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
| `verifyProfilePin` | DONE | `ProfilePicker.tsx:134`, `avatar-actions.ts:28`. |
| `pin-throttle` (all) | DONE | consumed by pin-actions + select-profile/actions. |
| `toProfileCard` | DONE | `queries.ts:26`. |
| `listOrganizationProfiles` | DONE | `select-profile/page.tsx:17`, `manage-profiles/page.tsx:11`. |
| `getLearnerIdForProfile` | DONE | `app/page.tsx:27`. |
| `selectProfile`/`enterProfileManagement`/`enterAssessment`/`switchProfile` | DONE | ProfilePicker + AccountMenu. |
| `enrollSelfInCourse` | DONE | `MyLearningCard.tsx:26`. |
| `pinSchema` | DONE | `pin-actions.ts:7,27`. |
| `ProfilePicker`/`ManageProfiles`/`AvatarCustomizer` | DONE | routed/rendered (§6). |
| `StudentProfileProvider`/`useStudentProfile` | DONE | mounted in `app/layout.tsx`; drives `?studentId` parent-peek (separate from the active-profile session). |
| `ProfileSettingsDialog` | DONE | `UserNav.tsx:71`, `AccountMenu.tsx:80`. |
| KID view branch | STUB | `StudentDashboard.tsx:39-41` — `if (viewMode==="KID")` falls through with a `TODO(kid-view)`; `viewMode` is plumbed end-to-end but renders identically. |

## 6. Integration points
- **Imports in:** `getCurrentUserOrg` (`@/lib/auth-helpers`), `withTenant`/`db` (`@/server/db`), `@/lib/active-profile-cookie` (sign/verify/cookie opts), `bcryptjs`, `jose` (via cookie module), `@dicebear/core`+`collection` (AvatarCustomizer), `nuqs` (StudentProfileProvider), `next-auth/react` (ProfileSettingsDialog).
- **Importers out:** `app/page.tsx` (getActiveProfile, getLearnerIdForProfile, getMyLearning), `app/layout.tsx` (StudentProfileProvider), `MyLearningCard`, `AccountMenu`/`UserNav`, `StudentDashboard` (AvatarCustomizer + viewMode), and `assertParentProfile` consumers: `server/actions/transcript.ts`, `app/actions/{course,student,account,resource-library}-actions.ts`, `app/api/courses/[id]/blocks/[blockId]/route.ts`.
- **Env vars:** `AUTH_SECRET`/`NEXTAUTH_SECRET` (active-profile.ts:27), `NODE_ENV` (cookie prefix/secure), `DIRECT_DATABASE_URL`/`DATABASE_URL`/`RLS_ENABLED` (backfill script).
- **Prisma models:** `Profile` (pinHash, pinFailedCount, pinWindowStart, viewMode, isOwner, userId, avatarConfig), `Learner` (profileId 1:1, avatarConfig, courseEnrollments), `Course`/`Subject`, `CourseStudent`, `User`, `Organization`. See 02-data-model.md.
- **External APIs:** none. **Inngest jobs:** none.
- See 04-security-auth-tenancy.md for the cookie/RLS machinery and the canonical tenant gate.

## 7. Findings

Q-05-001  [MED]  PARENT "idle" window is actually an absolute 15-min cap, not a sliding idle  — src/lib/active-profile-cookie.ts:63, src/server/profiles/active-profile.ts:95
  Evidence: `verifyActiveProfile` rejects when `now - iat*1000 > idleTtlMs(type)`, and `iat` is only set at sign time (`signActiveProfile`); nothing re-signs the cookie on activity. The comment at `active-profile.ts:95` claims "PARENT idle is still enforced server-side via iat", but iat never advances, so a continuously-active parent is forcibly bounced to the picker exactly 15 min after selecting the profile.
  Impact: UX/correctness drift — the security model is an absolute session lifetime, not idle timeout. Not a leak, but the comment misrepresents behavior and parents will be re-prompted mid-session.
  Status: documented (not fixed)

Q-05-002  [MED]  `selectProfile` accepts a PIN with no shape validation; only avatar/pin-set paths use `pinSchema`  — src/app/select-profile/actions.ts:45
  Evidence: `selectProfile` and `enterAsOwnerParent` pass `pin` straight to `bcrypt.compare` with no `pinSchema.safeParse`. `setProfilePin` validates (`pin-actions.ts:27`) but the verify paths do not. The 4-digit constraint is only enforced client-side (`ProfilePicker` `slice(0,4)`).
  Impact: low security risk (bcrypt.compare is safe), but an oversized/garbage `pin` still consumes a bcrypt compare + a throttle-failure write per attempt; no server-side guarantee the PIN is 4 digits. Minor input-validation gap and a tiny DoS surface (unbounded compare cost).
  Status: documented (not fixed)

Q-05-003  [LOW]  Duplicated PIN-verify-with-throttle logic across `verifyProfilePin` and the two select-profile actions  — src/app/select-profile/actions.ts:40-51, :77-88; src/server/profiles/pin-actions.ts:79-87
  Evidence: `selectProfile` and `enterAsOwnerParent` each re-implement the exact throttle→bcrypt.compare→record/clear sequence that `verifyProfilePin` already encapsulates, instead of calling it. Three copies of the same control flow.
  Impact: drift risk — a future change to the throttle policy or error message must be made in three places; one was already missed (only `setProfilePin` validates `pinSchema`).
  Status: documented (not fixed)

Q-05-004  [LOW]  `enterAssessment` redirect-path injection is blocked, but only by a regex, with no existence/ownership check before redirect  — src/app/select-profile/actions.ts:111-116
  Evidence: `studentId` is charset-validated (`/^[A-Za-z0-9_-]+$/`) then interpolated into `redirect(/students/${studentId}/assessment)` without confirming the id is a real in-org Learner. The destination route is responsible for org-scoping.
  Impact: low — the charset guard prevents path traversal/smuggling, and the target page must enforce tenancy; but the picker will redirect to a 404/empty assessment for any well-formed bogus id. Defense-in-depth would verify the learner here.
  Status: documented (not fixed)

Q-05-005  [LOW]  `setProfileAvatar` lets ANY org member overwrite ANY profile's avatar (no PIN required for unprotected profiles, no parent gate)  — src/server/profiles/avatar-actions.ts:12-30
  Evidence: The action's only authorization is org membership (`getCurrentUserOrg` + org match) plus a PIN check *iff* the target has a PIN. A STUDENT session (or any signed-in org user) can overwrite an unprotected sibling's or the parent's avatar; the docstring explicitly says "Anyone in the org may edit (it's cosmetic)".
  Impact: low (cosmetic, in-tenant), but it is an intentional authz relaxation worth recording — there is no parent gate and no rate-limit on the no-PIN path.
  Status: documented (not fixed)

Q-05-006  [LOW]  My-Learning creates a `Learner` for the PARENT that other org-wide learner queries may surface as a "student"  — src/app/actions/my-learning.ts:36-44
  Evidence: `enrollSelfInCourse` does `learner.create` with `profileId = active.id` (the PARENT profile) and only `firstName`/`avatarConfig`. This adult learner has no birthdate/grade/safety/personality, but it is a normal `Learner` row in the org. Whether parent-learners are excluded from dashboards/transcripts/rosters depends on those queries filtering by linked profile type (not enforced here).
  Impact: potential data-model drift — adult learners could leak into student rosters, completeness metrics, or transcripts unless every consumer filters them out. Verify in chapters owning those queries.
  Status: documented (not fixed)

Q-05-008  [INFO]  ✅ ACCEPTED 2026-06-19 — owner: a 30s same-org lockout is negligible; won't-fix (revisit at co-parent scale). Throttle is per-profile global, not per-IP/session; a denial-of-access vector exists  — src/server/profiles/pin-throttle.ts:25-32
  Evidence: `checkProfilePinThrottle` keys solely on `profileId`+`organizationId`. Any org member (or anyone who can reach the action) submitting 5 wrong PINs in 30s locks that profile for everyone for the rest of the window.
  Impact: low — bounded to 30s and same-org, but a sibling student could repeatedly lock a parent out of the picker. Acceptable for a family product; documented for completeness.
  Status: documented (not fixed)

Q-05-009  [INFO]  Backfill planner's owner-PIN-copy branch is dead at runtime — the live script never supplies a hash  — src/server/profiles/backfill.ts:39, src/app/../scripts/backfill-profiles.ts:57
  Evidence: `buildProfileBackfill` sets `pinHash: isOwner ? (opts.ownerPinHashByOrg[org] ?? null) : null` (`backfill.ts:39`), exercised by `backfill.test.ts:29`. But the only caller passes `ownerPinHashByOrg: {}` (`backfill-profiles.ts:57`, comment "instructor_pin dropped (HYG-12); owner PIN now set at onboarding"), so every created PARENT profile gets `pinHash: null`. The PIN-copy path is tested but unreachable in production.
  Impact: none functionally (owner PIN is now captured at onboarding); noting the planner-vs-runtime divergence so a future reader does not assume the backfill seeds PINs.
  Status: documented (not fixed)

Q-05-010  [MED]  No in-app recovery for a forgotten PARENT PIN — owner lockout risk  — src/server/profiles/pin-actions.ts:25,46; src/app/actions/account-actions.ts
  Evidence: the only PIN mutations are `setProfilePin`/`removeProfilePin` (pin-actions.ts:25,46), BOTH gated by `assertParentProfile` — i.e. they require already being in the PARENT profile, which the PIN itself gates. The owner PIN is set at onboarding (`saveClassroomStep`). There is no "forgot PIN" / email-reset flow anywhere (grep). account-actions.ts has deactivate/delete/transferOwnership but no PIN reset.
  Impact: if the sole owner-parent forgets their PIN, they are locked out of all parent-only features with no in-app recovery (only a direct DB clear of `profiles.pin_hash`). Recommend an email-verified reset (NextAuth/Google identity is already verified). Raised 2026-06-19 from the Q-05-008 owner question.
  Status: documented (not fixed) — owner to decide whether to build recovery
