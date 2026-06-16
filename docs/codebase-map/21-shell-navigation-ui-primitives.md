# Subsystem 21 — App Shell, Layout, Navigation, UI Primitives & Shared Utils

> Code-truth reference. Everything below was verified against source on the `main` branch (commit `38fec0d`).
> Where the repo's prose/markdown disagrees with code, **the code wins**. Citations are `path:line`.

---

## Purpose & role in the app

This subsystem is the **chrome and the toolbox** for QuillNext ("Quill & Compass"):

- The **root layout** (`src/app/layout.tsx`) that wires fonts, the `nuqs` URL-state adapter, the `StudentProfileProvider`, the persistent app shell, and the Sonner toast portal around every page.
- The **app shell**: `GlobalShell` → `Sidebar` (the only live navigation surface) → `UserNav` + `SessionTimer`.
- **Global error / loading** boundaries for the App Router.
- **Static legal/marketing pages**: `/about`, `/privacy`, `/terms`, `/changelog`.
- The **shadcn-style UI primitive set** under `src/components/ui/` (24 files) — the entire design system's component layer, built mostly on Radix UI + `class-variance-authority` + `cn()`.
- The **design tokens** (`qc-*` CSS custom properties) defined in `src/app/globals.css` and consumed by every primitive.
- **Shared utilities**: `cn()` + `getStudentAvatarUrl()` (`lib/utils.ts`), a Next.js cache wrapper (`lib/cache.ts`), an error-taxonomy helper (`server/utils/errorTaxonomy.ts`), a generic Zod-resolver form hook (`hooks/useZodForm.ts`), and a large bag of server-action Zod schemas (`lib/schemas/actions.ts`).

**Tenancy / auth posture (subsystem-wide):** These files are almost entirely **presentational and tenancy-agnostic**. The single place that touches auth is the root layout, which calls `auth()` once and threads `session.user` down into the shell. None of the UI primitives, none of the static pages, and none of the shared utils call `getCurrentUserOrg`/`auth` themselves or touch Prisma. (The schemas in `lib/schemas/actions.ts` are *validators* consumed by server actions in other subsystems; they enforce no auth themselves.)

**Major caveat (see Risks):** A large fraction of the "navigation" components in this subsystem are **dead / orphaned** — `MainNav`, `CommandPalette`, `CreationDrawer`, `ContextNav`, and the entire `SidebarClientIslands` file have **zero render sites** in the codebase. The live nav is just `Sidebar`.

---

## File-by-file reference

### Root layout & boundaries

#### `src/app/layout.tsx` — Root layout (Server Component)
- **Role:** The App Router root layout; wraps every route.
- **Server/client:** Server Component, **`async`**. Calls `auth()` (`layout.tsx:34`) to get the NextAuth session.
- **Key behavior:**
  - Loads two Google fonts via `next/font/google`: `Inter` → `--font-body`, `Cormorant_Garamond` → `--font-display` (`layout.tsx:9-20`). These CSS variables are attached to `<html>` (`layout.tsx:37`) and referenced by Tailwind theme tokens in `globals.css`.
  - `metadata.title = "QuillNext"` / `description = "Curriculum generation platform"` (`layout.tsx:22-25`). Note this is the bare engineering name, not the "Quill & Compass" brand used on the static pages.
  - Provider stack (outer→inner): `NuqsAdapter` (`nuqs/adapters/next/app`) → `StudentProfileProvider` → `GlobalShell user={session?.user}` → `{children}`, with `<Toaster position="bottom-right" richColors closeButton />` (Sonner) mounted as a sibling of the shell (`layout.tsx:39-46`).
  - `suppressHydrationWarning` on both `<html>` and `<body>` (`layout.tsx:37-38`).
- **Drift / smell:** The `import { auth } from "@/auth"` statement is placed **in the middle of the file** at line 27, after `metadata` — unusual but legal.
- **Tenancy:** Reads `session?.user` only; the `organizationId` is carried on the session (see `src/auth.ts` jwt/session callbacks) but the layout never reads it.

#### `src/app/error.tsx` — Global error boundary (Client Component)
- `"use client"`. Default export `Error({ error, reset })` (`error.tsx:1-9`).
- Renders a centered parchment card showing **`error.message` verbatim** (`error.tsx:16`) and a "Try again" button calling `reset()`.
- **Risk:** Leaking raw `error.message` to end users can expose internal/stack detail. Low severity but worth noting for a faith-family product.

