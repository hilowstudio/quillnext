# Profiles — Slice 3: Picker / Split Homepage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Who's learning today?" profile picker on a dedicated chrome-free `/select-profile` route, make `/` a split homepage driven by the active profile, let a profile be selected (with PIN verification for protected profiles), and ensure every account has profiles by creating the owner PARENT profile at onboarding and a STUDENT profile whenever a learner is added.

**Architecture:** A new `/select-profile` server page lists the org's profiles (new `listOrganizationProfiles` query, `pinHash` never leaves the server) and renders a client `<ProfilePicker>`. Selecting a card calls the `selectProfile` server action, which **pulls PIN *verification* forward from Slice 5** (bcrypt + best-effort rate-limit), then `setActiveProfile` (Slice 2) and redirects to `/`. `/` (`page.tsx`) gains an active-profile branch: no profile → redirect to the picker; `STUDENT` → that learner's dashboard; `PARENT` → existing dashboard. The picker gets its own sidebar-free shell by making `GlobalShell` **route-aware** (no route migration, no profile-state in the layout). Onboarding (`saveClassroomStep`) and the add-learner path (`/api/students`) create the owner PARENT / child STUDENT profiles via **shared deterministic id helpers** so they're idempotent and identical to the backfill.

**Tech Stack:** Next 16 App Router (Server Components, server actions, `redirect`), next-auth v5, Prisma 7 + RLS (`withTenant`), React `cache()`, `bcryptjs`, shadcn/Radix UI (`Dialog`/`Input`/`Button`/`Avatar`) + Tailwind v4 (`qc-` tokens), DiceBear (`getStudentAvatarUrl`), Vitest.

---

## Background — verified seam this slice plugs into

