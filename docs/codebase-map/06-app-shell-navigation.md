# 06 — App Shell, Layout & Navigation
> Source of truth: the files in §1, read end-to-end. Written against commit b585c1e.

## 1. Scope
| File | Role |
|---|---|
| `src/app/layout.tsx` | Root layout: fonts, globals, providers (Nuqs, StudentProfile, Toaster), wraps `GlobalShell`; fetches `auth()` + `getActiveProfile()` server-side. |
| `src/app/page.tsx` | Home route. Auth/org/profile gating, then routes to `StudentDashboard` or `ParentDashboard` by active profile type. |
| `src/app/loading.tsx` | Global route-segment loading spinner. |
| `src/app/error.tsx` | Global error boundary (client). Renders message + reset button. |
| `src/components/layout/GlobalShell.tsx` | Client shell: chromeless vs sidebar layout based on pathname; renders `Sidebar` + `<main>`. |
| `src/components/layout/Sidebar.tsx` | The live primary nav (logo, NAV_ITEMS, footer links, SessionTimer, AccountMenu, mobile drawer). |
| ~~`src/components/layout/SidebarClientIslands.tsx`~~ | Alt "client island" sidebar parts (`SidebarNavigation`/`MobileSidebarToggle`/`SettingsButton`). **Deleted 2026-06-19** (was dead — Q-06-004). |
| `src/components/layout/SessionTimer.tsx` | Tiny client widget counting minutes on page; shown in Sidebar footer. |
| ~~`src/components/layout/CommandPalette.tsx`~~ | Cmd/Ctrl-K command dialog. **Deleted 2026-06-19** (was dead — Q-06-005). |
| ~~`src/components/layout/CreationDrawer.tsx`~~ | Right-side sheet embedding `GeneratorsClient`; hardcoded org placeholder. **Deleted 2026-06-19** (was dead — Q-06-001; its hardcoded org placeholder was Q-06-002). |
| `src/components/navigation/AccountMenu.tsx` | Sidebar account dropdown: active profile, Switch Profile, (parent) Account Settings + Family Blueprint. Wired by Sidebar. |
| ~~`src/components/navigation/MainNav.tsx`~~ | Legacy top nav bar (logo, home, discipleship, UserNav). **Deleted 2026-06-19** (was dead — Q-06-003). |
| ~~`src/components/navigation/UserNav.tsx`~~ | Legacy avatar dropdown (Profile Settings / All About Me / Log out). **Deleted 2026-06-19** (was dead — Q-06-003; only importer was the also-dead MainNav). |
| ~~`src/components/navigation/ContextNav.tsx`~~ | URL-context breadcrumb card + `useContextPreservation` hook. **Deleted 2026-06-19** (was dead, zero importers — Q-06-001). |
| `src/components/navigation/InklingToolkit.tsx` | 4-card tool launcher grid. Wired by `ParentDashboard`. |
| `src/components/icons/arrow-left.tsx` | Phosphor `ArrowLeft` re-export. Used by onboarding-wizard. |
| `src/components/icons/arrow-right.tsx` | Phosphor `ArrowRight` re-export. Used by onboarding-wizard. |
| `src/components/icons/check-circle.tsx` | Phosphor `CheckCircle` re-export. Used by onboarding-wizard. |
| `src/components/icons/google-logo.tsx` | Phosphor `GoogleLogo` re-export. Used by login/signup. |
| `src/components/icons/plus.tsx` | Phosphor `Plus` re-export. Used by classroom/schedule steps. |
| `src/components/icons/sign-in.tsx` | Phosphor `SignIn` re-export. Used by login. |
| `src/components/icons/trash.tsx` | Phosphor `Trash` re-export. Used by classroom/schedule steps. |
| `src/components/icons/user-plus.tsx` | Phosphor `UserPlus` re-export. Used by signup. |

## 2. Purpose / intent
This chapter is the application chrome: the root HTML/font/provider setup, the home dashboard router, and the persistent left sidebar with its account menu, session timer, and footer. The home page is a thin profile-aware router — STUDENT profiles land on their own learner dashboard, PARENT profiles get the full classroom dashboard with an optional `?studentId` peek. The icon files are thin Phosphor re-exports kept as a stable local import surface for auth/onboarding screens. A second generation of navigation primitives once shadowed the live shell; the dead `CommandPalette`, `MainNav`/`UserNav`, `SidebarClientIslands`, `CreationDrawer`, and `ContextNav` have all been deleted (2026-06-19), so this chapter now carries **no dead nav/shell surface** (Q-06-001 ✅ removed). The active shell is `GlobalShell` → `Sidebar` → `AccountMenu`.

