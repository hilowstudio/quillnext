# Profile System — Design Spec

> **Status:** Approved design (2026-06-18). Foundational epic; supersedes runbook **FEAT-2** and
> absorbs **FEAT-22** and **HYG-12**. Sequenced *before* FEAT-19/FEAT-20 and the student-dashboard
> work (HYG-52), with the orthogonal runbook work (BUG-\*, grounding, hygiene) proceeding in parallel.

## 1. Summary

Introduce a Netflix-style **profile** layer. After account login, the user lands on a **"Who's
learning today?"** picker and selects a **Profile**. Profiles are typed **PARENT** or **STUDENT**,
each optionally **PIN-protected**. The active profile's *type* decides what the session can do:

- **PARENT** → full access (everything), always; *plus* an optional **"My Learning"** area if that
  parent has enrolled themselves in courses. Never restricted.
- **STUDENT** → learner surfaces only (their courses, assignments, their family-discipleship suite).

A single human (one login) may have a PARENT profile **and** STUDENT profiles for their children.
A parent who wants to take their own courses does **not** get a second card — their one PARENT card
simply gains a "My Learning" area (see §10).

This replaces the never-wired instructor PIN with **per-profile PINs**, and establishes the seam for
a future **kid-view** UI without re-architecting later.

## 2. Goals / Non-goals

