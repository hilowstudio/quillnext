# 04 — Security: Auth, Tenancy, RLS & Profile Gating

> Source of truth: the files in §1, read end-to-end. Written against commit `b585c1e`.
> **This is the most security-critical chapter.** The headline: **DB Row-Level Security is OFF**, so
> the application layer is the *only* live tenant boundary. Read `Q-001` first.

## 1. Scope

| File | Lines | Role |
|---|---|---|
| `src/auth.ts` | 68 | NextAuth v5 instance (node): Google provider, Prisma adapter, JWT, cookies, callbacks. |
| `src/auth.config.ts` | 17 | Edge-safe base config (pages). |
| `src/proxy.ts` | 97 | The Next 16 middleware (**`proxy.ts`** = the framework's middleware filename): route gate + profile gate + cookie restamp. |
| `src/server/db.ts` | 139 | Tenant-aware Prisma client, `RLS_ENABLED` gate, `CONTEXT_FREE_MODELS`, `withTenant`, `resolveTenant`. |
| `src/server/rls-context.ts` | 36 | `AsyncLocalStorage` carrying `{organizationId,userId}` per request. |
| `src/lib/auth-helpers.ts` | 36 | `getCurrentUserOrg()` — the canonical tenant gate. |
| `src/lib/active-profile-cookie.ts` | 84 | Signed (jose HS256) active-profile cookie: sign/verify, idle TTL, options. |
| `src/lib/profile-access.ts` (+`.test.ts`) | 37 | Pure route-gate decision for the proxy (PARENT/STUDENT/none). |
| `src/lib/firebase-admin.ts` | 44 | Firebase Admin — **storage bucket only**. |
| `src/app/api/auth/[...nextauth]/route.ts` | 12 | NextAuth GET/POST handler. |
| `src/app/api/auth/user-org/route.ts` | 17 | Returns `{userId, organizationId}` (401 if unauth). |
| `src/app/actions/account-actions.ts` | 236 | deactivate/reactivate/**delete** account, **transferOwnership** (role gates). |
| `src/app/actions/user-actions.ts` | 37 | `updateProfile` (name/image). |
| `src/app/login/page.tsx`, `signup/page.tsx` | 78 / 80 | Google OAuth entry (identical flows). |

The parent gate `assertParentProfile()` lives in `src/server/profiles/guards.ts` (owned by `05-…`)
but is described here as an authz primitive.

## 2. Purpose / intent

Provide: (a) **authentication** via Google OAuth (NextAuth v5, JWT sessions); (b) **multi-tenant
isolation** so one family/org never sees another's data; (c) **in-org profile gating** (parent vs.
kid view, PIN-protected) layered on top of the single login. The design *intends* defense-in-depth:
edge route gate → per-page `auth()`/`getCurrentUserOrg()` → DB RLS.

**DB-grounded reality (read-only Supabase introspection, see `24-…` Phase C):** the DB layer is in
fact fully provisioned — **all 67 public tables have RLS enabled with 98 policies, and an `app_user`
role exists with `BYPASSRLS=false`** (and, verified Session 8, `LOGIN=true` + **full CRUD GRANTs on
every table, 0 gaps** — see `Q-001` cutover-readiness). But the *running app* sets `RLS_ENABLED=false`
(so it never stamps the org GUCs) and connects via `DATABASE_URL` as a **`BYPASSRLS` role** —
**`postgres`** (the only `BYPASSRLS` role that can log in; `service_role` is `LOGIN=false`): if it
connected as `app_user` without GUCs, every org query would fail-closed and the app would be empty,
yet it works. Net: **the app bypasses RLS today**, so the app-layer org filters (b) are the only live
tenant boundary. The cutover is a config flip (`RLS_ENABLED=true` + point `DATABASE_URL` at `app_user`)
— see `Q-001` and the ordered runbook in `24-…` §5/§8.

## 3. Architecture & data flow

### 3.1 Authentication (NextAuth v5)
- **Provider:** Google only (`auth.ts:53`). `allowDangerousEmailAccountLinking` was **removed** 2026-06-19
  (Q-004, Session 7) — it now defaults to `false`, so cross-provider same-email auto-linking is off
  (default-secure). Safe because `User`/`Account` rows are created only by the adapter at sign-in (no
  orphaned-`User` path → `OAuthAccountNotLinked` cannot fire), see Q-004.
- **Session strategy:** `jwt` (`auth.ts:17`). The **JWT is the live session**; the `Session` DB table
  is still written by `PrismaAdapter` but is not the session source.
- **Edge/node split:** `auth.config.ts` is dependency-light (edge-safe; only sets `pages.signIn:
  "/login"`). `auth.ts` adds the Prisma adapter (node-only) and is what `proxy.ts` imports. The old
  `authorized()` callback was removed as dead (comment, `auth.config.ts:6`) — gating is in `proxy.ts`.
- **Callbacks:** `jwt` stamps `token.id` + `token.organizationId` from `user` at sign-in; `session`
  copies them onto `session.user` (`auth.ts:37-51`). ⚠ `organizationId` is stamped **at login time**
  only — a user who onboards *after* login has a stale (null) org on the token; the data layer works
  around this by re-reading the org from the DB (`resolveTenant`, `getCurrentUserOrg`).
- **PKCE cookie hack:** the `pkceCodeVerifier` cookie is `__Secure-`-prefixed + `Secure` **only in
  prod** (`auth.ts:21-35`); on http://localhost the hardened form is dropped by the browser and OAuth
  fails. Prod cookie `domain` is `.quillandcompass.app` (note: the prod domain, not "quillnext").
- **Login/signup:** both `login/page.tsx` and `signup/page.tsx` render a single "Continue with
  Google" form whose server action is `signIn("google", { redirectTo: "/" })`. They are functionally
  identical — there is no distinct registration flow.

### 3.2 How an Organization (tenant) is created
A `User` starts with `organizationId = null`. An org is created in two places:
- `src/server/actions/blueprint.ts:54` — the onboarding/blueprint flow (`tx.organization.create`),
  then sets `user.organizationId` (`:65`) and `setRlsContext`. Subsequent blueprint mutations verify
  the caller's `sessionOrg` matches the target org (`:186, :278, :329`) — a good ownership check.
- `src/app/api/students/route.ts:27` — creating the first student auto-creates an org if none exists
  (raw-`db` self-heal; the subsequent learner writes run under one `withTenant` tx — Q-16-002 ✅ Session 32).

### 3.3 The proxy (route gate + profile gate)
`proxy()` (`src/proxy.ts:42`) runs on every non-excluded path (matcher excludes
`api|_next/static|_next/image|assets|favicon.ico`, `:96`):
1. **Public allow-list** (`PUBLIC_ROUTES`, `:23`): `/login /signup /privacy /terms /about /changelog`.
   Everything else is **fail-closed** → no session ⇒ redirect `/login` (`:50`). The entire
   `/family-discipleship` subtree is deliberately *not* public.
2. **Active-profile resolution (edge, no DB):** reads the signed `active_profile` cookie, verifies
   signature + idle window, and only trusts it if `token.uid === session.user.id` **and**
   `token.org === session org` (`:65`). Otherwise `activeType = null`.
3. **Profile gate:** `profileGateDecision(pathname, activeType)` (`profile-access.ts:30`):
   - `PARENT` ⇒ `allow` everything.
   - `STUDENT` ⇒ `allow` only the student-route allow-list (`STUDENT_ROUTE_MATCHERS`,
     `profile-access.ts:13`: `/`, `/courses/:id/learn` *(reserved, not built)*,
     `/living-library/resource/:id`, `/family-discipleship/**`, `/students/:id/family-discipleship/**`),
     else redirect `/select-profile`.
   - none ⇒ allow only `/select-profile*`, else redirect to the picker.
4. **Sliding idle:** an aging PARENT cookie (>5 min since `iat`) is re-signed and re-set (`:76-89`).

> Caveat (in the code's own comment, `proxy.ts:16`): the gate only checks *that a session exists*,
> **not org membership** — pages must still call their own `getCurrentUserOrg()`/ownership checks.

### 3.4 The active-profile cookie (`active-profile-cookie.ts`)
- HS256 JWS via **jose** (`signActiveProfile`/`verifyActiveProfile`), secret = `AUTH_SECRET ||
  NEXTAUTH_SECRET`. Kept Prisma-free so the edge proxy can import it.
- Claims: `profileId`, `type`, `uid`, `org`, `iat`. Binding to `uid`+`org` prevents a cookie from one
  login/org being replayed under another.
- **Idle window per type:** PARENT 15 min (`PARENT_IDLE_MS`), STUDENT infinite (`idleTtlMs`). `verify`
  returns `null` on *any* failure (bad sig, malformed, idle-expired) — **fail-closed**.
- Cookie attrs mirror the session cookie: `httpOnly`, `sameSite:lax`, `secure`+`__Secure-`+domain in
  prod only.

### 3.5 Parent gate (defense-in-depth)
`assertParentProfile()` (`server/profiles/guards.ts:10`) re-reads the active profile server-side and
throws unless `type === "PARENT"`. Called at the top of destructive/admin actions so a STUDENT
session can't invoke them by calling the server action directly (the proxy only gates *navigation*).
Used in 13 files (e.g. `account-actions`, `course-actions`, `student-actions`, `resource-library-actions`,
`transcript`, `my-learning`, `api/courses` POST, `api/courses/:id/blocks/:blockId`, the 4 `api/library/*`
create/extract routes). The **completeness** of this coverage across all mutating actions is audited in `24-…`.

### 3.6 Tenancy & RLS machinery (`db.ts` + `rls-context.ts` + `auth-helpers.ts`)
- **`getCurrentUserOrg()`** (`auth-helpers.ts:10`) — canonical gate: resolves session → looks up
  `User.organizationId` from the DB (not the stale JWT) → `setRlsContext(...)` → returns
  `{userId, organizationId}`. Throws if unauthenticated. Used in **77 files**.
- **`rls-context.ts`** — `AsyncLocalStorage<{organizationId,userId}>`. `setRlsContext` uses
  `enterWith` (per request); `runWithRlsContext` (`store.run`) is for background jobs/Inngest that
  have no request frame.
- **`db.ts`** — builds the Prisma client on the `PrismaPg` adapter (SSL `rejectUnauthorized:false`),
  singleton via `globalThis`. **`RLS_ENABLED`** (`:9`, default **false**) decides everything:
  - **OFF (current):** `createClient()` returns the bare client (`:114`). No GUCs, no extension.
    `withTenant(fn)` becomes a plain `$transaction` (no `set_config`). **Tenant isolation depends
    entirely on each query's explicit `where`/scoping.**
  - **ON (future cutover):** the client is `$extends`-wrapped so every query (except
    `CONTEXT_FREE_MODELS`) resolves the tenant and stamps `app.current_org` / `app.current_user`
    GUCs in a transaction; the RLS policies (migration 2) then enforce isolation. Missing context ⇒
    query runs with empty GUCs ⇒ policies fail closed.
  - **`CONTEXT_FREE_MODELS`** (`:37`): auth tables (permissive; written during sign-in before any
    session) + all global reference/extraction/corpus models — they skip the GUC and are cross-org
    readable by design. This set mirrors the GLOBAL rows in `02-…`.
- **`withTenant`** is used in **65 files** (305 refs). It threads the future-RLS pattern but is a
  no-op transaction wrapper today; many writers use it purely for transactionality.

### 3.7 Other data/identity stacks
- **Supabase JS clients** — **removed** (Q-002, Session 6, 2026-06-19): the unused
  `lib/supabase/client.ts` + `server.ts` `@supabase/supabase-js` wrappers (zero importers; stale
  "PostgREST is public" comment; `server.ts` defaulted to the BYPASSRLS `SUPABASE_SERVICE_ROLE_KEY`)
  were deleted and the orphaned `@supabase/supabase-js` dependency uninstalled. **Prisma is the sole
  data path.** Supabase remains the Postgres host (reached *only* via Prisma/`DATABASE_URL`) and the
  dev-time MCP server — neither uses the JS SDK. See CHANGELOG.md.
- **Firebase Admin** (`lib/firebase-admin.ts`) — **live, storage only**: `getStorageBucket()` is used
  by `inngest/functions/process-document.ts:67` and dynamically in
  `app/actions/resource-library-actions.ts:260` (document/image storage). No Firebase auth/messaging.

### 3.8 Account lifecycle (`account-actions.ts`)
- `deactivateAccount`/`reactivateAccount` — set/clear `User.deactivatedAt`; gated by
  `assertParentProfile`.
- **`deleteAccount`** — `assertParentProfile`, then a **role gate**: if the org has >1 member and the
  caller isn't `OWNER`, refuse (`:70`) — because deleting cascades the *entire* organization. Runs an
  explicit bottom-up delete inside one `withTenant` transaction (`:80-183`) because several FKs
  (`resources.created_by_user_id`, `resource_assignments.assigned_by_user_id`) are `RESTRICT` and
  would otherwise block the org cascade. **This is the function most able to destroy the seeded
  production data — treat with extreme care (never invoke during the mastery pass).**
- **`transferOwnership`** — OWNER-only; verifies the new owner is in the same org before promoting.

## 4. Status table

| Unit | Status | Evidence |
|---|---|---|
| Google OAuth login (JWT) | DONE | `auth.ts`, `login/page.tsx` |
| Proxy route gate (fail-closed) | DONE | `proxy.ts:23-51` |
| Profile gate (PARENT/STUDENT) | DONE | `proxy.ts:70`, `profile-access.ts` |
| Active-profile signed cookie + idle | DONE | `active-profile-cookie.ts` |
| Parent gate on admin actions | PARTIAL | `guards.ts`; coverage across all mutations unverified → `24-…` |
| `getCurrentUserOrg` tenant gate | DONE | `auth-helpers.ts`, 77 callers |
| **DB Row-Level Security** | **PROVISIONED but app-bypassed** (cutover-ready) | `db.ts:9,114` (app off); DB has 98 policies on all 67 tables + `app_user` role (Phase C); app connects as `postgres` (BYPASSRLS). `app_user` verified Session 8: `BYPASSRLS=false`+`LOGIN=true`, 0 GRANT gaps → Q-001 runbook (`24-…`) |
| `withTenant` GUC stamping | PARTIAL | `db.ts:98-111`; no-op until `RLS_ENABLED` |
| Supabase JS clients | **REMOVED** | deleted 2026-06-19 (Q-002); were zero-importer `lib/supabase/*` wrappers + dep uninstalled — see CHANGELOG |
| Firebase Admin (storage) | DONE | `firebase-admin.ts`; 2 callers |
| `SignInButton` component | **REMOVED** | deleted 2026-06-19 (Q-003); was zero-importer dead UI — see CHANGELOG |
| `/courses/:id/learn` student route | STUB (reserved) | allow-listed but route not built (`profile-access.ts:11`) |
| Org-scoped query org-filter audit | PARTIAL | sampled here; full sweep in `24-…` |

## 5. Integration points

- **Env vars:** `AUTH_SECRET` / `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `DATABASE_URL`, `RLS_ENABLED`, `NODE_ENV`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
  `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`. *(The three `SUPABASE_*` JS-client keys —
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` —
  were dropped with the dead Supabase JS clients, Q-002, 2026-06-19; `DATABASE_URL` is the Postgres
  connection and is unaffected.)*
- **Prod cookie domain:** `.quillandcompass.app`.
- **Imported by:** `proxy.ts` (auth, cookie, profile-access); every server action/query/route
  (`getCurrentUserOrg`, `db`, `withTenant`); profiles subsystem (`05-…`) builds on the cookie + guards.
- **Models:** `User`, `Account`, `Session`, `VerificationToken`, `Organization`, `Profile` (`02-…`).

## 6. Findings (seed; consolidated in `24-…`)

```
Q-001  [HIGH]   The running app bypasses DB Row-Level Security — app layer is the sole live boundary.
   Evidence: RLS_ENABLED default false (db.ts:9); bare client returned (db.ts:114), so no org GUC is
             stamped. DB-grounding (Phase C, 24-): all 67 public tables HAVE rls enabled + 98 policies,
             and an `app_user` (BYPASSRLS=false) role exists — but the app works with GUCs unset, which
             is only possible if DATABASE_URL connects as a BYPASSRLS role (postgres/service_role).
             So the policies, though present, are not enforced for the app's connection.
   Impact:   any org-scoped query lacking an explicit organizationId/ownership predicate is a
             cross-tenant read/write. Single-user in prod today, but a hard blocker before any second
             tenant. Mitigation is a config flip (RLS_ENABLED=true + DATABASE_URL→app_user) — verify
             app_user has the right GRANTs first. Full per-query org-filter audit in 24-….
   Cutover:  (Session 8, 2026-06-19) There is NO code fix — the RLS enforcement path is already written
             and dormant (db.ts:115-131 per-query $extends; withTenant GUC stamping db.ts:107-110); a
             3-lens adversarial pass confirmed it is complete/correct and that the fix is purely an infra
             cutover (env flag + DB-connection-role secret), out of scope for a code session and risky to
             flip without staging (no rollback on the precious prod DB; would break features until the
             per-query audit lands). Owner chose "prep the cutover now": read-only verification confirms
             the GRANT/role side is READY — app_user is BYPASSRLS=false + LOGIN=true, holds full CRUD on
             all 68 public tables (0 grant gaps), EXECUTE on app.current_org()/current_user_id(), USAGE on
             public+app; 0 sequences; 68/68 tables RLS-enabled, 98 policies (only _prisma_migrations is
             RLS-without-policy → deny-all for app_user, harmless). Connection-role inference sharpened:
             the app connects as `postgres` (the only BYPASSRLS login role; service_role is LOGIN=false).
             The ordered runbook + the infra/per-query two-workstream gate live in 24-… §5 (roadmap) + §8.
   Status:   ⏳ OPEN [HIGH] — cutover prep done; execution deferred to a dedicated infra task gated on the
             per-query org-filter audit. Tracked-OPEN (deferred ≠ closed); foundational, outside the
             "HIGH 10" headline. See CHANGELOG.md round 11.

Q-002  [LOW]    Supabase JS clients are dead code; their "PostgREST is public" comment is now stale.
   Evidence: lib/supabase/client.ts + server.ts imported nowhere (Prisma is the sole data path).
             client.ts:8 comment claims "RLS is not yet configured … anything reachable via PostgREST
             is effectively public" — DB-grounding (Phase C) shows RLS IS now enabled on all 67 tables
             with 98 policies, and anon/authenticated are non-BYPASSRLS, so PostgREST access is in fact
             governed by those policies. The comment is outdated.
   Impact:   (a) dead code to remove or wire deliberately; (b) the stale comment misleads. server.ts
             defaulting to SUPABASE_SERVICE_ROLE_KEY (BYPASSRLS) remains a foot-gun if ever adopted.
   Status:   ✅ REMOVED 2026-06-19 (Session 6) — owner-approved: `git rm` lib/supabase/client.ts +
             server.ts, `npm uninstall @supabase/supabase-js`, and dropped the 3 SUPABASE_* env vars
             from .env.example. Prisma/Postgres + the Supabase MCP are unaffected. See CHANGELOG.md.

Q-003  [LOW]    SignInButton component is dead.
   Evidence: components/auth/sign-in-button.tsx has zero importers; login/signup use inline server-
             action forms instead.
   Impact:   dead UI code.
   Status:   ✅ REMOVED 2026-06-19 (Session 6) — owner-approved `git rm` of sign-in-button.tsx. See CHANGELOG.md.

Q-004  [MED]    allowDangerousEmailAccountLinking: true.
   Evidence: auth.ts:57 (original — the flag, now removed).
   Impact:   harmless with a single Google provider, but if another provider is ever added, an
             attacker controlling an email at a second IdP could link into an existing account.
   Status:   ✅ RESOLVED 2026-06-19 (Session 7) — owner-approved REMOVAL of the flag (auth.ts:57 deleted →
             defaults to false). Provably regression-free: the lone provider is Google (auth.config.ts:12 is
             providers:[]; Google added in auth.ts:53), and User/Account rows are created ONLY by the NextAuth
             PrismaAdapter at sign-in — repo-wide grep finds zero user.create/createUser/account.create paths
             (blueprint.ts/students only user.update), so the orphaned-User state that makes Auth.js throw
             OAuthAccountNotLinked cannot exist and removal changes no normal sign-in. Default-secure: a future
             2nd provider can no longer silently link same-email accounts (the footgun the finding warned of).
             Two adversarial lenses confirmed breaksSignIn=false + re-graded the latent risk LOW. See CHANGELOG.md.

Q-005  [LOW]    organizationId is stamped on the JWT only at login.
   Evidence: auth.ts:38-44; mitigated by resolveTenant/getCurrentUserOrg re-reading the DB.
   Impact:   the session token's org can be stale (null right after onboarding); any code trusting
             session.user.organizationId directly (instead of getCurrentUserOrg) would misbehave.
             Audit direct session-org reads in 24-….
   Audit:    (Session 6, 2026-06-19) the ONLY direct read of the JWT-stamped session.user.organizationId
             is proxy.ts:59, which uses it solely to validate the active-profile cookie binding
             (token.org === orgId). A stale-null org there fails CLOSED (activeType=null → redirect
             /select-profile), never a cross-tenant grant, and org only ever transitions null→real once
             (users never change org). The proxy runs at the edge with no DB, so getCurrentUserOrg (a
             Prisma read) is structurally unavailable. All ~80 other org reads compare a Prisma row
             against the getCurrentUserOrg DB re-read (auth-helpers.ts:18-21, 77 callers).
   Status:   ✅ RESOLVED 2026-06-19 (Session 6) — correct-by-design; audit complete, no code change. See CHANGELOG.md.

Q-006  [INFO]   deleteAccount is a tenant-wide destructive cascade.
   Evidence: account-actions.ts:43-186.
   Impact:   correctly OWNER-gated and atomic, but it is the single most dangerous action for the
             seeded production data. Flagged so it is never triggered casually.
   Status:   documented
```