## 3. Architecture & key files
- **Root layout** (`layout.tsx:30-52`): server component. Loads two Google fonts as CSS vars (`--font-body`, `--font-display`, `layout.tsx:9-20`), sets `metadata` (`:22-25`), then `auth()` (`:35`) and `getActiveProfile()` (`:36`). Wraps children in `NuqsAdapter` → `StudentProfileProvider` → `GlobalShell` (passing `session?.user` + `activeProfile`) and renders a global Sonner `Toaster` (`:46`). `suppressHydrationWarning` on `<html>`/`<body>`.
- **GlobalShell** (`GlobalShell.tsx:17-37`): client. `CHROMELESS_PREFIXES = ["/select-profile"]` (`:15`) — those routes render bare children (`:23-25`); everything else gets `<Sidebar>` + a left-margined `<main>` (`lg:ml-64`, `:30`).
- **Sidebar** (`Sidebar.tsx:44-132`): client. Static `NAV_ITEMS` array (`:23-31`) of 7 routes with Phosphor icons; active-state via `pathname` prefix match (`:82`). Footer holds `SessionTimer` (`:105`), static legal/feedback links (`:106-112`), and `AccountMenu` rendered only when both `user && activeProfile` (`:114-118`). Mobile drawer via local `mobileOpen` state (`:46,52-54,124-129`).
- **AccountMenu** (`AccountMenu.tsx:35-84`): Radix dropdown showing the active profile avatar/name. `Switch Profile` always present and calls the `switchProfile()` server action (`:61`); parents additionally get `Account Settings` (opens `ProfileSettingsDialog`, `:66-68,80`) and a `Family Blueprint` link to `/context` (`:69-73`). Exports the `AccountMenuProfile` type reused by GlobalShell/Sidebar/layout.
- **Home router** (`page.tsx`): described in §4.
- **InklingToolkit** (`InklingToolkit.tsx:37-97`): framer-motion 4-card grid linking Creation Station / Courses / Thinkling / Living Library; consumed by `ParentDashboard` (`ParentDashboard.tsx:6,94`).
- **Icons**: each file (e.g. `arrow-left.tsx:6-8`) is a `"use client"` wrapper that re-exports a single Phosphor icon with `IconProps`.

## 4. Data flow
Home request trace (`page.tsx`):
1. `searchParams` awaited (`:14`); `auth()` (`:15`) → no user ⇒ `redirect("/login")` (`:16`).
2. `getCurrentUserOrg(session)` (`:18`) → no `organizationId` ⇒ `redirect("/onboarding")` (`:19`). This is the canonical tenant gate (see 04-…).
3. `getActiveProfile()` (`:22`) → none ⇒ `redirect("/select-profile")` (`:23`).
4. STUDENT branch (`:26-34`): `getLearnerIdForProfile(active.id, organizationId)` (`:27`) → `getStudentDashboardData(organizationId, learnerId)` (`:29`) → render `StudentDashboard` with `viewMode` (`:30`); fail-safe `redirect("/select-profile")` (`:33`) if no learner/data.
5. PARENT branch: optional `?studentId` peek calls `getStudentDashboardData(organizationId, searchParams.studentId)` (`:37-40`); otherwise `getParentDashboardData(organizationId)` (`:42`, its student list now excludes parent-as-learner rows — Q-05-006) + `getMyLearning(active.id, organizationId)` (`:43`) → `ParentDashboard` (`:44-54`).

Both queries take `organizationId` from `getCurrentUserOrg`, so the home route is org-scoped. (Verify the downstream query implementations in their own chapters; see 02-data-model / 04-security-auth-tenancy.)

Shell render flow: `layout.tsx` (server, fetches user + activeProfile) → `GlobalShell` (client, picks chromeless vs sidebar) → `Sidebar` (client, renders nav + `AccountMenu`). `AccountMenu`'s Switch Profile invokes the `switchProfile` server action from `@/app/select-profile/actions` (`AccountMenu.tsx:16,61`).

SessionTimer: pure client; `setInterval` increments minutes every 60s (`SessionTimer.tsx:9-14`), hidden until ≥1 min (`:16`).

