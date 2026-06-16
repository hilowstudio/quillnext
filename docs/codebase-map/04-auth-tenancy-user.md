# 04 — Auth, Tenancy, Middleware & User/Account

> Code-truth reference. Verified against source on the `main` branch. Where this
> doc and any prose/markdown in the repo disagree, **the code wins**. Citations
> are `path:line`.

## Purpose & role in the app

This subsystem is the front door and the multi-tenant boundary of QuillNext
("Quill & Compass"). It does four things:

1. **Authentication** — Auth.js (NextAuth) v5 with **Google OAuth as the only
   provider**, JWT session strategy, backed by the Prisma adapter
   (`src/auth.ts`).
2. **Route protection** — a Next.js 16 edge **proxy** (the renamed
   `middleware`) plus per-page `auth()` calls (`src/proxy.ts`, plus every
   server page/route/action).
3. **Tenancy gate** — `getCurrentUserOrg()` is the canonical helper that turns a
   session into `{ userId, organizationId }`, and almost every org-scoped query
   in the app funnels through it (`src/lib/auth-helpers.ts`, 55+ call sites).
4. **User & account lifecycle** — profile edit, deactivate/reactivate, full
   account+org deletion, ownership transfer, and a GDPR-style data export
   (`src/app/actions/*`).

The tenant model is: one `User` belongs to (at most) one `Organization` via
`User.organizationId`. Nearly every business model (`Student`, `Course`,
`Resource`, `Classroom`, `Transcript`, library items, …) carries
`organizationId` and is filtered by it. There is **no `Membership`/join table**
— it is strictly one user → one org (and one org → many users).

---

## File-by-file reference

### `src/auth.ts` — Auth.js instance (server, Node runtime)
- **Role:** The real Auth.js entry point. Spreads in the edge-safe `authConfig`,
  then overrides/extends it with the Node-only pieces (Prisma adapter, providers,
  JWT/session callbacks, cookie hardening).
- **Key exports:** `handlers`, `auth`, `signIn`, `signOut` (`auth.ts:64`); plus
  `GET`/`POST` re-exported from `handlers` (`auth.ts:67`).
- **Adapter:** `PrismaAdapter(db as any)` (`auth.ts:16`) — `db` is the shared
  client from `@/server/db`. The `as any` cast hides adapter/Prisma type
  mismatch.
- **Session strategy:** `"jwt"` (`auth.ts:17`). So the `Session`/
  `VerificationToken` Prisma tables exist but are **not** used for session
  storage (JWT is stateless). The adapter still writes `User`/`Account` rows.
- **Secret:** `AUTH_SECRET || NEXTAUTH_SECRET` (`auth.ts:18`).
- **Provider:** Google only, with
  **`allowDangerousEmailAccountLinking: true`** (`auth.ts:54-59`). This means a
  Google sign-in is linked to any existing user with the same email — convenient
  but a known account-takeover footgun if a second IdP is ever added or if email
  ownership is spoofable. Today it is low risk because Google is the only
  provider.
- **Cookie hardening (`auth.ts:21-36`):** custom `pkceCodeVerifier` cookie. On
  `production` it is `__Secure-`-prefixed, `secure`, and domain-scoped to
  `.quillandcompass.app`; on dev it drops `__Secure-`/`secure` so the PKCE cookie
  survives `http://localhost` (the comment explains a real bug this fixes).
- **JWT callback (`auth.ts:39-45`):** on first sign-in copies `user.id` and
  `user.organizationId` onto the token. NOTE: `organizationId` is read off the
  adapter `user` object **only when `user` is present** (i.e., at login). It is
  **not refreshed** on later requests, so a user who completes onboarding *after*
  login keeps a stale `token.organizationId` (often `undefined`) until the JWT is
  reissued. This is masked in practice because pages re-derive the org from the DB
  via `getCurrentUserOrg`, not from the token.
