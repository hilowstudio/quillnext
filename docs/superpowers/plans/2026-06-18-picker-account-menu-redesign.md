# Picker Polish + Profile-Aware Account Menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the `/select-profile` picker (rename heading, un-clip the lock badge, per-card avatar editing with a PIN gate for protected profiles, masked PIN inputs) and turn the sidebar's account section into a profile-aware menu (active profile's avatar/name; Switch Profile for everyone; Account Settings + Family Blueprint for PARENT only; Sign Out moved inside Account Settings).

**Architecture:** Two new PARENT-agnostic-but-PIN-checked server actions (`verifyProfilePin`, `setProfileAvatar`) reuse the durable PIN throttle. `AvatarCustomizer` becomes persistence-agnostic (a required async `onSave`) so both the student dashboard and the picker can drive it. The root layout fetches `getActiveProfile()` and threads it through `GlobalShell` → `Sidebar` → a reworked account menu. Switching consolidates into that menu, so the dead legacy "Switch Profile" button on the student dashboard is removed.

**Tech Stack:** Next 16 (server actions, `next/headers`), Prisma 7 + RLS (`withTenant`), bcryptjs, the Slice-2/5 active-profile + throttle helpers, DiceBear `AvatarCustomizer`, shadcn/Radix UI, Vitest.

---

## Background — verified