#### `src/app/loading.tsx` — Global loading UI (Server Component)
- Default export `Loading()` — a centered spinner (`border-t-qc-primary`) + "Loading…" text. No props, no logic.

### Static pages (all Server Components, all tenancy-free)

#### `src/app/about/page.tsx`
- `metadata.title = "About — Quill & Compass"`. Marketing/values page: mission, funding transparency ("bootstrapped and self-funded"), seven design principles (Calm Technology, Attention Respect, Data Sovereignty, AI Transparency, Child Safety, Analog Warmth, Accessibility), contact, support policy.
- **Contact email: `adam@quillandcompass.app`** (`about/page.tsx:125`). (The auto-memory lists the owner email as `hello@hilowstudio.dev`; the *product* contact in code is `adam@quillandcompass.app`. Both are "true" in different contexts — code uses the product address everywhere.)
- Footer "← Back to QuillNext" links to `/`.

#### `src/app/privacy/page.tsx`
- `metadata.title = "Privacy Policy — Quill & Compass"`. Effective/updated **March 30, 2026**.
- Plain-language summary + full policy. **Documents the real third-party surface of the app** (authoritative-ish but unverified against actual integrations): Google OAuth, Google Gemini AI, Firebase Storage, Inngest, Joshua Project API, ESV Bible API, Google Books API (`privacy/page.tsx:150-191`). Claims "no analytics, no cookies beyond auth, instructor PINs hashed with bcrypt."
- Contact `adam@quillandcompass.app`.

#### `src/app/terms/page.tsx`
- `metadata.title = "Terms of Service — Quill & Compass"`. Effective/updated **March 30, 2026**.
- Standard ToS: data ownership, AI-content disclaimer, acceptable use, 30-day service-change notice, 90-day shutdown notice, liability cap "$0 (Service is free)". Contact `adam@quillandcompass.app`.
- **Inconsistency:** §7 says material changes get **30 days** email notice (`terms/page.tsx:125`); the plain-language summary on the same page implies notice "before it happens." Minor.

#### `src/app/changelog/page.tsx`
- `metadata.title = "Changelog — Quill & Compass"`. Hard-coded changelog entries for Jan/Feb/Mar 2026. Pure static prose; not data-driven.

> All four static pages share the same layout idiom: `min-h-screen` centered `max-w-3xl` parchment container, `font-display` headings, `qc-prose` body, footer "← Back to QuillNext" linking `/`. They are linked from the live `Sidebar` footer (`Sidebar.tsx:106-110`).

### App shell (`src/components/layout/`)

#### `GlobalShell.tsx` — Shell wrapper (Server Component)
- Exports `GlobalShell({ children, user })`. Renders a flex row: `<Sidebar user={user} />` + a `<main className="flex-1 lg:ml-64 …">` containing a `max-w-7xl` container with `animate-in fade-in` (`GlobalShell.tsx:9-21`). No `"use client"` — it's a server component that simply forwards `user`.
- The `lg:ml-64` hard-codes the 16rem sidebar offset; the sidebar is `w-64` and `fixed` (`Sidebar.tsx:57-58`).

#### `Sidebar.tsx` — **The one live navigation surface** (Client Component)
- `"use client"`. Exports `Sidebar({ user })`.
- **`NAV_ITEMS`** (`Sidebar.tsx:23-31`) — the canonical primary nav map (Phosphor icons):
  | Label | Href | Icon |
  |---|---|---|
  | Dashboard | `/` | `House` |
  | Students | `/students` | `Student` |
  | Courses | `/courses` | `ChalkboardTeacher` |
  | Living Library | `/living-library` | `BookOpen` |
  | Creation Station | `/creation-station` | `Sparkle` |
  | Thinkling Chat | `/thinkling` | `Lightbulb` |
  | Discipleship | `/family-discipleship` | `Heart` |