- **Session callback (`auth.ts:46-52`):** copies `token.id` →
  `session.user.id` and `token.organizationId` → `session.user.organizationId`
  (via `as any` because the type isn't augmented — see "Risks").

### `src/auth.config.ts` — edge-safe config (shared)
- **Role:** Minimal `NextAuthConfig` that can run on the edge (no Prisma, no
  Node APIs). Imported by `auth.ts` and spread in.
- **Contents:** empty `providers: []` (real providers added in `auth.ts`),
  `pages.signIn = "/login"`, and an **`authorized()` callback** (`auth.config.ts:15-33`).
- **`authorized()` status — effectively DEAD.** The `authorized` callback only
  runs when NextAuth is wired as middleware via the `auth` export used as the
  middleware function (the classic `export { auth as middleware }` pattern). This
  repo does **not** do that — route protection is done by the hand-written
  `proxy.ts` which calls `auth()` itself and returns its own redirects. So this
  `authorized()` callback is never consulted for routing. It guards `/dashboard`
  and `/onboarding`, returns `true` for everything else. Keep in mind it is
  documentation-of-intent, not live behavior.

### `src/proxy.ts` — edge middleware (Next 16 `middleware` → `proxy`)
- **Role:** The live route guard. Next 16 renamed the `middleware` convention to
  `proxy`; this file exports `proxy()` and a `config.matcher`.
- **Logic (`proxy.ts:5-25`):** calls `await auth()`, then:
  - if path starts with `/dashboard` and not logged in → redirect `/login`.
  - if path starts with `/onboarding` and not logged in → redirect `/login`.
  - otherwise `NextResponse.next()`.
- **Matcher (`proxy.ts:28-39`):** matches everything except `api`,
  `_next/static`, `_next/image`, `favicon.ico`.
- **CRITICAL DRIFT / mostly-inert guard:** **There is no `/dashboard` route in
  the app.** The real authenticated home is `/` (`src/app/page.tsx`) and the
  student view is `/student/dashboard` (which does *not* start with
  `/dashboard`). So the proxy's only positive checks guard a non-existent path
  and `/onboarding`. Every actually-protected page (`/`, `/students`,
  `/courses`, `/planner`, `/transcripts`, `/living-library`, `/grading`, …)
  relies on **its own** `auth()` + `redirect("/login")`, not on the proxy. The
  proxy is therefore close to a no-op for security; it mainly forces the route
  tree through the edge so `auth()` runs (and warms cookies). Treat per-page
  `auth()` as the real gate.
- **Runtime caveat:** `proxy.ts` imports `auth` from `@/auth`, which pulls in
  the PrismaAdapter. With `session.strategy: "jwt"`, `auth()` in the proxy reads
  the JWT cookie and does not need the DB, but the import graph still references
  Node-only code. This is the reason for the split `auth.config.ts` (edge-safe)
  vs `auth.ts` (Node). Whether this proxy actually runs on the edge or is forced
  to Node depends on the build; verify in deploy logs (open question).

### `src/lib/auth-helpers.ts` — the canonical tenant gate (server)
- **Role:** `getCurrentUserOrg(existingSession?)` — the single most-called
  function in this subsystem (55+ files reference it).
- **Behavior (`auth-helpers.ts:9-30`):**
  1. Uses a passed-in session if provided, else calls `auth()`.
  2. Throws `"User not authenticated"` if no `session.user.id`.
  3. **Re-reads the DB** (`db.user.findUnique`) to get a fresh
     `{ id, organizationId }` — deliberately not trusting the JWT's possibly-stale
     org. Throws `"User not found"` if the row is gone.
  4. Returns `{ userId, organizationId }` (org can be `null` for a user who
     hasn't onboarded).
- **Posture:** This is the authoritative source of `organizationId`. Pages then
  pass `organizationId` into org-scoped queries. The function authenticates but
  does **not** itself enforce role, deactivation, or that org !== null — callers
  must check `if (!organizationId) redirect("/onboarding")` (e.g.
  `src/app/page.tsx:24`).
- **`existingSession` typed `any`** — callers sometimes pass the already-fetched
  session to avoid a double `auth()` round-trip (e.g. `onboarding/page.tsx:14`,
  `page.tsx:22`).

### `src/app/api/auth/[...nextauth]/route.ts` — Auth.js HTTP handler
- **Role:** The catch-all OAuth/callback/signin/signout endpoint. Re-exports
  `GET`/`POST` from `@/auth` (`route.ts:4,12`).
- **Config:** `export const dynamic = "force-dynamic"` and
  `runtime = "nodejs"` (`route.ts:1-2`) — pins this route to the Node runtime so
  the Prisma adapter works.

### `src/app/api/auth/user-org/route.ts` — org lookup JSON API
- **Role:** `GET` that returns `{ userId, organizationId }` for the current
  session, or `401 { error: "Unauthorized" }` on any throw (`route.ts:7-17`).
- **Posture:** thin wrapper over `getCurrentUserOrg()`; `force-dynamic`. Client
  helper for code that needs the org id outside a server component. (Search shows
  few/no live callers — verify before relying on it.)

### `src/app/login/page.tsx` & `src/app/signup/page.tsx` — auth entry UIs (server)
- **Role:** Server components rendering a card with a single Google button. Each
  defines an inline **server action** (`"use server"`) that calls
  `signIn("google", { redirectTo: "/" })` (`login/page.tsx:15-18`,
  `signup/page.tsx:15-18`).
- **They are functionally identical** — same provider, same `redirectTo: "/"`,
  differing only in copy and cross-links. "Sign up" does not collect any
  signup-specific data; onboarding happens later at `/onboarding`. So the
  login/signup split is cosmetic.

### `src/components/auth/sign-in-button.tsx` — client button (DEAD CODE)
- **Role:** `"use client"` button that takes an `action` prop, manages a local
  `isLoading` spinner, and submits a form (`sign-in-button.tsx:14-56`).
- **Status: unused.** A repo-wide search for `SignInButton`/`sign-in-button`
  finds only its own definition (and a mention in `QSF-REMEDIATION-PLAN.md`). The
  live login/signup pages use a plain `<form action={...}><Button/></form>`
  instead, so this component is dead code.

### `src/app/actions/user-actions.ts` — profile update (server action)
- **Export:** `updateProfile(data)` (`user-actions.ts:13`).
- **Auth:** `auth()` → `401`-style `{ success:false, error:"Unauthorized" }` if
  no `session.user.id`.
- **Validation:** Zod `profileSchema` (`name` 2–50 chars, optional `image` URL or
  empty string).
- **Write:** `db.user.update` on `session.user.id` only (self-scoped — no IDOR).
  `image: ""` is normalized to `null`. `revalidatePath("/")`.
- **Note:** comment at line 26 says defensive try/catch was *removed* on purpose
  so Prisma errors bubble (a thrown error in a server action surfaces as a
  generic failure to the client).

### `src/app/actions/account-actions.ts` — account lifecycle (server actions)
All four take `auth()` and reject when unauthenticated.

- **`deactivateAccount()` (`:7`)** — sets `deactivatedAt = now()` on self. **No
  enforcement anywhere reads `deactivatedAt`** — there is no check in `proxy.ts`,
  `auth.ts` callbacks, or `getCurrentUserOrg` that blocks a deactivated user. So
  "deactivate" is a soft flag with no teeth today (a deactivated user can still
  use the app). Drift/half-built.
- **`reactivateAccount()` (`:22`)** — clears `deactivatedAt`. **No UI caller** →
  dead code (a deactivated user could never reach a "reactivate" button anyway,
  since deactivation isn't enforced).
- **`deleteAccount()` (`:37-138`)** — the heavy one. Looks up the user's org,
  then **manually deletes a large dependency graph in sequence**:
  - Nulls `assessmentAttempt.graderUserId` where this user graded
    (`:53-55`).
  - Deletes `resourceAssignment` (assignedBy) and `resource` (createdBy)
    (`:59-64`).
  - If `orgId`: deletes students, transcripts, then walks courses bottom-up
    (item responses → attempts → items → assessments → activity progress →
    activity resource assignments → activities → blocks → course progress →
    courses), then library items (books/videos/articles/documents), then
    classroom instructors + classrooms, then **deletes the whole
    `Organization`** (`:66-131`).
  - Finally `db.user.delete` (`:135`), relying on cascade for
    accounts/sessions/discipleship records.
  - **NOT in a transaction.** Each `deleteMany`/`delete` is a separate query, so
    a failure midway leaves the account half-deleted (org gone but user
    lingering, or vice versa). **Atomicity bug.**
  - **Tenancy / blast-radius concern:** deleting *your* account deletes the
    **entire organization and every other user/student/course in it** (org delete
    cascades to all members). There is **no role check** — any member (not just
    OWNER), or the last member, can nuke the whole tenant. For a single-family
    org this is the intended "delete my family" semantics, but for any multi-user
    org it is a destructive cross-user action with no guard. (See Risks.)
- **`transferOwnership(newOwnerUserId)` (`:140-185`)** — the only role-gated
  action: requires caller `role === "OWNER"` (`:151`), requires the target user
  to be in the **same org** (`:167`, prevents cross-tenant promotion), then sets
  new owner `role=OWNER` and demotes caller to `PARENT`. Two separate
  `db.user.update` calls — **not transactional** (could leave two OWNERs or zero
  if the second fails). **No UI caller found** → currently dead/unwired.

### `src/app/actions/data-export.ts` — GDPR-style export (server action)
- **Export:** `exportUserData()` (`:6`).
- **Auth:** `auth()` guard.
- **Behavior:** fetches the user row, separately re-fetches `organizationId`
  (`:35-40`, redundant second query — could have selected it in the first), then
  `Promise.all` over ~14 datasets: students (+nested), courses (+blocks
  +activities), library (books/videos/articles/documents), discipleship
  (prayer/bible-memory/devotional/church-notes/gratitude — **scoped by
  `userId`**), transcripts, classrooms (+instructors), generated resources.
  Org-scoped sets use `organizationId: orgId ?? undefined`.
- **Tenancy caveat (`:60-94`):** when `orgId` is `null`/undefined,
  `where: { organizationId: undefined }` becomes an **unfiltered query** in
  Prisma — it would match **all rows across all orgs**. In practice a logged-in
  user without an org has no data and pages redirect them to onboarding, so this
  is latent rather than currently exploitable, but it is a real cross-tenant
  leak pattern if ever reached with `orgId == null`. **Flag.**
- **Exports `classroomInstructor` rows including `instructorPin`** (the bcrypt
  hash) via `classrooms.include.instructors` (`:123-128`) — the export contains
  the PIN hashes. Low risk (bcrypt) but worth noting in a "data export"
  surface.
- Returns the assembled object to the client (the dialog turns it into a JSON
  download); does not write anything.

---

## Data models & tenancy

Source: `prisma/schema.prisma`.

- **`User`** (`schema.prisma:140-173`): `id`, `email` (unique, nullable),
  `name` (`@map("full_name")`), `image`, `role: UserRole @default(PARENT)`,
  `organizationId String?` (`@map("account_id")`), `deactivatedAt DateTime?`.
  Relations: `accounts`, `sessions`, created courses/resources/classrooms,
  graded attempts, and all discipleship records. **Cascade delete from
  Organization → User** (`onDelete: Cascade`, `:162`) — deleting an org deletes
  its users.
- **`Organization`** (`schema.prisma:102-122`): `type: OrganizationType`,
  `name`, and back-relations to virtually every tenant-scoped model
  (students, courses, resources, classrooms, transcripts, library, schedule).
- **`Account`** (`:175-192`) / **`Session`** (`:194-202`) /
  **`VerificationToken`** (`:204-211`): standard Auth.js adapter tables.
  Because strategy is JWT, `Session`/`VerificationToken` are largely vestigial.
- **`UserRole`** enum (`schema.prisma:918-923`): `OWNER`, `TEACHER`, `ADMIN`,
  `PARENT`. **Only `OWNER` and `PARENT` are ever read/written in code**
  (`transferOwnership` promotes to `OWNER`, demotes to `PARENT`; default is
  `PARENT`). `TEACHER` and `ADMIN` are defined but **never enforced anywhere** in
  this subsystem — no route, action, or query branches on them. Effectively dead
  enum values today.
- **`OrganizationType`** enum (`schema.prisma:912-916`): `PARENT_INSTRUCTOR`,
  `MICROSCHOOL_COOP`, `CHURCH_PRIVATE_SCHOOL`. Onboarding hard-codes
  `PARENT_INSTRUCTOR` (`blueprint.ts:53`); the other two are not created by any
  flow found.
- **`InstructorRole`** enum (`schema.prisma:974-978`): `PRIMARY`, `ASSISTANT`,
  `OBSERVER`. Onboarding sets the first instructor `PRIMARY`, rest `ASSISTANT`
  (`blueprint.ts:124`).
- **`ClassroomInstructor`** (`:245-262`): holds **`instructorPin String`**
  (`@map("instructor_pin")`). Unique on `(classroomId, userId)`.

**The `account_id` naming landmine:** the column for `organizationId` is mapped
to the **physical column `account_id`** on User, Classroom, Student, and many
others (e.g. `:147`, `:215`, `:281`). This is unrelated to the Auth.js
`Account` table / `accounts` table. "account" in raw SQL/migrations means
**organization**, not OAuth account. Anyone reading the DB directly must not
confuse `users.account_id` (the org FK) with the `accounts` table (OAuth).

**Tenancy enforcement pattern (verified):** the gate is *query-level*, not
row-level. There is no Postgres RLS in this path; instead every server
page/route/action does `getCurrentUserOrg()` → `organizationId`, then includes
`where: { organizationId }` (and frequently `where: { id, organizationId }` for
single-record lookups, e.g. `getStudentDashboardData`
`src/server/queries/dashboard.ts:5-10`, which **does** prevent the
`?studentId=` IDOR on the home page). The correctness of tenant isolation
therefore depends on every individual query remembering to filter — it is not
structurally enforced.

---

## Entry points & end-to-end flows

### Sign-in flow
1. Unauthenticated user hits a protected page (e.g. `/`). Page calls `auth()`,
   gets no session, `redirect("/login")` (`src/app/page.tsx:18-20`). (The proxy
   does *not* drive this for `/` — only for the nonexistent `/dashboard`.)
2. `/login` renders the Google button; submitting runs the inline server action
   `signIn("google", { redirectTo: "/" })` (`login/page.tsx:15-18`).
3. Auth.js redirects to Google, handles OAuth via
   `/api/auth/[...nextauth]` (Node runtime). PrismaAdapter upserts `User` +
   `Account`; `allowDangerousEmailAccountLinking` links by email.
4. JWT callback stamps `token.id` and `token.organizationId` (the latter
   `undefined` for a brand-new user) (`auth.ts:39-45`).
5. Redirect to `/`. `page.tsx` calls `getCurrentUserOrg(session)`; new user has
   `organizationId == null` → `redirect("/onboarding")` (`page.tsx:24-26`).

### Onboarding / org creation flow
1. `/onboarding` page guards with `auth()` then `getCurrentUserOrg(session)`
   and loads blueprint progress (`onboarding/page.tsx:8-15`).
2. The wizard's classroom step calls server action `saveClassroomStep`
   (`src/server/actions/blueprint.ts:26`). It **re-derives identity from the
   session** and ignores the caller-supplied `organizationId`/`userId`
   (`blueprint.ts:31-34`) — good anti-spoofing.
3. In a `$transaction`: if the user has no org, **creates an `Organization`**
   (`type: "PARENT_INSTRUCTOR"`, name `"<lastName> Family"`) and links the user
   to it (`blueprint.ts:46-63`). Then creates/updates the `Classroom`, replaces
   instructors, and stores the **bcrypt-hashed** instructor PIN
   (`pinHash = bcrypt.hash(pin, 10)`, `:39`; stored at `:123`).
4. After onboarding, the user's org exists; subsequent loads of `/` show the
   ParentDashboard.

### Tenant-scoped read flow (representative)
`auth()` → `getCurrentUserOrg()` → `{ organizationId }` →
`db.<model>.findMany({ where: { organizationId } })`. Used by 55+ files
including `students`, `courses`, `transcripts`, `living-library`, `grading`,
`planner`, `creation-station`, `blueprint`, and the API routes under
`/api/library`, `/api/courses`, `/api/students`, `/api/grading`.

### Account management flow (ProfileSettingsDialog)
`src/components/navigation/ProfileSettingsDialog.tsx` is the **only UI** wired to
this subsystem's account actions: it imports and calls `updateProfile`
(`:27,57`), `exportUserData` (`:28,74`), `deactivateAccount` (`:29,102`), and
`deleteAccount` (`:29,120`). It does **not** call `reactivateAccount` or
`transferOwnership` (both unwired). Delete is gated behind a confirm-text
`AlertDialog` in the dialog, but server-side there is no role check (see Risks).

---

## External dependencies & services

- **`next-auth` v5 (Auth.js)** — core auth, `signIn`/`signOut`/`auth`/`handlers`.
- **`@auth/prisma-adapter`** — `PrismaAdapter(db)` persists users/accounts.
- **`next-auth/providers/google`** — Google OAuth (the only IdP). Requires
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **Prisma client** from `@/server/db` (generated client at `@/generated/client`)
  → Postgres (pgvector elsewhere; not used in this subsystem).
- **`bcryptjs`** — hashes instructor PINs in `blueprint.ts` (not in the files
  owned here, but it is the PIN's only crypto).
- **`zod`** — input validation in `updateProfile` and the onboarding schemas.
- **`next/cache` `revalidatePath`**, **`next/server`** (`NextResponse`,
  `NextRequest`) — proxy and actions.
- **Env vars:** `AUTH_SECRET`/`NEXTAUTH_SECRET`, `GOOGLE_CLIENT_*`,
  `NODE_ENV` (drives cookie hardening + prod domain `.quillandcompass.app`).

---

## Auth / security posture

**What is solid:**
- Per-page `auth()` + `redirect("/login")` is consistently applied across server
  pages, and is the *real* gate (not the proxy).
- `getCurrentUserOrg()` re-reads the DB for `organizationId` rather than trusting
  the JWT, so a stale token org doesn't grant wrong-tenant access.
- Single-record lookups commonly use `where: { id, organizationId }`, closing the
  obvious IDOR (verified: home-page `?studentId=` is org-scoped via
  `getStudentDashboardData`).
- `updateProfile` is strictly self-scoped (`where: { id: session.user.id }`).
- `transferOwnership` checks both `OWNER` role and same-org membership before
  promoting.
- Onboarding's `saveClassroomStep` ignores caller-supplied ids and derives them
  from the session.
- Instructor PINs are bcrypt-hashed at rest (`blueprint.ts:39`).

**Weak spots / risks (see next section for the worst):**
- The proxy guards a non-existent `/dashboard` — protection is entirely
  per-page, so any new page that *forgets* to call `auth()` is silently public.
- `deleteAccount` has no role guard and no transaction, and cascades to the whole
  org.
- `allowDangerousEmailAccountLinking: true`.
- `exportUserData` with a `null` org degrades to unfiltered cross-tenant queries.
- The `instructorPin` is collected and hashed but appears to be a **PIN with no
  verification gate** — no code reads/compares it (no `bcrypt.compare`,
  `verifyPin`, etc. found). It is currently a write-only field; the "lock the app
  with an instructor PIN" feature is **not implemented** on the read side.

---

## Risks, drift, dead-code & half-built

1. **`/dashboard` guard is a phantom (drift).** `proxy.ts:11` and
   `auth.config.ts:17` both protect `/dashboard`, but there is no such route
   (`src/app/dashboard/**` is empty; home is `/`, student is
   `/student/dashboard`). Net effect: the proxy/authorized config protects
   essentially nothing; all real protection is per-page `auth()`. High-impact if a
   future page omits its own check.
2. **`authorized()` callback is dead** (`auth.config.ts:15-33`). NextAuth is not
   used as middleware (no `export { auth as middleware }`); the custom `proxy`
   replaces it. The callback never runs.
3. **`deleteAccount` is non-atomic and unguarded** (`account-actions.ts:37-138`):
   - No `$transaction` → partial-delete on failure (account half-gone).
   - No role check → **any** org member can delete the **entire organization**
     and thus every other member/student/course (cascade). Cross-user
     destruction with no guard. For single-family tenants this is "delete my
     family"; for multi-user tenants it is a footgun/abuse vector.
   - Hand-rolled cascade duplicates what `onDelete: Cascade` could do; risk of
     drift as new models are added (a new org-scoped model not added here would be
     orphaned or block the org delete).
4. **`reactivateAccount` and `transferOwnership` are dead code** — no UI caller
   found (`ProfileSettingsDialog` doesn't import them; no other importer).
   `transferOwnership` is otherwise the best-written action.
5. **`deactivatedAt` is unenforced (half-built).** `deactivateAccount` sets it,
   but nothing checks it (`proxy.ts`, `auth.ts` callbacks, `getCurrentUserOrg`
   all ignore it). A "deactivated" user keeps full access.
6. **`SignInButton` component is dead code** (`components/auth/sign-in-button.tsx`)
   — never imported.
7. **Login vs Signup pages are duplicates** — same provider, same `redirectTo`,
   only copy differs. Signup collects nothing; could be one page.
8. **`exportUserData` null-org → unfiltered query** (`data-export.ts:60-94`):
   `where: { organizationId: undefined }` returns all rows for that model across
   all tenants. Latent cross-tenant leak (gated in practice by the onboarding
   redirect). Also re-queries `organizationId` redundantly (`:35-40`) and exports
   bcrypt PIN hashes.
9. **No `next-auth` type augmentation.** There is no `declare module "next-auth"`
   anywhere; `session.user.organizationId` is reached via `(session.user as any)`
   (`auth.ts:42,49`; consumers use casts too). Type-unsafe and easy to typo.
10. **JWT `organizationId` goes stale.** `auth.ts:39-43` only stamps the org at
    login; a user who onboards mid-session has `undefined` on the token until
    reissue. Masked by `getCurrentUserOrg`'s DB re-read, so harmless today, but a
    trap if anyone ever trusts `session.user.organizationId` directly.
11. **Instructor PIN has no verification path (half-built feature).** PIN is
    collected, validated as 4 digits (`src/lib/schemas/onboarding.ts:19`), and
    bcrypt-hashed/stored, but no code ever verifies it — the "PIN-lock"/"switch to
    instructor mode" gate doesn't exist yet. Privacy page claims PINs are bcrypt
    hashed (`src/app/privacy/page.tsx:258`) — that part is true.
12. **`allowDangerousEmailAccountLinking: true`** (`auth.ts:58`) — acceptable
    while Google is the sole provider; becomes a takeover risk if a second
    provider is added.
13. **Proxy runtime ambiguity.** `proxy.ts` imports the full `@/auth` (Prisma
    graph). Confirm in deploy whether it runs on edge or is bumped to Node;
    misconfiguration could break or slow every request.

---

## Cross-links to other subsystems

- **Tenancy consumers (55+ files)** call `getCurrentUserOrg` — e.g.
  `src/server/actions/blueprint.ts`, `transcript.ts`, `scheduling.ts`;
  `src/app/actions/*` (student, course, assessment, resource, assignments,
  catechism, compile-curriculum); API routes `src/app/api/library/*`,
  `src/app/api/courses/*`, `src/app/api/students/*`, `src/app/api/grading/*`,
  `src/app/api/chat/route.ts`; pages `src/app/{students,courses,planner,transcripts,living-library,grading,creation-station,blueprint,context,thinkling}/*`.
  Document those gates in their own subsystem docs; they all depend on this one.
- **Onboarding / Blueprint** (`src/server/actions/blueprint.ts`,
  `src/components/onboarding/*`) is where `Organization` is created and the user
  is linked — the missing half of "account creation." The instructor PIN lives
  here.
- **Navigation / Settings UI** (`src/components/navigation/ProfileSettingsDialog.tsx`)
  is the sole consumer of `updateProfile`, `exportUserData`,
  `deactivateAccount`, `deleteAccount`, and uses `signOut` from
  `next-auth/react`.
- **Dashboard queries** (`src/server/queries/dashboard.ts`) show the correct
  org-scoped single-record pattern that closes the home-page IDOR.
- **Prisma schema** (`prisma/schema.prisma`) owns the `User`/`Organization`/
  `Account`/`Session`/`ClassroomInstructor` models and the `account_id`↔org
  mapping.

---

## Open questions

1. Does `proxy.ts` actually execute on the edge runtime, or is it forced to Node
   by the `@/auth`/Prisma import? (Affects latency and whether it even runs.)
2. Is `/dashboard` a planned route that was renamed to `/`, or leftover from a
   scaffold? Should the proxy/`authorized()` matcher be repointed to the real
   protected paths (or removed in favor of explicit per-page guards)?
3. Should `deleteAccount` be (a) transactional and (b) role-gated (OWNER-only, or
   only when sole member)? What is the intended multi-user-org delete semantics?
4. Is the instructor-PIN gate a planned feature (verify-on-read), or abandoned?
   Nothing consumes the hash today.
5. Are `reactivateAccount`/`transferOwnership` meant to be wired into the
   settings UI, or removed?
6. Should `next-auth` types be augmented so `session.user.organizationId` is
   typed (removing the `as any` casts and the stale-token trap)?
7. `exportUserData`: should the null-org branch hard-fail instead of running
   unfiltered Prisma queries?
8. `UserRole` defines `TEACHER` and `ADMIN` but nothing enforces them — are
   they planned (e.g. microschool/co-op staff) or vestigial? Same question for
   the unused `OrganizationType` values (`MICROSCHOOL_COOP`,
   `CHURCH_PRIVATE_SCHOOL`), which no flow creates.