## 5. Status table
| Unit | Status | Evidence |
|---|---|---|
| `layout.tsx` RootLayout | DONE | App root; renders shell + providers (`layout.tsx:30-52`). |
| `page.tsx` HomePage | DONE | `/` route; full gating + dashboard routing (`page.tsx:11-55`). |
| `loading.tsx` | DONE | Default segment loading UI (`loading.tsx:1-10`). |
| `error.tsx` | DONE | Route error boundary, `"use client"` + reset (`error.tsx:1-26`). |
| `GlobalShell` | DONE | Imported by layout (`layout.tsx:4,43`); chromeless logic live (`GlobalShell.tsx:19-25`). |
| `Sidebar` | DONE | Imported by GlobalShell (`GlobalShell.tsx:4,29`). |
| `AccountMenu` | DONE | Imported/rendered by Sidebar (`Sidebar.tsx:37,116`). |
| `SessionTimer` | DONE | Rendered by Sidebar (`Sidebar.tsx:20,105`). |
| `InklingToolkit` | DONE | Imported by ParentDashboard (`ParentDashboard.tsx:6,94`). |
| Icons (all 8) | DONE | All imported by onboarding/login/signup (see §6 importers). |
| ~~`SidebarClientIslands`~~ (`SidebarNavigation`/`MobileSidebarToggle`/`SettingsButton`) | ✅ REMOVED (2026-06-19) | deleted — all 3 exports dead, zero importers repo-wide (Q-06-004). |
| `CommandPalette` | ✅ REMOVED (2026-06-19) | deleted — was dead (Q-06-005 / Q-06-001). |
| ~~`CreationDrawer`~~ | ✅ REMOVED (2026-06-19) | deleted — was dead, zero importers (Q-06-001). Deleting it also removed Q-06-002's hardcoded org placeholder and orphaned `@/components/ui/sheet` (also removed — ch.07). |
| ~~`ContextNav` + `useContextPreservation`~~ | ✅ REMOVED (2026-06-19) | deleted — both exports dead, zero importers (Q-06-001). |
| ~~`MainNav`~~ | ✅ REMOVED (2026-06-19) | deleted — was dead, zero importers (Q-06-003). |
| ~~`UserNav`~~ | ✅ REMOVED (2026-06-19) | deleted — was dead; only importer was the also-removed `MainNav` (Q-06-003). |

## 6. Integration points
- **Imports in (live shell):** `@/components/layout/GlobalShell`, `@/components/providers/StudentProfileProvider`, `@/auth` (`auth`), `@/server/profiles/active-profile` (`getActiveProfile`), `nuqs/adapters/next/app`, `sonner`, `next/font/google` — all in `layout.tsx`. `page.tsx` imports `@/lib/auth-helpers` (`getCurrentUserOrg`), `@/server/profiles/{active-profile,queries,my-learning}`, `@/server/queries/dashboard`, and the two dashboard components.
- **Importers out:** `GlobalShell` ← layout; `Sidebar` ← GlobalShell; `AccountMenu`/`SessionTimer` ← Sidebar; `InklingToolkit` ← `ParentDashboard`; icons ← `onboarding-wizard.tsx`, `classroom-step.tsx`, `schedule-step.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`.
- **Server actions:** `switchProfile` from `@/app/select-profile/actions` (`AccountMenu.tsx:16`). (The legacy `signOut`-from-`next-auth/react` dead path in `UserNav` was deleted 2026-06-19 — Q-06-003.)
- **Env vars:** none directly in these files.
- **External APIs:** Google Fonts (Inter, Cormorant Garamond) via `next/font/google`; `@phosphor-icons/react`; `framer-motion`; `sonner`.
- **Prisma models:** none direct here — all DB access is delegated to `src/server/profiles/*` and `src/server/queries/dashboard.ts` (see those chapters / 02-data-model).
- **Inngest jobs:** none.

## 7. Findings