- **Picker** [`ProfilePicker.tsx`](../../../src/components/profile/ProfilePicker.tsx): heading "Who's learning today?"; each card is a single `<button>`; the lock badge is `absolute bottom-1 right-1` **inside** the `relative h-28 w-28 rounded-full overflow-hidden` circle (so it's clipped); the select-PIN `<Input>` has no `type` (visible digits).
- **AvatarCustomizer** [`AvatarCustomizer.tsx`](../../../src/components/profile/AvatarCustomizer.tsx): props `{ studentId, initialConfig?, initialName?, onSave?, open, onOpenChange }`; `handleSave` (≈285) does `await saveStudentAvatarConfig(studentId, finalConfig)` then `onSave?.(finalConfig)`. Used by `StudentDashboard`.
- **Avatar storage:** picker cards render `Profile.avatarConfig` (via `ProfileCard`); `saveStudentAvatarConfig` writes `Learner.avatarConfig`. So a profile edit must write `Profile.avatarConfig` (+ the linked `Learner.avatarConfig` to keep the student dashboard in sync).
- **PIN throttle/actions:** `src/server/profiles/pin-throttle.ts` (`checkProfilePinThrottle`/`recordProfilePinFailure`/`clearProfilePinThrottle`), `src/server/profiles/pin-actions.ts` (`setProfilePin`/`removeProfilePin`, `PinActionResult`), `pinSchema` (`@/lib/schemas/pin`). bcrypt verify pattern is in `selectProfile`.
- **Sidebar/account** [`Sidebar.tsx`](../../../src/components/layout/Sidebar.tsx) footer `{user && …}` block shows `UserNav` + name/email + the Slice-3 Switch Profile form. [`UserNav.tsx`](../../../src/components/navigation/UserNav.tsx) dropdown: label(name/email) → "Profile Settings" (opens `ProfileSettingsDialog`) / "All About Me" (→ `/context`) / "Log out" (`signOut`). [`ProfileSettingsDialog.tsx`](../../../src/components/navigation/ProfileSettingsDialog.tsx) title is already "Account Settings".
- **Shell data flow:** [`layout.tsx`](../../../src/app/layout.tsx) (server) renders `<GlobalShell user={session?.user}>`; [`GlobalShell.tsx`](../../../src/components/layout/GlobalShell.tsx) is `"use client"`, route-aware, renders `<Sidebar user={user}/>`.
- **`getActiveProfile()`** returns `{ id, organizationId, type, displayName, avatarConfig, viewMode, userId, isOwner }` or null.
- **StudentDashboard** [line ~73](../../../src/components/dashboard/StudentDashboard.tsx#L73): a `<Button onClick={() => setActiveStudentId(null)}>Switch Profile</Button>` — legacy nuqs, does NOT clear the cookie → remove it.

> **Test note:** new server actions get focused unit tests (mock the seams). UI is verified by `tsc` + `npm run build`. Re-run `npm test` if it flakes to "no tests" (do NOT change the vitest version).

---

## File Structure

- `src/server/profiles/pin-actions.ts` — **MODIFY.** Add `verifyProfilePin(profileId, pin)`.
- `src/server/profiles/avatar-actions.ts` — **NEW.** `setProfileAvatar(profileId, config, pin?)` (PIN-checked; updates Profile + linked Learner).
- `src/server/profiles/pin-actions.test.ts` / `avatar-actions.test.ts` — **NEW/MODIFY.** Action tests.
- `src/components/profile/AvatarCustomizer.tsx` — **MODIFY.** Persistence-agnostic `onSave`.
- `src/components/dashboard/StudentDashboard.tsx` — **MODIFY.** Update its `AvatarCustomizer` `onSave`; remove the legacy Switch Profile button.
- `src/components/profile/ProfilePicker.tsx` — **MODIFY.** Heading, lock badge outside circle, card restructure + edit pencil + avatar-edit/PIN flow, masked PIN input.
- `src/components/profile/ManageProfiles.tsx` — **MODIFY.** Mask the PIN input.
- `src/components/navigation/AccountMenu.tsx` — **NEW.** The profile-aware account menu (replaces `UserNav` in the sidebar footer).
- `src/components/navigation/ProfileSettingsDialog.tsx` — **MODIFY.** Add a "Sign Out" control inside the dialog.
- `src/components/layout/Sidebar.tsx` — **MODIFY.** Footer uses `AccountMenu`; accept `activeProfile`.
- `src/components/layout/GlobalShell.tsx` — **MODIFY.** Accept + pass `activeProfile`.
- `src/app/layout.tsx` — **MODIFY.** Fetch `getActiveProfile()`, pass to `GlobalShell`.

---

## Task 1: `verifyProfilePin` + `setProfileAvatar` actions (TDD)

**Files:** Modify `src/server/profiles/pin-actions.ts`; Create `src/server/profiles/avatar-actions.ts` + `avatar-actions.test.ts`; Modify `pin-actions.test.ts`.

- [ ] **Step 1: Add `verifyProfilePin` to `pin-actions.ts`** (after `removeProfilePin`):

```ts
import { checkProfilePinThrottle, recordProfilePinFailure, clearProfilePinThrottle } from "@/server/profiles/pin-throttle";
import bcrypt from "bcryptjs"; // (already imported at top — do not duplicate)

/**
 * Verify a profile's PIN WITHOUT any side effect beyond the throttle counters. Returns ok:true when
 * the profile has no PIN (nothing to verify). org-scoped, rate-limited. NOT a management action, so
 * it is intentionally not PARENT-guarded — it gates editing a profile's own avatar from the picker.
 */
export async function verifyProfilePin(profileId: string, pin: string): Promise<PinActionResult> {
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const profile = await withTenant(
    (tx) => tx.profile.findUnique({ where: { id: profileId }, select: { id: true, organizationId: true, pinHash: true } }),
    undefined,
    { organizationId, userId: null },
  );
  if (!profile || profile.organizationId !== organizationId) return { ok: false, error: "Profile not found." };
  if (!profile.pinHash) return { ok: true };

  const gate = await checkProfilePinThrottle(profile.id, organizationId, Date.now());
  if (!gate.allowed) return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterMs / 1000)}s.` };
  const ok = await bcrypt.compare(pin, profile.pinHash);
  if (!ok) {
    await recordProfilePinFailure(profile.id, organizationId, Date.now());
    return { ok: false, error: "Incorrect PIN." };
  }
  await clearProfilePinThrottle(profile.id, organizationId);
  return { ok: true };
}
```

> `getCurrentUserOrg`, `withTenant`, `bcrypt`, `PinActionResult` are already imported/defined in `pin-actions.ts`. Only add the throttle import.

- [ ] **Step 2: Create `avatar-actions.ts`:**

```ts
"use server";