- Active-state logic: `pathname === href || (href !== "/" && pathname.startsWith(href))` (`Sidebar.tsx:81`); active items get `weight="fill"` icons and `bg-qc-primary/10 text-qc-primary`.
- Local `mobileOpen` state drives a slide-in drawer (`-translate-x-full` ↔ `translate-x-0`) + a backdrop overlay; on `lg` it's always visible (`Sidebar.tsx:57-60,128-134`). The mobile trigger is a `fixed top-4 left-4 z-50` button toggling `List`/`X` (`Sidebar.tsx:50-54`).
- Logo: `next/image` `/assets/branding/Quill-and-Compass.png` linking `/`.
- Footer: `<SessionTimer />`, then text links to `/about`, `/changelog`, `/privacy`, `/terms`, and a `mailto:adam@quillandcompass.app` "Feedback" link (`Sidebar.tsx:103-111`). Below that, when `user` is present, `<UserNav user={user} />` + name/email block (`Sidebar.tsx:113-123`).
- **Note:** `Sidebar` and `SidebarClientIslands.SidebarNavigation` contain **duplicated nav-link rendering logic** — the islands file was clearly an in-progress refactor (server-shell + client-island split) that was never adopted. `Sidebar` is the live one.

#### `SidebarClientIslands.tsx` — **DEAD CODE** (Client Component)
- `"use client"`. Exports `SidebarNavigation`, `MobileSidebarToggle`, `SettingsButton`.
- **Zero importers anywhere in `src/`** (verified). This is an abandoned "server shell + client islands" refactor of `Sidebar`. `MobileSidebarToggle` even tries to coordinate state via a global `<style jsx>` block writing a `.sidebar-mobile-control` transform (`SidebarClientIslands.tsx:83-94`) — a pattern that never got wired to a parent. `SettingsButton` references an `onOpenSettings` that no live caller provides.

#### `CommandPalette.tsx` — **DEAD CODE** (Client Component)
- `"use client"`. Exports `CommandPalette()`. A ⌘K/Ctrl-K command palette built on `ui/command` (`CommandDialog`), with hard-coded suggestions (Students/Courses/Living Library) and actions (Create Course → `/courses/new`, Scan Book → `/living-library/scan`) (`CommandPalette.tsx:64-88`).
- **Zero render sites.** The ⌘K listener (`CommandPalette.tsx:32-41`) is never mounted, so the shortcut is **not active** in the running app. Icons are mismatched/placeholder (`Calculator` for "Create Course", `Smiley` for "Scan Book").

#### `CreationDrawer.tsx` — **DEAD CODE** (Client Component)
- `"use client"`. Exports `CreationDrawer()`. A right-side `Sheet` that re-mounts `GeneratorsClient` from `@/app/creation-station/GeneratorsClient`.
- **Zero render sites.** Also half-built by its own admission: it passes `organizationId="current-org-id-placeholder"` (`CreationDrawer.tsx:44`) and an inline comment notes `GeneratorsClient` "expects to read URL params … suggests a future refactor task." Returns `null` on `/creation-station/*` to avoid double UI.

#### `SessionTimer.tsx` — Live (Client Component)
- `"use client"`. Exports `SessionTimer()`. A `setInterval` ticking once per minute; renders nothing for the first minute, then a small `Clock` + elapsed-time badge ("Nm" / "Hh Mm") with a `title` tooltip (`SessionTimer.tsx:6-32`). This is the "Session duration awareness indicator" referenced in the changelog. Purely client-side; resets on every full reload.

### Navigation (`src/components/navigation/`)

#### `MainNav.tsx` — **DEAD CODE** (Client Component)
- `"use client"`. Exports `MainNav({ user })`. A top header bar (logo + Home icon + Family-Discipleship heart + `UserNav`) with a `mounted` guard to dodge hydration mismatch.
- **Zero render sites.** Superseded by the left `Sidebar`. Computes `isMyClassroomActive` but never uses it (`MainNav.tsx:28-31`); imports `Card`/`CardContent` (`MainNav.tsx:7`) that are never rendered.

#### `ContextNav.tsx` — **DEAD CODE** (Client Component) + a hook
- `"use client"`. Exports component `ContextNav({ studentId, courseId, objectiveId, bookId })` and hook `useContextPreservation()`.
- The component reads `studentId/courseId/objectiveId/bookId` from URL search params, shows "X Selected" chips and a "Generate with Context" → `/creation-station?…` button; "Clear" does a `window.location.href = pathname` full nav (`ContextNav.tsx:84-92`).
- **Zero render sites** for the component; `useContextPreservation` is also unused. Entirely orphaned. (Note `nuqs`/`StudentProfileProvider` is the *live* mechanism for `studentId` URL state, making this component redundant.)