**Goals**
- A first-class `Profile` entity (typed, optionally PIN'd, with a `viewMode` for future kid-view).
- A profile **selection screen** after login; active profile persisted in a signed cookie.
- **Type-based authorization** layered onto the existing FEAT-1 proxy (PARENT = all; STUDENT =
  learner allowlist).
- **Per-profile PIN** verification + management (absorbs the FEAT-2/FEAT-22 PIN work).
- Allow a PARENT profile to *also* be a learner ("My Learning"), with **zero** loss of parent powers.
- A `viewMode` flag + a single UI branch point so the kid-view can be built later as a UI change.

**Non-goals (explicitly out of scope for this epic)**
- The full, redesigned **kid-view UI** (we ship only the `viewMode` seam).
- Building the student course-player route `/courses/[id]/learn` (a pre-existing gap; the allowlist
  reserves it for when it lands).
- Rebuilding **FEAT-19/FEAT-20** (per-student discipleship routing/guards) — those come *after* this
  foundation and build on the active-profile context.
- Multi-login-per-family / co-op shared learners (future; the model doesn't preclude it).

## 3. Domain model

Three concerns kept deliberately separate:

| Concept | Entity | Notes |
|---|---|---|
| Login / auth | `User` | Unchanged. NextAuth needs it. One per human who signs in (today: the parent). |
| Selectable identity | `Profile` (new) | The picker card: type, name, avatar, PIN, view-mode. Every family member has exactly one. |
| Learner data | `Learner` (today's `Student`) | Courses, progress, assessments, transcripts, schedule, discipleship, personality. Attached to a profile **only when that profile takes courses**. |

### 3.1 `Profile` (new)

```prisma
model Profile {
  id             String          @id @default(uuid())
  organizationId String          @map("account_id")
  type           ProfileType
  displayName    String          @map("display_name")
  avatarConfig   Json?           @map("avatar_config")
  pinHash        String?         @map("pin_hash")        // bcrypt; null = no PIN on this profile
  viewMode       ProfileViewMode @default(STANDARD) @map("view_mode")
  userId         String?         @map("user_id")         // the login this profile belongs to; null for child profiles
  isOwner        Boolean         @default(false) @map("is_owner") // the account owner's primary PARENT profile
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")

  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User?           @relation(fields: [userId], references: [id], onDelete: SetNull)
  learner        Learner?        // 1:(0..1) — present only if this profile is a learner

  @@index([organizationId])
  @@map("profiles")
}

enum ProfileType     { PARENT STUDENT }
enum ProfileViewMode { STANDARD KID }
```

### 3.2 `Learner` (rename of `Student`)

`Student` is renamed to `Learner` so an adult who takes a course isn't mislabeled. The learning-data
FKs (CourseStudent, AssessmentAttempt, Transcript, SafetyFlag, schedule items, catechism progress,
`LearnerProfile`, resource assignments, etc.) are **unchanged in shape** — they continue to point at
this table; only the table/model name changes. We add the back-link to `Profile` and relax the
kid-only fields so an adult learner fits.

```prisma
model Learner {
  id             String   @id @default(uuid())
  organizationId String   @map("account_id")     // kept for RLS
  profileId      String   @unique @map("profile_id") // NEW: 1:1 with its Profile
  firstName      String   @map("first_name")
  lastName       String?  @map("last_name")
  preferredName  String?  @map("preferred_name")
  birthdate      DateTime? @db.Date               // now optional (adult learners)
  sex            Sex?
  currentGrade   String?  @map("current_grade")   // now optional (adult learners)
  // ... existing fields unchanged ...
  profile        Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  // ... existing relations unchanged (renamed back-references only) ...
  @@map("learners")  // table renamed students -> learners
}
```

> **Decision flagged for review (§12.1):** the `Student → Learner` rename is the single
> highest-churn piece (mechanical sweep of `db.student`, `studentId` params, `Student` types,
> `StudentDashboard`/`getStudentAssignments`, etc.). Pre-launch with one account it is the *cheapest
> it will ever be*, but it is large. Alternative: keep the `Student` name, add only `profileId` +
> optional fields now, rename later. Recommendation: **rename now**, as an isolated, test-backed slice.

### 3.3 Relationships (worked example — the "Vega family")

- **Adam** (login `User`): `Profile{type:PARENT, isOwner:true, userId:Adam, pinHash:set}`. No `Learner`
  unless/until he enrolls himself.
- **Sam** (child): `Profile{type:STUDENT, userId:null}` ↔ `Learner{profileId:Sam-profile}`.
- **Mia** (child): same shape as Sam.
- **Adam-as-learner** (later, optional): a `Learner{profileId:Adam-profile}` is attached to Adam's
  *existing* PARENT profile — no new card.

## 4. Migration / backfill

Pre-launch (effectively one account), so the *data* migration is trivial; the work is schema + code.

1. Create `Profile`, `ProfileType`, `ProfileViewMode`.
2. Rename table `students → learners`; rename Prisma model `Student → Learner`; add `Learner.profileId`
   (nullable during migration, then required); make `birthdate`/`currentGrade` optional.
3. **Backfill:** for each `User` with role in (OWNER, PARENT, TEACHER, ADMIN) → create a `PARENT`
   profile (`displayName = user.name`, `isOwner = (role == OWNER)`, `userId = user.id`). For each
   existing learner row → create a `STUDENT` profile (`displayName = preferredName || firstName`,
   `avatarConfig` copied) and set `learner.profileId`.
4. **Move the PIN:** copy the existing `ClassroomInstructor.instructorPin` hash to the owner's PARENT
   profile `pinHash`; then drop `ClassroomInstructor.instructorPin` (it becomes vestigial). This
   closes **HYG-12** (PIN hash no longer exists on the exported instructor rows).
5. Add RLS policy for `profiles` (keyed on `account_id`, like every tenant table) and update the
   `learners` policy name. RLS stays ON (per the live cutover).

## 5. Active-profile session

- A signed (HMAC w/ `AUTH_SECRET`) **`active_profile`** cookie holds `{ profileId, type, issuedAt }`.
  The signature lets the proxy trust `type` without a DB hit; server actions re-fetch the profile for
  authoritative checks.
- **`getActiveProfile()`** server helper: verify cookie → load + org-scope the profile → return it (or
  `null`). Memoized per request (mirrors `getCurrentUserOrg`).
- **Idle expiry:** the cookie carries an idle timeout. PARENT profiles expire after ~15 min idle
  (re-prompt the picker/PIN — this folds in the FEAT-2 "timed unlock"); STUDENT profiles persist until
  "Switch Profile" or logout. (Exact windows are tunable; see §12.2.)
- **Switch Profile** clears the cookie → back to the picker.

## 6. Profile selection screen ("Who's learning today?")

- `/` renders the **picker only** when there is no valid active profile (open to any logged-in user —
  this is the "split homepage" decision). The picker lists the org's profiles.
- Selecting a profile: if it has a `pinHash`, prompt for the PIN (§9) → on success set `active_profile`
  and land on that profile's home; if no PIN, set the cookie immediately.
- Once a profile is active, `/` renders that profile's home: the **parent dashboard/overview** (for
  PARENT) or the **student dashboard** (for STUDENT). So a kid never sees parent overview content
  until a PARENT profile is selected (and PIN'd).

## 7. Authorization (extends the FEAT-1 proxy)

Tiers, evaluated in order in `src/proxy.ts`:

1. **Public** (logged out) — unchanged FEAT-1 allowlist.
2. **No active profile** (logged in) — allow only `/` (the picker) + `/select-profile` assets;
   everything else → redirect to the picker.
3. **Active profile = STUDENT** — allow the **learner allowlist**: `/` (their dashboard),
   `/courses/[id]/learn`, `/living-library/resource/[id]`, `/family-discipleship/**`,
   `/students/[id]/family-discipleship/**`, avatar customization. Everything else → redirect to the
   picker (to reach parent surfaces, switch profile + PIN).
4. **Active profile = PARENT** — allow everything.

Server-side defense-in-depth: destructive/admin actions (`deleteAccount`, profile management, etc.)
re-check `getActiveProfile()?.type === PARENT`, so the gate can't be bypassed by calling an action
directly. The carve-outs are **not clean prefixes** (e.g. `/courses/[id]/learn` open but `/courses/**`
gated), so the proxy uses ordered, specific allow-rules before the gate.

## 8. Per-profile PIN

- **`verifyProfilePin(profileId, pin)`** server action: `getCurrentUserOrg()` → load the org-scoped
  profile → `bcrypt.compare` against `pinHash` (never returns the hash) → set `active_profile` on
  success. **Rate-limited** (~5 attempts → 30s lockout) since the space is 4 digits.
- **Management** (PARENT-only): set / change / remove a profile's PIN. Schema: a shared
  `pinSchema = z.string().regex(/^\d{4}$/)`.
- **Onboarding:** the existing classroom-step PIN capture becomes "set the owner PARENT profile's
  PIN." Editing other profile info no longer forces PIN re-entry (closes **FEAT-22**).

## 9. Parent-as-learner ("My Learning")

- A PARENT profile may gain a `Learner` record (created on first self-enrollment, or via an explicit
  "Enroll myself" action). Enrollment reuses `CourseStudent` (now keyed to `Learner`).
- The parent dashboard shows a **"My Learning"** section iff `profile.learner` exists. This is purely
  additive content on a full-access profile — it adds an area, never removes a power. The STUDENT
  restrictions apply only to STUDENT-type profiles.
- Adult learners skip kid-only flows: no grade/birthdate requirement, no safety scanning, no
  personality wizard unless opted into. (`birthdate`/`currentGrade` optional per §3.2.)
- This slice can land slightly after the core foundation without blocking it.

## 10. Kid-view seam

- `Profile.viewMode` (`STANDARD | KID`). The student dashboard reads `viewMode` and branches at a
  single point; today both render the standard student UI (KID with a `TODO` marker). The future kid
  UI is then a contained UI change, not a re-architecture.

## 11. Slices & sequencing

Build in this order (each is independently testable):

1. **Data model + migration** (§3–4) — incl. the `Student→Learner` rename and PIN move.
2. **Active-profile session** (§5) — cookie + `getActiveProfile()`.
3. **Selection screen / split homepage** (§6).
4. **Type-based authorization** (§7) — proxy extension + action re-checks. *(Absorbs FEAT-2.)*
5. **Per-profile PIN management** (§8). *(Absorbs FEAT-22; the migration already closed HYG-12.)*
6. **Parent-as-learner "My Learning"** (§9) + **kid-view seam** (§10).

**Phase split** (to keep each implementation plan small enough to execute without context loss):
- **Phase A = slices 1–5** — the Profile/Learner model + migration, active-profile session,
  picker/split-homepage, type-based authorization, and per-profile PIN. This is the *complete*
  profiles-and-access system. (PIN is in Phase A because the gate needs it to protect the parent
  profile.) **We write and execute Phase A's plan first.**
- **Phase B = slice 6** — the additive parent-as-learner "My Learning" + kid-view seam, as a
  follow-on plan once Phase A lands.

After this epic: FEAT-19/20 and the student-dashboard/HYG-52 work build on the active-profile context.
Orthogonal runbook work (BUG-\*, grounding, hygiene) runs in parallel throughout.

## 12. Edge cases & decisions

- **Brand-new user (pre-onboarding):** onboarding creates the owner PARENT profile (+ its PIN).
- **Profile with no PIN:** selecting it doesn't prompt. We *recommend* (prompt at onboarding) that the
  owner PARENT profile has a PIN, so kids can't reach admin.
- **Kid → parent switch:** the picker requires the *target* profile's PIN, so a STUDENT session can't
  escalate to PARENT without it.
- **Deleting a profile** (PARENT-only): deleting a STUDENT profile cascades its `Learner` (and thus
  learning data) — guarded, with confirmation. The owner PARENT profile cannot be deleted.
- **`getActiveProfile()` with a stale/forged cookie:** signature fails → treated as no active profile
  → redirect to picker (fail-closed).

### 12.1 Decision — `Student → Learner` rename: **rename now** (recommended), as an isolated mechanical, test-backed slice. (Alternative: keep `Student`, add `profileId` only, rename later.)
### 12.2 Decision — PARENT idle timeout default **15 min** (tunable); STUDENT sessions persist until switch/logout.

## 13. Testing

- **Migration:** one PARENT profile per user, one STUDENT profile per learner, PIN copied to owner,
  `instructorPin` dropped; every learner row has a `profileId`.
- **Authorization (proxy):** STUDENT active → parent routes redirect to picker, learner allowlist
  passes; PARENT active → all pass; no active profile → only picker reachable.
- **`verifyProfilePin`:** correct PIN sets cookie; wrong rejected; foreign-org profile rejected;
  rate-limit triggers.
- **Active-profile cookie:** sign/verify/expiry; forged signature → fail-closed.
- **Parent-as-learner:** a PARENT profile with a `Learner` shows "My Learning" *and* retains full
  parent access (regression guard for the dual-role worry).

## 14. Risks & open questions

- **Rename churn** (§3.2 / §12.1) — large mechanical sweep; mitigated by doing it isolated + tests.
- **Proxy complexity** — the non-prefix carve-outs need careful ordering and tests; the student
  learner allowlist must be *complete* or kids get locked out of legitimate surfaces.
- **Edge runtime for the proxy** (existing HYG-5 question) — the proxy already runs `auth()`; adding a
  signed-cookie check is cheap and edge-safe, but the proxy's runtime is still unverified.
- **Discipleship surfaces** — `/family-discipleship/**` is student-open here; reconcile with the
  FEAT-1 decision (currently login-gated) when FEAT-19/20 land.