- **Homepage** [`src/app/page.tsx`](../../../src/app/page.tsx): Server Component — `auth()` → no session ⇒ `/login`; `getCurrentUserOrg` → no org ⇒ `/onboarding`; then branches on `?studentId` (`getStudentDashboardData(orgId, studentId)` → `<StudentDashboard student=…>`) else `getParentDashboardData(orgId)` → `<ParentDashboard …>`. It does **not** use `getActiveProfile()` yet.
- **Root layout** [`src/app/layout.tsx`](../../../src/app/layout.tsx) wraps **every** route in `<GlobalShell user={session?.user}>`. [`GlobalShell`](../../../src/components/layout/GlobalShell.tsx) renders `<Sidebar/>` + a `container` `<main>` unconditionally. [`Sidebar`](../../../src/components/layout/Sidebar.tsx) is already `"use client"` (uses `usePathname`).
- **Slice 2 helpers** [`src/server/profiles/active-profile.ts`](../../../src/server/profiles/active-profile.ts): `getActiveProfile()` (cached) → `{ id, organizationId, type, displayName, avatarConfig, viewMode, userId, isOwner }` or null (never `pinHash`); `setActiveProfile({ profileId, type })`; `clearActiveProfile()`. `ProfileType = "PARENT" | "STUDENT"` from [`src/lib/active-profile-cookie.ts`](../../../src/lib/active-profile-cookie.ts).
- **No profile-list query exists.** RLS pattern to copy (from `getStudentById`): `withTenant((tx) => tx.<model>.<op>(…), undefined, { organizationId, userId: null })`.
- **Avatars** [`StudentProfileSwitcher`](../../../src/components/dashboard/StudentProfileSwitcher.tsx) is the card template: `getStudentAvatarUrl(seed, avatarConfig)` (from `@/lib/utils`) + `Avatar/AvatarImage/AvatarFallback` (`@/components/ui/avatar`), `h-28 w-28` ring cards.
- **Backfill** [`src/server/profiles/backfill.ts`](../../../src/server/profiles/backfill.ts) uses deterministic ids `profile-user-${userId}` / `profile-learner-${learnerId}` (currently a private `pid()`).
- **Onboarding** [`saveClassroomStep`](../../../src/server/actions/blueprint.ts) creates Org+Classroom+Instructor and computes `pinHash = bcrypt.hash(instructorPin)` — but **no Profile**. The wizard does **not** create learners.
- **Add-learner** [`src/app/api/students/route.ts`](../../../src/app/api/students/route.ts) `POST` creates a `Learner` + empty `LearnerProfile` via **plain `db`** (not `withTenant`) — **no Profile**.
- **Tests:** Vitest, node env, files `src/**/*.test.ts`. No jsdom/RTL → **no React component unit tests**; UI is verified via `tsc`, `npm run build`, and a dev runtime check. The `@/` alias resolves in tests (added in Slice 2's `vitest.config.ts`).

> **PIN scope (signed off):** Slice 3 pulls PIN **verification** forward (so the PIN'd owner can actually enter). PIN **management** (set/change/remove) + the onboarding PIN-capture rewrite remain **Slice 5**. Durable/distributed rate-limiting is also Slice 5 — this slice ships a best-effort in-memory limiter.

---

## File Structure

- `src/server/profiles/ids.ts` — **NEW.** `parentProfileId(userId)` / `studentProfileId(learnerId)` — single source of the deterministic ids.
- `src/server/profiles/ids.test.ts` — **NEW.**
- `src/server/profiles/backfill.ts` — **MODIFY.** Use the shared id helpers.
- `src/server/profiles/profile-card.ts` — **NEW, pure.** `ProfileCard` type + `toProfileCard` (drops `pinHash` → `hasPin`).
- `src/server/profiles/profile-card.test.ts` — **NEW.**
- `src/server/profiles/queries.ts` — **NEW, server-only.** `listOrganizationProfiles()` + `getLearnerIdForProfile()`.
- `src/server/profiles/pin-rate-limit.ts` — **NEW, pure.** Best-effort attempt limiter.
- `src/server/profiles/pin-rate-limit.test.ts` — **NEW.**
- `src/app/select-profile/actions.ts` — **NEW, server actions.** `selectProfile` (+ PIN verify), `switchProfile`.
- `src/app/select-profile/actions.test.ts` — **NEW.** Fail-closed branches.
- `src/app/select-profile/page.tsx` — **NEW, server.** Guards + lists + renders the picker.
- `src/components/profile/ProfilePicker.tsx` — **NEW, client.** Cards + PIN dialog.
- `src/components/layout/GlobalShell.tsx` — **MODIFY.** Route-aware (client) — bare shell for `/select-profile`.
- `src/app/page.tsx` — **MODIFY.** Split-homepage branch.
- `src/server/actions/blueprint.ts` — **MODIFY.** Upsert owner PARENT profile in `saveClassroomStep`.
- `src/app/api/students/route.ts` — **MODIFY.** Create the child STUDENT profile + link.
- `src/components/layout/Sidebar.tsx` — **MODIFY.** "Switch Profile" entry.

---

## Task 1: Shared deterministic profile ids + backfill refactor

**Files:**
- Create: `src/server/profiles/ids.ts`
- Create: `src/server/profiles/ids.test.ts`
- Modify: `src/server/profiles/backfill.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/profiles/ids.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parentProfileId, studentProfileId } from "./ids";

describe("deterministic profile ids", () => {
  it("match the backfill convention exactly", () => {
    expect(parentProfileId("u1")).toBe("profile-user-u1");
    expect(studentProfileId("l1")).toBe("profile-learner-l1");
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run src/server/profiles/ids.test.ts`
Expected: FAIL — "Cannot find module './ids'".

- [ ] **Step 3: Create the helpers**

Create `src/server/profiles/ids.ts`:

```ts
/**
 * Deterministic Profile ids — the SINGLE source shared by the backfill, onboarding, and the
 * add-learner path, so the same User/Learner always maps to the same Profile id. This makes all
 * three paths idempotent (upsert-by-id) and prevents duplicate profiles.
 */
export const parentProfileId = (userId: string): string => `profile-user-${userId}`;
export const studentProfileId = (learnerId: string): string => `profile-learner-${learnerId}`;
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run src/server/profiles/ids.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Refactor `backfill.ts` onto the shared helpers**

In `src/server/profiles/backfill.ts`: add `import { parentProfileId, studentProfileId } from "./ids";` at the top, delete the `const pid = (seed: string) => \`profile-${seed}\`;` line, and replace its two uses:
- `id: pid(\`user-${u.id}\`),` → `id: parentProfileId(u.id),`
- `const profileId = pid(\`learner-${l.id}\`);` → `const profileId = studentProfileId(l.id);`

- [ ] **Step 6: Confirm the backfill tests still pass + typecheck**

Run: `npx vitest run src/server/profiles/backfill.test.ts`
Expected: PASS (ids are byte-identical, so existing assertions hold).
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 7: Commit**

```bash
git add src/server/profiles/ids.ts src/server/profiles/ids.test.ts src/server/profiles/backfill.ts
git commit -m "refactor(profiles): shared deterministic profile-id helpers (ids.ts) + backfill onto them

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: ProfileCard mapper (pure) + profile read-queries

**Files:**
- Create: `src/server/profiles/profile-card.ts`
- Create: `src/server/profiles/profile-card.test.ts`
- Create: `src/server/profiles/queries.ts`

- [ ] **Step 1: Write the failing test for the pure mapper**

Create `src/server/profiles/profile-card.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toProfileCard } from "./profile-card";

describe("toProfileCard", () => {
  it("exposes hasPin and never leaks pinHash", () => {
    const card = toProfileCard({
      id: "p1", type: "PARENT", displayName: "Adam",
      avatarConfig: null, viewMode: "STANDARD", isOwner: true, pinHash: "bcrypt-hash",
    });
    expect(card).toEqual({
      id: "p1", type: "PARENT", displayName: "Adam",
      avatarConfig: null, viewMode: "STANDARD", isOwner: true, hasPin: true,
    });
    expect("pinHash" in card).toBe(false);
  });

  it("hasPin is false when pinHash is null", () => {
    const card = toProfileCard({
      id: "p2", type: "STUDENT", displayName: "Sam",
      avatarConfig: null, viewMode: "STANDARD", isOwner: false, pinHash: null,
    });
    expect(card.hasPin).toBe(false);
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run src/server/profiles/profile-card.test.ts`
Expected: FAIL — "Cannot find module './profile-card'".

- [ ] **Step 3: Create the pure module (no server-only — must stay unit-testable)**

Create `src/server/profiles/profile-card.ts`:

```ts
import type { ProfileType } from "@/lib/active-profile-cookie";

export type ProfileViewMode = "STANDARD" | "KID";

/** A profile as shown in the picker. Deliberately has NO pinHash — only `hasPin`. */
export type ProfileCard = {
  id: string;
  type: ProfileType;
  displayName: string;
  avatarConfig: unknown;
  viewMode: ProfileViewMode;
  isOwner: boolean;
  hasPin: boolean;
};

/** Row shape read from the DB (server-side only). */
export type ProfileRow = Omit<ProfileCard, "hasPin"> & { pinHash: string | null };

/** Pure mapper: strip the hash, expose only whether a PIN is set. The hash never leaves the server. */
export function toProfileCard(row: ProfileRow): ProfileCard {
  const { pinHash, ...rest } = row;
  return { ...rest, hasPin: pinHash != null };
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run src/server/profiles/profile-card.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create the read-queries**

Create `src/server/profiles/queries.ts`:

```ts
import "server-only";
import { cache } from "react";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { toProfileCard, type ProfileCard, type ProfileRow } from "./profile-card";

/** All profiles for the current org, as picker cards. pinHash is read server-side only (for hasPin). */
export const listOrganizationProfiles = cache(async (): Promise<ProfileCard[]> => {
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return [];

  const rows = await withTenant(
    (tx) =>
      tx.profile.findMany({
        where: { organizationId },
        select: {
          id: true, type: true, displayName: true,
          avatarConfig: true, viewMode: true, isOwner: true, pinHash: true,
        },
        orderBy: [{ isOwner: "desc" }, { type: "asc" }, { displayName: "asc" }],
      }),
    undefined,
    { organizationId, userId: null },
  );

  return (rows as ProfileRow[]).map(toProfileCard);
});

/** The learner id linked to a STUDENT profile (1:1 via Learner.profileId), or null. */
export const getLearnerIdForProfile = cache(
  async (profileId: string, organizationId: string): Promise<string | null> => {
    const learner = await withTenant(
      (tx) => tx.learner.findUnique({ where: { profileId }, select: { id: true } }),
      undefined,
      { organizationId, userId: null },
    );
    return learner?.id ?? null;
  },
);
```

> If `tsc` flags the `rows as ProfileRow[]` cast (Prisma's `JsonValue`/enum types vs `unknown`/the string unions), keep the cast — the runtime shapes are identical and the mapper only reads `pinHash` nullability + spreads the rest.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add src/server/profiles/profile-card.ts src/server/profiles/profile-card.test.ts src/server/profiles/queries.ts
git commit -m "feat(profiles): listOrganizationProfiles + getLearnerIdForProfile + pure ProfileCard mapper (hasPin, no hash)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: PIN rate-limiter (pure) + select/switch server actions

**Files:**
- Create: `src/server/profiles/pin-rate-limit.ts`
- Create: `src/server/profiles/pin-rate-limit.test.ts`
- Create: `src/app/select-profile/actions.ts`
- Create: `src/app/select-profile/actions.test.ts`

- [ ] **Step 1: Write the failing limiter test**

Create `src/server/profiles/pin-rate-limit.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { checkPinRateLimit, recordPinFailure, clearPinAttempts } from "./pin-rate-limit";

const KEY = "u1:p1";
const T0 = 1_700_000_000_000;

beforeEach(() => clearPinAttempts(KEY));

describe("pin rate limit", () => {
  it("allows up to 5 failures, then locks within the 30s window", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkPinRateLimit(KEY, T0).allowed).toBe(true);
      recordPinFailure(KEY, T0);
    }
    const gate = checkPinRateLimit(KEY, T0 + 1000);
    expect(gate.allowed).toBe(false);
    expect(gate.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    for (let i = 0; i < 5; i++) recordPinFailure(KEY, T0);
    expect(checkPinRateLimit(KEY, T0 + 31_000).allowed).toBe(true);
  });

  it("clearPinAttempts unlocks immediately (used on success)", () => {
    for (let i = 0; i < 5; i++) recordPinFailure(KEY, T0);
    clearPinAttempts(KEY);
    expect(checkPinRateLimit(KEY, T0 + 1000).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run src/server/profiles/pin-rate-limit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the limiter**

Create `src/server/profiles/pin-rate-limit.ts`:

```ts
/**
 * Best-effort in-memory PIN attempt limiter: 5 failures per 30s window per key, then a lockout
 * for the remainder of the window. `now` (ms) is injected for deterministic tests.
 *
 * NOTE: in-memory only — does not survive cold starts and is per-instance. A durable/distributed
 * limiter is a Slice 5 hardening item. Adequate for the single pre-launch account.
 */
const MAX_FAILURES = 5;
const WINDOW_MS = 30_000;

const attempts = new Map<string, { count: number; firstAt: number }>();

export function checkPinRateLimit(key: string, now: number): { allowed: boolean; retryAfterMs: number } {
  const rec = attempts.get(key);
  if (!rec || now - rec.firstAt > WINDOW_MS) return { allowed: true, retryAfterMs: 0 };
  if (rec.count >= MAX_FAILURES) return { allowed: false, retryAfterMs: WINDOW_MS - (now - rec.firstAt) };
  return { allowed: true, retryAfterMs: 0 };
}

export function recordPinFailure(key: string, now: number): void {
  const rec = attempts.get(key);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
  } else {
    rec.count += 1;
  }
}

export function clearPinAttempts(key: string): void {
  attempts.delete(key);
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run src/server/profiles/pin-rate-limit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the server actions**

Create `src/app/select-profile/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { setActiveProfile, clearActiveProfile } from "@/server/profiles/active-profile";
import { checkPinRateLimit, recordPinFailure, clearPinAttempts } from "@/server/profiles/pin-rate-limit";

export type SelectProfileResult = { ok: false; error: string };

/**
 * Select a profile and start its session. For PIN-protected profiles, verifies the PIN (bcrypt,
 * rate-limited) before setting the cookie. On success this REDIRECTS to "/" and never returns;
 * only failures return a result the client can show.
 */
export async function selectProfile(profileId: string, pin?: string): Promise<SelectProfileResult> {
  const { organizationId, userId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  // pinHash is read here (server-only) for verification — it is never returned to the client.
  const profile = await withTenant(
    (tx) =>
      tx.profile.findUnique({
        where: { id: profileId },
        select: { id: true, organizationId: true, type: true, pinHash: true },
      }),
    undefined,
    { organizationId, userId: null },
  );

  if (!profile || profile.organizationId !== organizationId) {
    return { ok: false, error: "Profile not found." };
  }

  if (profile.pinHash) {
    const key = `${userId}:${profile.id}`;
    const gate = checkPinRateLimit(key, Date.now());
    if (!gate.allowed) {
      return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterMs / 1000)}s.` };
    }
    const ok = pin ? await bcrypt.compare(pin, profile.pinHash) : false;
    if (!ok) {
      recordPinFailure(key, Date.now());
      return { ok: false, error: "Incorrect PIN." };
    }
    clearPinAttempts(key);
  }

  await setActiveProfile({ profileId: profile.id, type: profile.type });
  redirect("/");
}

/** Clear the active profile and return to the picker ("Switch Profile"). */
export async function switchProfile(): Promise<void> {
  await clearActiveProfile();
  redirect("/select-profile");
}
```

> `profile.type` is Prisma's `ProfileType`; `setActiveProfile` expects the string-union `ProfileType`. They share values; if `tsc` objects, cast `profile.type as ProfileType` (import the type from `@/lib/active-profile-cookie`).

- [ ] **Step 6: Write the action fail-closed tests**

Create `src/app/select-profile/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const getCurrentUserOrg = vi.fn();
const withTenant = vi.fn();
const setActiveProfile = vi.fn();
const clearActiveProfile = vi.fn();
const redirect = vi.fn((_: string) => { throw new Error("REDIRECT"); });

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUserOrg: () => getCurrentUserOrg() }));
vi.mock("@/server/db", () => ({ withTenant: (...a: unknown[]) => withTenant(...a) }));
vi.mock("@/server/profiles/active-profile", () => ({
  setActiveProfile: (...a: unknown[]) => setActiveProfile(...a),
  clearActiveProfile: (...a: unknown[]) => clearActiveProfile(...a),
}));
vi.mock("next/navigation", () => ({ redirect: (p: string) => redirect(p) }));