#### `InklingToolkit.tsx` — **LIVE** (Client Component)
- `"use client"`. Exports `InklingToolkit()`. A 4-card grid (`framer-motion` hover lift) linking to the AI tools:
  - Creation Station → `/creation-station`
  - Course Constructor → `/courses`
  - Thinkling Chat → `/thinkling`
  - Living Library → `/living-library`
  (`InklingToolkit.tsx:10-35`). Branded with `/assets/branding/Inkling.png`.
- **Rendered by `src/components/dashboard/ParentDashboard.tsx:131`** (the only consumer in this subsystem's cross-link map). Active-state via `pathname.startsWith`.
- **Minor bug:** the "Open Tool →" affordance uses `opacity-0 group-hover:opacity-100` but no ancestor has the `group` class, so it never reveals on hover (`InklingToolkit.tsx:86`).

#### `UserNav.tsx` — **LIVE** (Client Component)
- `"use client"`. Exports `UserNav({ user })`. A Radix dropdown anchored to the user `Avatar` (image with `referrerPolicy="no-referrer"`, falling back to first-two-initials). Menu items: **Profile Settings** (opens `ProfileSettingsDialog`), **All About Me** → `/context`, and **Log out** → `signOut({ callbackUrl: "/login" })` (`UserNav.tsx:52-67`).
- Consumed by `Sidebar.tsx:116` (live) and `MainNav.tsx:82` (dead).

#### `ProfileSettingsDialog.tsx` — **LIVE** (Client Component)
- `"use client"`. Exports `ProfileSettingsDialog({ user, open, onOpenChange })`. The account-management modal, opened from `UserNav`. Three tabs (`ui/tabs`):
  - **Profile:** display name + profile-image-URL form → `updateProfile()` server action from `@/app/actions/user-actions` (`ProfileSettingsDialog.tsx:27,57`).
  - **Security:** read-only — explains auth is Google-managed; email + password fields are disabled placeholders (no functionality).
  - **Data & Privacy:** Export → `exportUserData()` (`@/app/actions/data-export`) builds a client-side JSON blob download (`ProfileSettingsDialog.tsx:71-97`); Deactivate → `deactivateAccount()`; Delete (type-`DELETE`-to-confirm) → `deleteAccount()` (`@/app/actions/account-actions`), each followed by `signOut({ callbackUrl: "/login" })`.
- This is the **end-to-end home of the QSF "data rights" features** (export/deactivate/delete) the changelog advertises. The server actions live in other subsystems (`app/actions/*`).

### Icons (`src/components/icons/`) — 8 thin client wrappers
Each file is a 1-component `"use client"` re-export of a Phosphor icon, e.g.:
```tsx
"use client";
import { ArrowLeft as PhosphorArrowLeft } from "@phosphor-icons/react";
export function ArrowLeft(props: IconProps) { return <PhosphorArrowLeft {...props} />; }
```
Files: `arrow-left`, `arrow-right`, `check-circle`, `google-logo`, `plus`, `sign-in`, `trash`, `user-plus`.
- **Why they exist:** to create a `"use client"` boundary so Phosphor icons can be imported into **Server Components** (login/signup/onboarding pages) without making the page a client component. Verified consumers: `app/login/page.tsx`, `app/signup/page.tsx`, `components/onboarding/{classroom-step,onboarding-wizard,schedule-step}.tsx`.

### Print (`src/components/print/`)

#### `PrintLayout.tsx` — Print/PDF primitives (Server-safe, no directive)
- Exports `PrintLayout`, `PrintSection`, `PrintBox`, `PrintGrid`, `PrintTitle`.
- Simulates an 8.5×11in sheet (`max-w-[8.5in] min-h-[11in] … p-[0.5in]`) with `print:` overrides that strip shadow/padding for real printing (`PrintLayout.tsx:11-28`). `PrintSection` supports `breakBefore` (page-break) and `avoid-break`; `PrintBox` enforces a strict `height` budget with `overflow-hidden`; `PrintGrid` does deterministic N-column grids; `PrintTitle` is a bordered display heading. `debug` mode draws a dashed "Safe Zone" guide. Used by the transcript/print-export flows in other subsystems.

### UI primitives (`src/components/ui/`) — the design system (24 files)

All primitives compose classes through `cn()` (`lib/utils.ts`) and lean on the `qc-*` design tokens (`globals.css`). Most are standard **shadcn/ui** components on **Radix** with brand restyling. Inventory:

**CVA-variant components (brand-restyled):**
- `button.tsx` — `buttonVariants` cva. Variants: `default` (qc-primary, with a `!text-[#ffffff]` override at `button.tsx:11`), `secondary`, `outline`, `ghost`, `link`, `destructive`; sizes `default/sm/lg/icon` (heights 11/10/12, icon 11×11 → ~44px touch targets). Uses Radix `Slot` for `asChild`.
- `badge.tsx` — `badgeVariants` cva. Variants: `default/secondary/outline/success/warning/error/info/ai`. The `ai` variant (violet) is the **"AI-generated content" label** the privacy/terms pages promise (`badge.tsx:24-25`).

**Radix-wrapped primitives** (each `"use client"`, `*Primitive` import, brand classes):
`alert-dialog` (Radix alert-dialog, pulls `buttonVariants`), `avatar` (Radix avatar), `checkbox` (Radix + Phosphor `Check`), `dialog` (Radix dialog + lucide `XIcon`), `dropdown-menu` (Radix + lucide check/chevron/circle), `popover`, `progress`, `radio-group` (+ lucide `Circle`), `scroll-area`, `select` (Radix + Phosphor carets/check), `sheet` (Radix **dialog** under the hood + lucide `XIcon`), `slider`, `switch`, `tooltip`.

**Non-Radix / plain components:**
- `input.tsx`, `textarea.tsx`, `label.tsx` — plain elements + `cn()`. (`textarea` uses generic `border-input`/`ring-ring` tokens, not the `qc-*` set — minor inconsistency.)
- `card.tsx` — `Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter`; `font-display` titles, `qc-surface` bg.
- **`tabs.tsx` — CUSTOM, not Radix.** A hand-rolled context implementation (`TabsContext` + controlled/uncontrolled `value`) (`tabs.tsx:6-99`). `TabsContent` returns `null` when inactive (no Radix a11y wiring). This is what `ProfileSettingsDialog` and other dialogs use.
- `calendar.tsx` — wraps `react-day-picker`'s `DayPicker` + lucide chevrons. **Drift risk:** `package.json` pins `react-day-picker@^9.12.0`, but this file uses the **v8-style `classNames`/`components` API** — likely broken or relying on legacy compat (flagged in Risks).
- `combobox-with-create.tsx` — composite (`Popover` + `Command` + lucide icons) "select-or-create" combobox; exports `ComboboxWithCreate` + `ComboboxOption` type. Has a raw `"{inputValue}"` with literal quotes in JSX (`combobox-with-create.tsx:96`).
- `command.tsx` — shadcn `cmdk` wrapper: `Command/CommandDialog/CommandInput/CommandList/CommandEmpty/CommandGroup/CommandItem/CommandShortcut/CommandSeparator`. Renders inside `ui/dialog`. Used by the (dead) `CommandPalette` and (live) `ComboboxWithCreate`.
- `form.tsx` — shadcn react-hook-form bridge: `Form` (= `FormProvider`), `FormField`, `FormItem`, `FormControl`, `FormLabel`, `FormDescription`, `FormMessage`, `useFormField`. **Bug:** `useFormField` calls `getFieldState(fieldContext.name, …)` *before* the `if (!fieldContext)` null-guard, so the guard is effectively dead (`form.tsx:42-44`). Also imports `Slot` twice (`Slot` and `RadixSlot`, the latter unused) (`form.tsx:4-5`).

**Icon libraries in play:** the UI set mixes **Phosphor** (`checkbox`, `select`) and **lucide-react** (`command`, `dialog`, `dropdown-menu`, `radio-group`, `calendar`, `combobox`, `sheet`) — both are dependencies; no single convention.

### Shared hooks / utils / schemas

#### `src/hooks/useZodForm.ts`
- `useZodForm(schema, options)` — thin wrapper around `react-hook-form`'s `useForm` with `zodResolver(schema)`. Heavy `as any` casts to bridge Zod↔RHF generics (`useZodForm.ts:10-11`).
- **Only one consumer:** `src/components/students/CreateStudentForm.tsx`. (The codebase-map doc `12-students-…` references it too, but that's prose.) Despite being a "shared" hook, adoption is ~nil.

#### `src/lib/utils.ts`
- `cn(...inputs)` — `twMerge(clsx(inputs))`. **The single most-imported function in the subsystem** (every primitive uses it).
- `getStudentAvatarUrl(seed, config?)` — builds a DiceBear `9.x/lorelei` SVG avatar URL, appending config params (`config: any`). Consumers: `dashboard/{StudentDashboard,ParentDashboard,StudentProfileSwitcher}.tsx`, `students/StudentCard.tsx`. **External dependency on `api.dicebear.com`** at render time.

#### `src/lib/cache.ts` — **effectively DEAD CODE**
- Exports `CACHE_TAGS` (key builders for student/studentProfile/objectives/masterContext/books), `CACHE_REVALIDATE` (TTL constants), and `withCache(fn, keyParts, tags, revalidate)` wrapping `unstable_cache`.
- **No importers anywhere** except itself (verified). The entire caching layer is defined but **never wired in**. Any "caching" the app does is not coming through here.

#### `src/server/utils/errorTaxonomy.ts`
- Exports `ERROR_CATEGORIES`, `ERROR_CODES`, class `StandardError`, and `createSuccessResponse(data, message?, meta?, requestId?)`.
- **Only one consumer:** `src/server/actions/bible-study.ts` (`bible-study.ts:4`). So this "standard" error/response envelope is used by exactly one server action; the rest of the app returns ad-hoc `{ success, error }` shapes (e.g. `ProfileSettingsDialog` consumers). Half-adopted convention.

#### `src/lib/schemas/actions.ts` — Generic server-action Zod schemas (Zod v4)
- A flat catalog of validators grouped by domain: Course, Course Block, Student, Resource Generation, Assignment, User, Grading, YouTube/Video, Library, Bible-Study/Discipleship, Scheduling (`actions.ts:12-223`).
- **Actual adoption is partial.** Of ~30 exported schemas, only 6 are imported anywhere:
  - `deleteBlockSchema`, `updateBlockSchema`, `deleteCourseSchema` → `app/actions/course-actions.ts`
  - `deleteStudentSchema` → `app/actions/student-actions.ts`
  - `searchLibrarySchema` → `app/actions/library-lookup-actions.ts`
  - `fetchPlaylistSchema` → `app/actions/youtube-actions.ts`
  - `createPrayerJournalSchema` → `server/actions/prayer-journal.ts`
  - The many create/update schemas (`createCourseSchema`, `createStudentSchema`, `generateResourceSchema`, `submitGradeSchema`, `createBibleStudySchema`, `createHeartCheckSchema`, `createScheduleItemSchema`, …) are **defined but unused** — i.e., those server actions either validate inline or don't validate. Treat this file as a *partially-realized* validation plan.

---

## Data models & tenancy

- **Prisma models touched by this subsystem: none directly.** No file here imports `@/server/db`/Prisma or runs a query. The root layout's `auth()` call transitively hits the DB (NextAuth `PrismaAdapter` + JWT callbacks in `src/auth.ts`), but that's the auth subsystem, not this one.
- **Session shape relied upon:** `session.user` = NextAuth `User` (`name`, `email`, `image`, `id`) plus a non-typed `organizationId` injected by the jwt/session callbacks (`src/auth.ts:39-52`). This subsystem only reads `name/email/image`; it never reads `id`/`organizationId`.
- **Tenancy:** No org-scoping happens in any file here. The `lib/schemas/actions.ts` validators are org-agnostic (they validate UUIDs/strings; org enforcement is the responsibility of the consuming server actions).
- **`lib/cache.ts`** *names* student/org-ish cache tags but, being dead, scopes nothing.

---

## Entry points & end-to-end flows

**Flow 1 — Every page render (the live shell):**
`Request` → `app/layout.tsx` (`auth()` → session) → `NuqsAdapter` → `StudentProfileProvider` (binds `?studentId=` URL state via `nuqs`) → `GlobalShell` → `Sidebar` (renders `NAV_ITEMS`, footer legal links, `SessionTimer`, `UserNav`) + `{children}` in `<main>` → Sonner `<Toaster>` portal for toasts. Active nav highlight is derived client-side from `usePathname()`.

**Flow 2 — User menu / account management:**
`Sidebar` → `UserNav` (avatar dropdown) → "Profile Settings" opens `ProfileSettingsDialog` →
- Profile tab → `updateProfile({name,image})` (server action) → `toast` + close.
- Data tab → `exportUserData()` → JSON `Blob` → browser download; or `deactivateAccount()`/`deleteAccount()` → `signOut({callbackUrl:"/login"})`.
"Log out" in the dropdown → `signOut({callbackUrl:"/login"})`. "All About Me" → `/context`.

**Flow 3 — AI-tool launcher (dashboard):**
`ParentDashboard` → `InklingToolkit` (4 cards) → `Link` to `/creation-station` | `/courses` | `/thinkling` | `/living-library`.

**Flow 4 — Primary navigation:** `Sidebar.NAV_ITEMS` links → `/`, `/students`, `/courses`, `/living-library`, `/creation-station`, `/thinkling`, `/family-discipleship`; footer → `/about`, `/changelog`, `/privacy`, `/terms`, `mailto:`.

**Dead entry points (defined, never reachable):** ⌘K command palette (`CommandPalette`), context-preservation bar (`ContextNav`), in-place creation drawer (`CreationDrawer`), top header nav (`MainNav`), the client-island sidebar refactor (`SidebarClientIslands`).

---

## External dependencies & services

- **UI / styling:** `@radix-ui/*` (alert-dialog, avatar, checkbox, dialog, dropdown-menu, label, popover, progress, radio-group, scroll-area, select, slider, switch, tooltip), `class-variance-authority`, `tailwind-merge`, `clsx`, `tailwindcss` v4 (`@theme` tokens in `globals.css`), `tailwindcss-animate`.
- **Icons:** `@phosphor-icons/react` (primary, e.g. Sidebar/CommandPalette/select/checkbox) **and** `lucide-react` (command/dialog/dropdown/calendar/etc.) — both present.
- **Commands/combobox:** `cmdk`. **Calendar:** `react-day-picker` (v9 installed, v8 API in code — see Risks).
- **Forms:** `react-hook-form` + `@hookform/resolvers/zod` + `zod` v4.
- **Toasts:** `sonner` (`<Toaster>` in root layout).
- **URL state:** `nuqs` (`NuqsAdapter` in layout; `useQueryState` in `StudentProfileProvider`).
- **Motion:** `framer-motion` (only in `InklingToolkit`).
- **Auth:** `next-auth` v5 beta (`auth()` in layout; `signOut` in `UserNav`/`ProfileSettingsDialog`).
- **Fonts:** Google `Inter` + `Cormorant_Garamond` via `next/font`.
- **Runtime external HTTP:** `api.dicebear.com` (avatars, via `getStudentAvatarUrl`). Branding images served locally from `/assets/branding/*`.

---

## Auth / security posture

- **Single auth touchpoint:** `app/layout.tsx` `await auth()` (NextAuth v5, JWT strategy). Session/user flows down as a prop; no UI primitive or static page authenticates independently.
- **No org/tenancy enforcement in this subsystem.** It is presentational; data-access authorization lives in the server actions it *calls* (`updateProfile`, `exportUserData`, `deactivate/deleteAccount`) — those must do their own `getCurrentUserOrg`/ownership checks (out of scope here, but a dependency to verify).
- **Sign-out** consistently routes to `/login` via `signOut({callbackUrl:"/login"})`.
- **Avatar privacy:** `referrerPolicy="no-referrer"` on `AvatarImage` (`UserNav.tsx:34`) avoids leaking referrers to Google's image CDN.
- **Security smells:**
  - `app/error.tsx` renders raw `error.message` to users (info-disclosure, low severity).
  - `lib/schemas/actions.ts` uses `z.any()` for `avatarConfig` and `responses` (`actions.ts:87,98,201`) — unvalidated blobs reach whatever action consumes them.
  - `ProfileSettingsDialog` accepts an arbitrary `image` URL with no validation (stored as the user's avatar) — possible SSRF/embedding vector depending on how it's later rendered/fetched.

---

## Risks, drift, dead-code & half-built

**Dead / orphaned (zero render or import sites — verified):**
1. `components/navigation/MainNav.tsx` — never rendered.
2. `components/navigation/ContextNav.tsx` (component **and** `useContextPreservation` hook) — never used.
3. `components/layout/CommandPalette.tsx` — never mounted ⇒ **⌘K shortcut is dead in the live app.**
4. `components/layout/CreationDrawer.tsx` — never rendered; self-flagged as needing refactor; ships a `"current-org-id-placeholder"`.
5. `components/layout/SidebarClientIslands.tsx` (all three exports) — abandoned shell-refactor.
6. `lib/cache.ts` (`withCache`, `CACHE_TAGS`, `CACHE_REVALIDATE`) — defined, **never imported** ⇒ no caching layer is actually in use.
7. Most of `lib/schemas/actions.ts` — ~24 of ~30 schemas are unused (validation plan only partially realized).

**Library/version drift:**
8. `ui/calendar.tsx` targets the **react-day-picker v8 API** while `package.json` installs **v9.12.0** — likely broken/legacy; needs a manual smoke test wherever the calendar is used.
9. Mixed icon libraries (Phosphor + lucide) with no convention.
10. `ui/textarea.tsx` uses generic shadcn tokens (`border-input`, `ring-ring`) instead of the `qc-*` design tokens used by `input`/`button` — visual inconsistency.

**Bugs:**
11. `ui/form.tsx` `useFormField`: null-guard placed **after** the deref it guards (`form.tsx:42-44`) — guard is dead; duplicate `Slot` import (one unused).
12. `navigation/InklingToolkit.tsx`: `group-hover:opacity-100` with no `group` ancestor ⇒ the "Open Tool →" affordance never appears (`InklingToolkit.tsx:86`).
13. `navigation/MainNav.tsx`: computes `isMyClassroomActive` and imports `Card`/`CardContent` but uses none.
14. `ui/combobox-with-create.tsx`: literal quote chars rendered around `{inputValue}` (`:96`).

**Doc/brand drift:**
15. Root layout metadata says **"QuillNext / Curriculum generation platform"** while every user-facing page brands as **"Quill & Compass"** with the tagline "Calm tools for intentional education."
16. `changelog.tsx` is hand-maintained static prose (not derived from git) — guaranteed to drift from reality.
17. Privacy/terms "Last Updated March 30, 2026" and the third-party-services table are **unverified** against the actual integration code; treat as marketing copy, not a source of truth.
18. Adopted-but-barely conventions: `useZodForm` (1 consumer), `errorTaxonomy`/`createSuccessResponse` (1 consumer). New code inconsistently follows either.

---

## Cross-links to other subsystems

- **Auth** (`src/auth.ts`, `src/auth.config.ts`): supplies the session the shell renders; `organizationId` injected here.
- **Providers** (`src/components/providers/StudentProfileProvider.tsx`): owned by the layout in this subsystem but its `?studentId=` state is consumed by Students/Dashboards subsystems.
- **Dashboards** (`src/components/dashboard/*`): `ParentDashboard` is the **only live consumer of `InklingToolkit`**; `getStudentAvatarUrl` is consumed by `StudentDashboard`, `ParentDashboard`, `StudentProfileSwitcher`, and `students/StudentCard`.
- **Account/data actions** (`app/actions/user-actions.ts`, `app/actions/data-export.ts`, `app/actions/account-actions.ts`): the server-action targets of `ProfileSettingsDialog`. **Verify their auth/ownership checks.**
- **Server actions consuming `lib/schemas/actions.ts`**: `app/actions/{course-actions,student-actions,library-lookup-actions,youtube-actions}.ts`, `server/actions/prayer-journal.ts`.
- **`errorTaxonomy` consumer**: `server/actions/bible-study.ts`.
- **`useZodForm` consumer**: `components/students/CreateStudentForm.tsx`.
- **Icon-wrapper consumers**: `app/login/page.tsx`, `app/signup/page.tsx`, `components/onboarding/*`.
- **`PrintLayout` consumers**: transcript/print-export flows (e.g. transcript PDF export subsystem).
- **`CreationDrawer` (dead) would depend on** `app/creation-station/GeneratorsClient` (Creation Station subsystem).

---

## Open questions

1. Should the dead nav stack (`MainNav`, `CommandPalette`, `CreationDrawer`, `ContextNav`, `SidebarClientIslands`) be deleted, or are they parked for a planned redesign? As-is they're bundle bloat and a maintenance trap. (Note the changelog never advertised ⌘K, so removing `CommandPalette` is safe UX-wise.)
2. Is `lib/cache.ts` meant to be wired up (perf), or removed? Currently the app has **no `unstable_cache` layer** despite the file existing.
3. Is `ui/calendar.tsx` actually functional under react-day-picker v9, or silently broken? Needs a render test.
4. Should `lib/schemas/actions.ts` be the *enforced* validation layer for all server actions? Right now only ~20% of it is used; the rest is aspirational.
5. Does `updateProfile` validate/sanitize the free-form `image` URL accepted by `ProfileSettingsDialog`? (Potential stored-SSRF / unsafe-image vector.)
6. Should `app/error.tsx` stop surfacing raw `error.message` to end users?
7. Branding canonicalization: align root-layout `metadata` ("QuillNext") with the user-facing "Quill & Compass" brand?