import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { verifyProfilePin, type PinActionResult } from "@/server/profiles/pin-actions";

/**
 * Update a profile's avatar. Anyone in the org may edit (cosmetic), BUT if the profile is
 * PIN-protected the correct PIN must be supplied (verified + rate-limited server-side). Writes
 * Profile.avatarConfig and syncs the linked Learner.avatarConfig so the student dashboard matches.
 */
export async function setProfileAvatar(profileId: string, config: unknown, pin?: string): Promise<PinActionResult> {
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const profile = await withTenant(
    (tx) => tx.profile.findUnique({
      where: { id: profileId },
      select: { id: true, organizationId: true, pinHash: true, learner: { select: { id: true } } },
    }),
    undefined,
    { organizationId, userId: null },
  );
  if (!profile || profile.organizationId !== organizationId) return { ok: false, error: "Profile not found." };

  if (profile.pinHash) {
    const verified = await verifyProfilePin(profileId, pin ?? "");
    if (!verified.ok) return verified;
  }

  await withTenant(
    async (tx) => {
      await tx.profile.update({ where: { id: profileId }, data: { avatarConfig: config as never } });
      if (profile.learner) {
        await tx.learner.update({ where: { id: profile.learner.id }, data: { avatarConfig: config as never } });
      }
    },
    undefined,
    { organizationId, userId: null },
  );
  return { ok: true };
}
```

> `Profile.learner` is the back-relation (`Learner?`). Confirm it selects (it's defined in `schema.prisma`). If `tsc` flags `as never`, use `as Prisma.InputJsonValue`.

- [ ] **Step 3: Tests** — `avatar-actions.test.ts` (mock `@/lib/auth-helpers`, `@/server/db`, and `@/server/profiles/pin-actions`'s `verifyProfilePin`): foreign-org → "Profile not found"; no-PIN profile → updates (verify not called); PIN'd profile with wrong PIN → returns the verify error, no update; PIN'd profile with right PIN → updates Profile (+learner when present). Add `verifyProfilePin` cases to `pin-actions.test.ts`: no-PIN → ok; wrong PIN → "Incorrect PIN" + record; right PIN → ok + clear; throttle-blocked → "Too many attempts". Mock `@/server/profiles/pin-throttle`.

- [ ] **Step 4:** `npx vitest run src/server/profiles/pin-actions.test.ts src/server/profiles/avatar-actions.test.ts` → green. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**
```bash
git add src/server/profiles/pin-actions.ts src/server/profiles/pin-actions.test.ts src/server/profiles/avatar-actions.ts src/server/profiles/avatar-actions.test.ts
git commit -m "feat(profiles): verifyProfilePin + setProfileAvatar (PIN-gated avatar edit, syncs learner)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Make `AvatarCustomizer` persistence-agnostic

**Files:** Modify `src/components/profile/AvatarCustomizer.tsx`, `src/components/dashboard/StudentDashboard.tsx`.

- [ ] **Step 1:** In `AvatarCustomizer.tsx`: remove `import { saveStudentAvatarConfig } …`; change the prop to a required async saver: `onSave: (config: any) => Promise<{ ok: boolean; error?: string }>`. Rewrite `handleSave`:

```ts
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const finalConfig = cleanConfig({ ...config, seed: config.seed || initialName });
            const result = await onSave(finalConfig);
            if (result.ok) {
                toast.success("Avatar updated!");
                onOpenChange(false);
            } else {
                toast.error(result.error || "Failed to save avatar");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };
```

`studentId` is no longer used internally for saving — keep the prop (used as a seed fallback / by callers) but it no longer drives persistence.

- [ ] **Step 2:** In `StudentDashboard.tsx`, update the `AvatarCustomizer` usage's `onSave` to drive the learner save + local state:

```tsx
                onSave={async (newConfig) => {
                    const res = await saveStudentAvatarConfig(student.id, newConfig);
                    if (res.success) setAvatarConfig(newConfig);
                    return { ok: res.success };
                }}
```