import { selectProfile } from "./actions";

const CTX = { userId: "u1", organizationId: "o1" };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserOrg.mockResolvedValue(CTX);
});

describe("selectProfile", () => {
  it("rejects a profile in a different org without setting a cookie", async () => {
    withTenant.mockResolvedValue({ id: "p1", organizationId: "other", type: "PARENT", pinHash: null });
    const res = await selectProfile("p1");
    expect(res).toEqual({ ok: false, error: "Profile not found." });
    expect(setActiveProfile).not.toHaveBeenCalled();
  });

  it("selects a no-PIN profile and redirects to /", async () => {
    withTenant.mockResolvedValue({ id: "p2", organizationId: "o1", type: "STUDENT", pinHash: null });
    await expect(selectProfile("p2")).rejects.toThrow("REDIRECT");
    expect(setActiveProfile).toHaveBeenCalledWith({ profileId: "p2", type: "STUDENT" });
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("rejects a wrong PIN and does not set a cookie", async () => {
    const hash = await bcrypt.hash("1234", 10);
    withTenant.mockResolvedValue({ id: "p1", organizationId: "o1", type: "PARENT", pinHash: hash });
    const res = await selectProfile("p1", "0000");
    expect(res).toEqual({ ok: false, error: "Incorrect PIN." });
    expect(setActiveProfile).not.toHaveBeenCalled();
  });

  it("accepts the correct PIN and redirects", async () => {
    const hash = await bcrypt.hash("1234", 10);
    withTenant.mockResolvedValue({ id: "p1", organizationId: "o1", type: "PARENT", pinHash: hash });
    await expect(selectProfile("p1", "1234")).rejects.toThrow("REDIRECT");
    expect(setActiveProfile).toHaveBeenCalledWith({ profileId: "p1", type: "PARENT" });
  });
});
```

- [ ] **Step 7: Run the action tests + typecheck**

Run: `npx vitest run src/app/select-profile/actions.test.ts`
Expected: PASS (4 tests). (The redirect mock throws "REDIRECT" to stand in for Next's `NEXT_REDIRECT`.)
Run: `npx tsc --noEmit` → clean.

- [ ] **Step 8: Commit**

```bash
git add src/server/profiles/pin-rate-limit.ts src/server/profiles/pin-rate-limit.test.ts src/app/select-profile/actions.ts src/app/select-profile/actions.test.ts
git commit -m "feat(profiles): selectProfile/switchProfile actions with PIN verify + best-effort rate-limit

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Route-aware shell + picker page + ProfilePicker component

**Files:**
- Modify: `src/components/layout/GlobalShell.tsx`
- Create: `src/app/select-profile/page.tsx`
- Create: `src/components/profile/ProfilePicker.tsx`

- [ ] **Step 1: Make `GlobalShell` route-aware**

Replace the entire contents of `src/components/layout/GlobalShell.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { User } from "next-auth";

interface GlobalShellProps {
    children: React.ReactNode;
    user?: User;
}

/** Routes that render their OWN full-screen shell (no app sidebar). */
const CHROMELESS_PREFIXES = ["/select-profile"];

export function GlobalShell({ children, user }: GlobalShellProps) {
    const pathname = usePathname();
    const chromeless = CHROMELESS_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
    );

    if (chromeless) {
        return <div className="min-h-screen">{children}</div>;
    }

    return (
        <div className="flex min-h-screen">
            <Sidebar user={user} />
            <main className="flex-1 lg:ml-64 transition-all duration-300">
                <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in duration-500">
                    {children}
                </div>
            </main>
        </div>
    );
}
```

> `GlobalShell` is now a client component. The server root layout still renders `<GlobalShell user={session?.user}>{children}</GlobalShell>` — passing a serializable `user` and server-rendered `children` to a client component is the standard pattern, no layout change needed. `Sidebar` is already `"use client"`, so importing it from a client parent is fine.

- [ ] **Step 2: Build the picker client component**

Create `src/components/profile/ProfilePicker.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { LockSimple } from "@phosphor-icons/react";
import { getStudentAvatarUrl } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { selectProfile } from "@/app/select-profile/actions";
import type { ProfileCard } from "@/server/profiles/profile-card";

export function ProfilePicker({ profiles }: { profiles: ProfileCard[] }) {
  const [pending, startTransition] = useTransition();
  const [pinFor, setPinFor] = useState<ProfileCard | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  function choose(p: ProfileCard) {
    setError(null);
    if (p.hasPin) {
      setPin("");
      setPinFor(p);
      return;
    }
    startTransition(async () => {
      const res = await selectProfile(p.id); // redirects on success; returns only on failure
      if (res && !res.ok) setError(res.error);
    });
  }

  function submitPin() {
    if (!pinFor || pin.length !== 4) return;
    setError(null);
    const target = pinFor;
    startTransition(async () => {
      const res = await selectProfile(target.id, pin);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-qc-parchment px-4 py-16">
      <h1 className="font-display text-4xl md:text-5xl font-medium text-qc-charcoal mb-12 text-center">
        Who&apos;s learning today?
      </h1>

      <div className="flex flex-wrap justify-center gap-10 max-w-4xl">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choose(p)}
            disabled={pending}
            className="group flex flex-col items-center gap-4 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="relative h-28 w-28 rounded-full overflow-hidden ring-4 ring-white shadow-lg group-hover:ring-qc-primary/30 group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105">
              <Avatar className="h-full w-full">
                <AvatarImage
                  src={getStudentAvatarUrl(p.displayName, p.avatarConfig)}
                  alt={p.displayName}
                  referrerPolicy="no-referrer"
                />
                <AvatarFallback className="text-4xl font-bold bg-qc-parchment-crumpled text-qc-primary">
                  {p.displayName[0]}
                </AvatarFallback>
              </Avatar>
              {p.hasPin && (
                <span className="absolute bottom-1 right-1 rounded-full bg-white/90 p-1 shadow">
                  <LockSimple className="h-4 w-4 text-qc-primary" weight="fill" />
                </span>
              )}
            </div>
            <span className="font-display text-xl font-medium text-qc-charcoal group-hover:text-qc-primary transition-colors">
              {p.displayName}
            </span>
          </button>
        ))}
      </div>

      {error && pinFor == null && <p className="mt-6 text-sm text-qc-error">{error}</p>}

      <Dialog
        open={pinFor != null}
        onOpenChange={(open) => {
          if (!open) {
            setPinFor(null);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter {pinFor?.displayName}&apos;s PIN</DialogTitle>
            <DialogDescription>This profile is protected by a 4-digit PIN.</DialogDescription>
          </DialogHeader>
          <Input
            inputMode="numeric"
            autoFocus
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitPin();
            }}
            placeholder="••••"
            className="text-center text-2xl tracking-[0.5em]"
          />
          {error && <p className="text-sm text-qc-error">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPinFor(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submitPin} disabled={pending || pin.length !== 4}>
              Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

> Verify the icon name: `LockSimple` is a `@phosphor-icons/react` export. If `tsc` can't resolve it, substitute another existing lock glyph from that package (e.g. `Lock`).

- [ ] **Step 3: Build the picker page (server)**

Create `src/app/select-profile/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { listOrganizationProfiles } from "@/server/profiles/queries";
import { ProfilePicker } from "@/components/profile/ProfilePicker";

export default async function SelectProfilePage() {
  let organizationId: string | null;
  try {
    ({ organizationId } = await getCurrentUserOrg());
  } catch {
    redirect("/login");
  }
  if (!organizationId) redirect("/onboarding");

  const profiles = await listOrganizationProfiles();

  if (profiles.length === 0) {
    // Defensive: onboarding now creates the owner profile, so this should be unreachable for an
    // org user. Show a clear path rather than a blank screen.
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-qc-parchment px-4 text-center">
        <h1 className="font-display text-3xl font-medium text-qc-charcoal mb-4">No profiles yet</h1>
        <p className="text-qc-text-muted mb-8">Let&apos;s finish setting up your account.</p>
        <Link href="/onboarding" className="text-qc-primary underline underline-offset-4">
          Continue setup
        </Link>
      </div>
    );
  }

  return <ProfilePicker profiles={profiles} />;
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (Resolve any icon/enum cast nits noted above.)

- [ ] **Step 5: Build (catches client/server boundary errors)**

Run: `npm run build`
Expected: build succeeds. The `GlobalShell` client conversion + the new client/server files compile with no "server-only imported in client" or boundary errors. If the build flags `getStudentAvatarUrl` or any import crossing the boundary, fix the import side, not the boundary.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/GlobalShell.tsx src/components/profile/ProfilePicker.tsx src/app/select-profile/page.tsx
git commit -m "feat(profiles): /select-profile picker page + ProfilePicker + route-aware chrome-free shell

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Split homepage

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite `page.tsx` with the active-profile branch**

Replace the contents of `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { getActiveProfile } from "@/server/profiles/active-profile";
import { getLearnerIdForProfile } from "@/server/profiles/queries";
import { ParentDashboard } from "@/components/dashboard/ParentDashboard";
import { StudentDashboard } from "@/components/dashboard/StudentDashboard";
import { getParentDashboardData, getStudentDashboardData } from "@/server/queries/dashboard";

export default async function HomePage(props: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { organizationId } = await getCurrentUserOrg(session);
  if (!organizationId) redirect("/onboarding");

  // Profile gate: no active profile -> pick one first.
  const active = await getActiveProfile();
  if (!active) redirect("/select-profile");

  // STUDENT profile -> that learner's dashboard (its own linked learner; ignore ?studentId).
  if (active.type === "STUDENT") {
    const learnerId = await getLearnerIdForProfile(active.id, organizationId);
    if (learnerId) {
      const student = await getStudentDashboardData(organizationId, learnerId);
      if (student) return <StudentDashboard student={student} />;
    }
    // STUDENT profile with no usable learner -> back to the picker (fail-safe).
    redirect("/select-profile");
  }

  // PARENT profile -> full dashboard, with the existing ?studentId parent-peek preserved.
  if (searchParams.studentId) {
    const student = await getStudentDashboardData(organizationId, searchParams.studentId);
    if (student) return <StudentDashboard student={student} />;
  }

  const data = await getParentDashboardData(organizationId);
  return (
    <ParentDashboard
      students={data.students}
      recentResources={data.recentResources}
      recentCourses={data.recentCourses}
      completeness={data.completeness}
      suggestions={data.suggestions}
      classroomName={data.classroomName || "My Classroom"}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (Signatures match the originals: `getStudentDashboardData(orgId, id)`, `getParentDashboardData(orgId)`, `<StudentDashboard student=…>`.)

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(profiles): split homepage — getActiveProfile gates picker/STUDENT/PARENT rendering

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Create the owner PARENT profile at onboarding

**Files:**
- Modify: `src/server/actions/blueprint.ts`

- [ ] **Step 1: Import the id helper**

In `src/server/actions/blueprint.ts`, add to the imports at the top:

```ts
import { parentProfileId } from "@/server/profiles/ids";
```

- [ ] **Step 2: Upsert the owner profile inside the `saveClassroomStep` transaction**

In `saveClassroomStep`, inside the `withTenant(async (tx) => { … })` callback, **after** the `// Update user's name from first instructor` block and **before** `return { classroom, instructors, organizationId: activeOrgId };`, insert:

```ts
    // Ensure the account owner's PARENT profile exists (idempotent; same id as the backfill).
    // pinHash mirrors the classroom instructor PIN so the owner card is PIN-protected.
    const ownerName = validated.instructors[0]
      ? `${validated.instructors[0].firstName} ${validated.instructors[0].lastName || ""}`.trim()
      : "Parent";
    await tx.profile.upsert({
      where: { id: parentProfileId(userId) },
      create: {
        id: parentProfileId(userId),
        organizationId: activeOrgId,
        type: "PARENT",
        displayName: ownerName,
        pinHash,
        userId,
        isOwner: true,
      },
      update: { displayName: ownerName, pinHash },
    });
```

> `pinHash` and `activeOrgId` are already in scope in this callback. The `tx` is tenant-stamped to `activeOrgId` (the re-stamp earlier in the function), so the `profiles` RLS `WITH CHECK` passes.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Verify idempotency against the live account (read-only-ish, safe)**

The live owner already has `profile-user-<ownerId>` from the backfill. Re-running onboarding step 1 must **update** (not duplicate). This is verified at runtime in Task 8; no code change here.

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/blueprint.ts
git commit -m "feat(profiles): onboarding creates the owner PARENT profile (idempotent, PIN-protected)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Create the STUDENT profile when a learner is added + "Switch Profile" entry

**Files:**
- Modify: `src/app/api/students/route.ts`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create the STUDENT profile + link in the add-learner route**

In `src/app/api/students/route.ts`, add the id helper import near the top imports:

```ts
import { studentProfileId } from "@/server/profiles/ids";
```

Then, **after** the `await db.learnerProfile.create({ … })` call and **before** `revalidatePath("/students");`, insert:

```ts
    // Give the new learner a STUDENT profile so they appear in the picker (same id as the backfill).
    const profileId = studentProfileId(student.id);
    await db.profile.create({
      data: {
        id: profileId,
        organizationId,
        type: "STUDENT",
        displayName: validated.preferredName || validated.firstName,
      },
    });
    await db.learner.update({ where: { id: student.id }, data: { profileId } });
```

> This route uses plain `db` (the existing `learner.create`/`learnerProfile.create` do too); the RLS extension resolves the tenant from request `auth()` here, so these org-scoped writes are stamped. Keep the same pattern for consistency. `avatarConfig` is intentionally omitted — a new learner has none yet; the picker falls back to a name-seeded avatar.

- [ ] **Step 2: Add a "Switch Profile" control to the sidebar**

In `src/components/layout/Sidebar.tsx`, add the action import near the top imports:

```ts
import { switchProfile } from "@/app/select-profile/actions";
```

Then, inside the `{user && ( … )}` footer block, **after** the user-info `<div className="flex items-center gap-3 px-2">…</div>`, add a switch control:

```tsx
                                <form action={switchProfile} className="mt-3 px-2">
                                    <button
                                        type="submit"
                                        className="w-full text-left text-sm font-medium text-qc-text-muted hover:text-qc-primary transition-colors"
                                    >
                                        Switch Profile
                                    </button>
                                </form>
```

> A server action used as a client `<form action={…}>` is the standard pattern. `switchProfile` clears the cookie and redirects to `/select-profile`.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → succeeds (server-action import into the client `Sidebar` is fine).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/students/route.ts src/components/layout/Sidebar.tsx
git commit -m "feat(profiles): STUDENT profile on learner-add + Switch Profile sidebar control

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Verification gate + runtime check + self-review

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit` → clean.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all green — new pure/logic tests (`ids`, `profile-card`, `pin-rate-limit`, `selectProfile`) plus Slice 1b/2 tests.

- [ ] **Step 3: Production build (client/server boundary gate)**

Run: `npm run build`
Expected: succeeds. Confirms the `GlobalShell` client conversion, the picker, the actions, and the `Sidebar`/`page` changes all respect Next's server/client boundaries.

- [ ] **Step 4: Runtime check (dev) — the split homepage + chrome-free picker**

Start the app (`npm run dev`) and, signed in as the live account:
- Visit `/` with **no** active-profile cookie → redirected to `/select-profile`.
- `/select-profile` renders the picker **with no sidebar** (chrome-free) and shows 2 cards (owner PARENT 🔒, the STUDENT).
- Selecting the STUDENT (no PIN) → lands on `/` showing that learner's `StudentDashboard`, **with** the sidebar.
- "Switch Profile" (sidebar) → back to `/select-profile`.
- Selecting the owner PARENT → PIN dialog → correct PIN lands on the parent dashboard; wrong PIN shows "Incorrect PIN".

Confirm each behaves as above. (No automated harness for this — it's a manual smoke of the one flow that ties the slice together.)

- [ ] **Step 5: Self-review against the design**

- §A profile-list query ✓ (Task 2, `hasPin` only) · §B picker route ✓ (Task 4) · §C route-aware shell ✓ (Task 4) · §D split homepage ✓ (Task 5) · §E PIN-verify selection ✓ (Task 3) · §F Switch Profile ✓ (Task 7) · §G onboarding owner profile ✓ (Task 6) · §H new-child STUDENT profile ✓ (Task 7).
- Confirm `pinHash` is **never** returned to a client: `listOrganizationProfiles` maps through `toProfileCard`; `selectProfile` reads it only server-side; `getActiveProfile` already strips it.
- Confirm no `redirect()` is called inside a `try` that would swallow `NEXT_REDIRECT` (in `page.tsx` and the picker page the redirects are outside the `try`).

---

## Self-Review

- **Spec coverage (§6 picker/split-homepage + the signed-off scope):** picker + "Who's learning today?" ✓; split `/` ✓; PIN-on-select (pulled from §8) ✓; Switch Profile (§5) ✓; onboarding owner profile (§12) ✓; new-child consistency (decision **H**) ✓. **Deferred (documented):** profile add/manage UI + durable rate-limit + onboarding PIN-capture rewrite → **Slice 5**; proxy route-gating + sliding re-stamp + student-chrome restriction → **Slice 4**; kid-view (`viewMode`) → **Phase B**.
- **No schema/migration:** Slice 3 only reads `profiles`/`learners` and writes profiles through existing columns. No DB migration. (It does write profile rows at onboarding/learner-add and a cookie at selection — all via existing tables.)
- **Placeholder scan:** none — every step has concrete code/commands. Two explicitly-flagged "if tsc objects" cast nits (Prisma enum → string union) and one icon-name fallback (`LockSimple` → `Lock`) are bounded, not placeholders.
- **Type/name consistency:** `parentProfileId`/`studentProfileId` (Task 1) reused in Tasks 6 & 7 and the backfill; `ProfileCard`/`toProfileCard`/`ProfileRow` (Task 2) consumed by `queries.ts` and `ProfilePicker`; `selectProfile`/`switchProfile` (Task 3) consumed by `ProfilePicker` and `Sidebar`; `getActiveProfile`/`setActiveProfile`/`clearActiveProfile` (Slice 2) consumed by `page.tsx`/actions. `withTenant(fn, undefined, { organizationId, userId: null })` matches the established pattern.
- **RLS:** every new server-side read/write is org-scoped — `queries.ts` and `selectProfile` via `withTenant`; the onboarding upsert runs inside the already-tenant-stamped `saveClassroomStep` tx; the `/api/students` profile create follows the file's existing plain-`db` (request-auth-resolved) pattern.
- **Security:** `pinHash` is read only server-side and never serialized to a client; PIN verify is bcrypt + rate-limited; `selectProfile` re-checks org membership before trusting the profile; foreign-org/none/no-PIN-mismatch all fail closed.
- **Known follow-ups for later slices:** in-memory rate-limiter is per-instance/non-durable (Slice 5); the picker has no add/manage affordance yet (Slice 5); without Slice 4's proxy, directly navigating to a deep authenticated route with no active profile renders without chrome until the page-level guards/redirects catch it.
```