Q-06-001  [MED]  ✅ REMOVED 2026-06-19 (Session 12, 06-MED) — the last two dead second-generation nav/shell files deleted (owner-approved; a 3-lens adversarial Workflow was unanimous REMOVE — reachability proof, collapsed "wire-it-instead" steelman, orphan/tail enumeration). Large dead second-generation nav/shell surface — ~~`CommandPalette.tsx`~~, ~~`MainNav.tsx`~~, ~~`UserNav.tsx`~~, ~~`SidebarClientIslands.tsx`~~, ~~`CreationDrawer.tsx`~~, ~~`ContextNav.tsx`~~ (all deleted)
  Evidence: At resolution, grep across `**/*.{ts,tsx}` returned only the definition sites (`CreationDrawer.tsx:10`, `ContextNav.tsx:16,103`) — zero importers via static import, dynamic `import()`/`next/dynamic`/`lazy`, string path, or barrel re-export (no `index.ts` in either dir). The live shell is `GlobalShell` → `Sidebar` → `AccountMenu`; neither file was imported by it or any route. The "wire-it" case collapsed: Creation Station is already reachable three live ways (Sidebar NAV_ITEMS `Sidebar.tsx:28`, `InklingToolkit` card, and `CreationStationClient`'s own "Quick Create" tab), and `ContextNav` had zero producers (nothing set its URL params → always rendered `null`).
  Impact: Eliminated ~2 files of unreachable UI that drifted from the live `Sidebar`/`AccountMenu`. Deleting `CreationDrawer` orphaned exactly one module — `@/components/ui/sheet` (its sole importer) — which was also removed (ch.07 §5; no npm dep orphaned, `@radix-ui/react-dialog` is shared with `dialog.tsx`). `ContextNav` orphaned nothing (all its imports have 75–93 importers).
  Status: ✅ REMOVED (`CreationDrawer.tsx` + `ContextNav.tsx` deleted; `ui/sheet.tsx` removed as the orphan tail; not pushed — see CHANGELOG.md)

Q-06-002  [MED]  ✅ RESOLVED 2026-06-19 (Session 12, 06-MED) — resolved by removal: the buggy line was deleted with its (dead) host file `CreationDrawer.tsx` (Q-06-001). CreationDrawer passed a hardcoded org placeholder to GeneratorsClient — `src/components/layout/CreationDrawer.tsx:44`
  Evidence: `<GeneratorsClient organizationId="current-org-id-placeholder" />`; the in-file comment (`:36-43`) acknowledged it. The live `/creation-station` route never had this bug — it resolves the real org server-side via `getCurrentUserOrg()` (`page.tsx:13`) and passes it through `CreationStationClient` to `GeneratorsClient` (`GeneratorsClient.tsx:35,225`).
  Impact: Was latent (component DEAD); if `CreationDrawer` had ever been wired, every generation request would have been scoped to a literal bogus org id — a tenant-scoping/correctness bug. Eliminated entirely by deleting the dead file.
  Status: ✅ RESOLVED (removed with `CreationDrawer.tsx`; not pushed — see CHANGELOG.md)

Q-06-003  [LOW]  ✅ REMOVED 2026-06-19 (Session 11, 06-LOW) — deleted the dead legacy `UserNav.tsx` + its dead sole-importer `MainNav.tsx` (owner-approved; verified build-safe — see CHANGELOG.md). Two divergent account dropdowns (profile-aware vs legacy) — `AccountMenu.tsx` vs `UserNav.tsx`
  Evidence: Live `AccountMenu` is profile-aware (Switch Profile / parent-gated Account Settings + Family Blueprint, `AccountMenu.tsx:35-84`). Dead `UserNav` offered a different menu (Profile Settings / "All About Me" → `/context` / Log out via `signOut`, `UserNav.tsx:51-67`); its only importer was the also-dead `MainNav.tsx` (zero importers repo-wide), so the pair was deleted together (deleting `UserNav` alone would break `MainNav`'s import). `AccountMenu` keeps its own `ProfileSettingsDialog` import, so nothing was orphaned; tsc 0 before and after.
  Impact: Drift risk — the divergent stale dropdown could be revived by a future reader. Eliminated by removal.
  Status: ✅ REMOVED (`UserNav.tsx` + `MainNav.tsx` deleted; not pushed)

Q-06-004  [LOW]  ✅ REMOVED 2026-06-19 (Session 11, 06-LOW) — deleted the whole dead `SidebarClientIslands.tsx` (all 3 exports unused; owner-approved; see CHANGELOG.md). `MobileSidebarToggle` "client island" controls nothing — `src/components/layout/SidebarClientIslands.tsx:57-95`
  Evidence: It emitted a `<style jsx global>` setting `.sidebar-mobile-control { transform: ... }` (`:83-92`) but no element in the repo used that class (Grep `sidebar-mobile-control` → only this file), and neither it nor its siblings (`SidebarNavigation`/`SettingsButton`) had any importer. The live `Sidebar.tsx` already implements the identical mobile drawer with working state (`Sidebar.tsx:46-127`), so "wire it instead" would only have duplicated live behavior.
  Impact: Non-functional dead code. Removed.
  Status: ✅ REMOVED (`SidebarClientIslands.tsx` deleted; not pushed)

Q-06-005  [LOW]  ✅ RESOLVED 2026-06-19 — `CommandPalette.tsx` deleted (owner decision; dead ⌘K palette + its stray icon imports gone). CommandPalette used semantically wrong icons for actions — `src/components/layout/CommandPalette.tsx:81,85` (deleted)
  Evidence: "Create Course" uses `Calculator` (`:81`) and "Scan Book" uses `Smiley` (`:85`); the Phosphor import block (`:14-25`) pulls in several never-rendered icons (`Calendar` `:16`, `CreditCard` `:17`, `Gear` `:18`, `User` `:20`).
  Impact: Cosmetic/quality only; component is DEAD. Indicates copy-paste from a template (cmdk demo) that was never finished.
  Status: documented (not fixed)

Q-06-006  [INFO]  ✅ RESOLVED 2026-06-19 — error boundary now shows a static message + error.digest (no raw error.message) (see CHANGELOG.md). `error.tsx` renders raw `error.message` to the user — `src/app/error.tsx:16`
  Evidence: `<p ...>{error.message}</p>` shows the thrown message directly in the global error boundary.
  Impact: Could surface internal error strings to end users. Low risk (Next.js strips messages from server errors in prod, exposing only `digest`), but client-thrown messages render verbatim.
  Status: documented (not fixed)