Add `import { saveStudentAvatarConfig } from "@/app/actions/student";` to `StudentDashboard.tsx` if not present.

- [ ] **Step 3:** `npx tsc --noEmit` → clean. (Commit with Task 4, since the picker also consumes the new `onSave`.)

---

## Task 3: Picker — heading, lock badge, masked PIN, avatar editing

**Files:** Modify `src/components/profile/ProfilePicker.tsx`.

- [ ] **Step 1: Heading** — change `Who&apos;s learning today?` → `Select a profile`.

- [ ] **Step 2: Restructure the card + lock badge outside the circle.** The card must stop being a single `<button>` (so the edit pencil can be its own button). Replace each card with a `<div className="group relative flex flex-col items-center gap-4">` containing: (a) the avatar circle as a clickable region for select, (b) the lock badge as a sibling of the `overflow-hidden` circle (so it isn't clipped), (c) an edit pencil button. Structure:

```tsx
          <div key={p.id} className="group relative flex flex-col items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => choose(p)}
                disabled={pending}
                aria-label={`Select ${p.displayName}`}
                className="block h-28 w-28 rounded-full overflow-hidden ring-4 ring-white shadow-lg group-hover:ring-qc-primary/30 transition-all duration-300 transform group-hover:scale-105 disabled:opacity-60"
              >
                <Avatar className="h-full w-full">
                  <AvatarImage src={getStudentAvatarUrl(p.displayName, p.avatarConfig)} alt={p.displayName} referrerPolicy="no-referrer" />
                  <AvatarFallback className="text-4xl font-bold bg-qc-parchment-crumpled text-qc-primary">
                    {p.displayName?.[0] ?? "?"}
                  </AvatarFallback>
                </Avatar>
              </button>
              {/* Lock badge — sibling of the clipped circle so it overflows uncut. */}
              {p.hasPin && (
                <span className="absolute -bottom-1 -right-1 z-10 rounded-full bg-white p-1.5 shadow ring-1 ring-qc-border-subtle">
                  <LockSimple className="h-4 w-4 text-qc-primary" weight="fill" />
                </span>
              )}
              {/* Edit avatar */}
              <button
                type="button"
                onClick={() => startAvatarEdit(p)}
                disabled={pending}
                aria-label={`Edit ${p.displayName}'s avatar`}
                className="absolute -top-1 -right-1 z-10 rounded-full bg-white p-1.5 shadow ring-1 ring-qc-border-subtle opacity-0 group-hover:opacity-100 transition-opacity hover:text-qc-primary"
              >
                <PencilSimple className="h-4 w-4" />
              </button>
            </div>
            <span className="font-display text-xl font-medium text-qc-charcoal group-hover:text-qc-primary transition-colors">
              {p.displayName}
            </span>
          </div>
```

Add `PencilSimple` to the `@phosphor-icons/react` import.

- [ ] **Step 3: Mask the select PIN input** — add `type="password"` to the existing select-PIN `<Input>` (keep `inputMode="numeric"`, `maxLength={4}`, the digit-only `onChange`). Also add `type="password"` to the **manage-entry** PIN `<Input>` (the `enterProfileManagement` dialog).

- [ ] **Step 4: Avatar-edit flow.** Add state + handlers and the customizer/PIN dialog. State: `const [avatarFor, setAvatarFor] = useState<ProfileCard | null>(null); const [avatarPinFor, setAvatarPinFor] = useState<ProfileCard | null>(null); const [avatarPin, setAvatarPin] = useState(""); const [avatarPinError, setAvatarPinError] = useState<string | null>(null);`

```tsx
  function startAvatarEdit(p: ProfileCard) {
    setAvatarPinError(null);
    if (p.hasPin) {
      setAvatarPin("");
      setAvatarPinFor(p);
    } else {
      setAvatarFor(p);
    }
  }

  function submitAvatarPin() {
    if (!avatarPinFor || avatarPin.length !== 4) return;
    const target = avatarPinFor;
    startTransition(async () => {
      const res = await verifyProfilePin(target.id, avatarPin);
      if (res.ok) {
        setAvatarPinFor(null);
        setAvatarFor(target); // open the customizer, holding the verified pin
      } else {
        setAvatarPinError(res.error);
      }
    });
  }
```

Render the customizer (note: hold the verified `avatarPin` for the save when the profile has a PIN):

```tsx
      {avatarFor && (
        <AvatarCustomizer
          studentId={avatarFor.id}
          initialName={avatarFor.displayName}
          initialConfig={avatarFor.avatarConfig}
          open={avatarFor != null}
          onOpenChange={(o) => { if (!o) setAvatarFor(null); }}
          onSave={async (config) => {
            const res = await setProfileAvatar(avatarFor.id, config, avatarFor.hasPin ? avatarPin : undefined);
            if (res.ok) router.refresh();
            return res;
          }}
        />
      )}
```

Add a masked PIN dialog for `avatarPinFor` (same shape as the select dialog: title "Enter PIN to edit avatar", masked input, `submitAvatarPin`). Add imports: `useRouter` from `next/navigation`, `AvatarCustomizer`, `verifyProfilePin` (`@/server/profiles/pin-actions`), `setProfileAvatar` (`@/server/profiles/avatar-actions`), and `const router = useRouter();`.

- [ ] **Step 5:** `npx tsc --noEmit` → clean. Commit Tasks 2+3:
```bash
git add src/components/profile/AvatarCustomizer.tsx src/components/dashboard/StudentDashboard.tsx src/components/profile/ProfilePicker.tsx
git commit -m "feat(profiles): picker avatar editing (PIN-gated) + 'Select a profile' + uncut lock badge + masked PIN

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Mask the ManageProfiles PIN input

**Files:** Modify `src/components/profile/ManageProfiles.tsx`.

- [ ] **Step 1:** Add `type="password"` to the set-PIN `<Input>` in `ManageProfiles`. `tsc` → clean. Commit:
```bash
git add src/components/profile/ManageProfiles.tsx
git commit -m "feat(profiles): mask the PIN input in Manage Profiles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Profile-aware account menu + Sign Out inside Account Settings

**Files:** Create `src/components/navigation/AccountMenu.tsx`; Modify `ProfileSettingsDialog.tsx`, `Sidebar.tsx`, `GlobalShell.tsx`, `src/app/layout.tsx`.

- [ ] **Step 1: Thread the active profile to the shell.** In `src/app/layout.tsx`, add `import { getActiveProfile } from "@/server/profiles/active-profile";`, fetch `const activeProfile = await getActiveProfile();`, and pass it: `<GlobalShell user={session?.user} activeProfile={activeProfile}>`. In `GlobalShell.tsx`, add `activeProfile` to the props type (a minimal `{ displayName: string; avatarConfig: unknown; type: "PARENT" | "STUDENT" } | null`) and pass it to `<Sidebar user={user} activeProfile={activeProfile} />`.

- [ ] **Step 2: `AccountMenu.tsx`** (client) — the dropdown trigger shows the active profile's avatar + name; menu items:
  - **Switch Profile** → `<form action={switchProfile}>` submit (always).
  - If `activeProfile.type === "PARENT"`: **Account Settings** (opens `ProfileSettingsDialog`) and **Family Blueprint** (`<Link href="/context">`).
  - No top-level Sign Out (it lives inside Account Settings).
  Uses `DropdownMenu*`, `Avatar`, `getStudentAvatarUrl`, `switchProfile` (`@/app/select-profile/actions`), `ProfileSettingsDialog`. Takes `{ user: User; activeProfile: {...} | null }` (passes `user` through to `ProfileSettingsDialog`). When `activeProfile` is null, render nothing.

- [ ] **Step 3: Sign Out inside `ProfileSettingsDialog`.** Add a "Sign Out" `<Button variant="outline">` (calling `signOut({ callbackUrl: "/login" })`) in the dialog — e.g. at the top of the "Data & Privacy" tab or a small footer row. (`signOut` is already imported.)

- [ ] **Step 4: Sidebar footer uses `AccountMenu`.** In `Sidebar.tsx`: add `activeProfile` to `SidebarProps`; replace the footer `{user && (…)}` block's `UserNav` + name/email + the standalone Switch Profile `<form>` with `{activeProfile && <AccountMenu user={user} activeProfile={activeProfile} />}` (keep the legal links + `SessionTimer`). Remove the now-unused `UserNav` import and the `switchProfile` import/`<form>`. Import `AccountMenu`.

- [ ] **Step 5:** `npx tsc --noEmit` → clean; `npm run build` → succeeds. Commit:
```bash
git add src/components/navigation/AccountMenu.tsx src/components/navigation/ProfileSettingsDialog.tsx src/components/layout/Sidebar.tsx src/components/layout/GlobalShell.tsx src/app/layout.tsx
git commit -m "feat(profiles): profile-aware account menu (switch/Account Settings/Family Blueprint) + Sign Out inside Account Settings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Remove the legacy Switch Profile button on the student dashboard

**Files:** Modify `src/components/dashboard/StudentDashboard.tsx`.

- [ ] **Step 1:** Remove the `<Button … onClick={() => setActiveStudentId(null)}>… Switch Profile</Button>` (≈line 73). If `setActiveStudentId`/`ArrowLeft` become unused, remove their references too (check `tsc`). Switching now lives in the sidebar `AccountMenu`.

- [ ] **Step 2:** `npx tsc --noEmit` → clean. Commit:
```bash
git add src/components/dashboard/StudentDashboard.tsx
git commit -m "refactor(profiles): drop dead legacy 'Switch Profile' button on student dashboard (now in the account menu)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Verification gate + self-review

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npm test` (re-run once if it flakes) → the new action tests + prior suites green.
- [ ] **Step 3:** `npm run build` → succeeds.
- [ ] **Step 4: Runtime smoke (dev):** picker shows "Select a profile", lock badge uncut, edit pencil on hover; editing a no-PIN profile's avatar works; editing a PIN'd profile prompts for the (masked) PIN first; the select PIN is masked. Sidebar account menu shows the active profile's avatar/name; PARENT sees Switch Profile + Account Settings + Family Blueprint (→ /context), with Sign Out inside Account Settings; a STUDENT sees only Switch Profile. The student dashboard no longer has its own Switch Profile button.
- [ ] **Step 5: Self-review** against the design (A picker, B masked PIN, C account menu) — all items mapped.

---

## Self-Review

- **Design coverage:** heading ✓ (T3); lock badge uncut ✓ (T3); per-card avatar edit + PIN gate ✓ (T1 actions + T3 UI); masked PINs ✓ (T3/T4); active-profile account menu ✓ (T5); Account Settings rename — the dropdown item is "Account Settings" and the dialog title already is ✓ (T5); Family Blueprint → /context ✓ (T5); Sign Out inside Account Settings ✓ (T5); student = Switch only ✓ (T5); legacy button removed ✓ (T6); avatar sync to Learner ✓ (T1).
- **Placeholder scan:** none — every step has concrete code, except the two clearly-bounded "if tsc objects" notes (`as never` cast, possibly-unused imports).
- **Type consistency:** `PinActionResult` (`{ok:true}|{ok:false,error}`) is reused by `verifyProfilePin`/`setProfileAvatar`/the picker handlers; `AvatarCustomizer.onSave` returns `{ ok; error? }` consumed by both call sites; `activeProfile` shape (`displayName`/`avatarConfig`/`type`) is consistent across `layout`→`GlobalShell`→`Sidebar`→`AccountMenu`.
- **Security:** `setProfileAvatar`/`verifyProfilePin` are org-scoped and PIN-checked (throttled) for protected profiles; `pinHash` never returned; the avatar edit can't bypass a PIN (server re-verifies on save).
- **No schema/migration.** UI + two actions only; reuses existing columns and the durable throttle.
