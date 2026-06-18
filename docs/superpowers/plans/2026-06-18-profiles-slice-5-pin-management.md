# Profiles — Slice 5: Per-Profile PIN Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a PARENT set / change / remove a PIN on any of the org's profiles (a "Manage Profiles" surface reached from the picker), make PIN-attempt throttling durable (DB-backed), rewrite the onboarding PIN capture (relabel + optional-on-edit, closing FEAT-22), and drop the now-vestigial `ClassroomInstructor.instructorPin` column (closing HYG-12).

**Architecture:** PIN management goes through PARENT-guarded server actions (`setProfilePin`/`removeProfilePin`, reusing Slice 4's `assertParentProfile()`) plus a picker-entry action (`enterProfileManagement`) that PIN-verifies the owner PARENT profile and lands on a PARENT-gated `/manage-profiles` route. The in-memory limiter from Slice 3 is replaced by a durable throttle stored in two new `profiles` columns (`pin_failed_count`, `pin_window_start`); the window math stays a pure, unit-tested function. The onboarding PIN still seeds the owner profile's `pinHash` (Slice 3) but no longer writes `instructorPin`, which is dropped. One migration (`00000000000014`) does both schema changes.

**Tech Stack:** Prisma 7 + RLS (`withTenant`; `prisma migrate deploy` per the project's migration method), next-auth v5, bcryptjs, shadcn/Radix UI, Vitest. **Prod DB is LIVE — the migration is shown below and applied only after sign-off, then verified with `get_advisors` + a read-only check.**

---

## Background — verified seam

- **`instructorPin` is vestigial.** Writer: `saveClassroomStep` ([`blueprint.ts:41,132`](../../../src/server/actions/blueprint.ts)) hashes the onboarding PIN and writes it to `ClassroomInstructor` (and, since Slice 3, the owner profile `pinHash`). Readers: `data-export.ts` (`db.classroom.findMany({ include:{ instructors:true } })` — survives a column drop) and the already-run `scripts/backfill-profiles.ts` (`select:{ instructorPin:true }` — must be cleaned up so `tsc` passes after the column is gone). Schema: `ClassroomInstructor.instructorPin String @map("instructor_pin")` ([`schema.prisma:255`](../../../prisma/schema.prisma)), table `classroom_instructors`.
- **4-digit schema** lives inline at `onboarding.ts:19` (`z.string().regex(/^\d{4}$/, "...")`). We extract a shared `pinSchema`.
- **Picker** ([`ProfilePicker.tsx`](../../../src/components/profile/ProfilePicker.tsx)) already has the PIN dialog + `selectProfile` flow and receives `ProfileCard[]` (incl. `isOwner`, `hasPin`). We add a "Manage Profiles" button.
- **Slice 3 limiter** ([`pin-rate-limit.ts`](../../../src/server/profiles/pin-rate-limit.ts), in-memory) is used by `selectProfile` ([`select-profile/actions.ts`](../../../src/app/select-profile/actions.ts)). We replace it with the durable throttle.
- **Slice 4** gives us `assertParentProfile()` ([`guards.ts`](../../../src/server/profiles/guards.ts)) and the proxy gate (so `/manage-profiles`, not in the STUDENT allowlist, is PARENT-only by construction).
- **Onboarding FEAT-22 bug:** the PIN is `regex`-required and `saveClassroomStep` deletes+recreates instructors each save, so editing classroom info later forces re-typing the PIN. Fix: optional on edit (blank = keep existing owner PIN).

---

## THE MIGRATION (shown for sign-off; applied in Task 3 only after approval)

`prisma/migrations/00000000000014_pin_management/migration.sql`:

```sql
-- HYG-12: the instructor PIN is vestigial — the PIN now lives on the owner PARENT profile
-- (profiles.pin_hash, seeded at onboarding since Slice 3). Drop the column so the data export
-- can no longer ship its bcrypt hash to the client.
ALTER TABLE "classroom_instructors" DROP COLUMN "instructor_pin";

-- Durable per-profile PIN-attempt throttle (replaces the in-memory limiter). Stored on the
-- profile itself, so it reuses the existing profiles RLS policy (no new table/policy).
ALTER TABLE "profiles" ADD COLUMN "pin_failed_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "profiles" ADD COLUMN "pin_window_start" TIMESTAMP(3);
```

Both are simple `ALTER`s. `profiles` already has its `app_user_rls` policy, so the new columns need no extra grants/policy. No data backfill needed (`pin_failed_count` defaults to 0).

---

## File Structure

- `src/lib/schemas/pin.ts` — **NEW.** Shared `pinSchema`.
- `src/lib/schemas/onboarding.ts` — **MODIFY.** Use `pinSchema`; make `instructorPin` optional (blank = keep).
- `prisma/schema.prisma` — **MODIFY.** Drop `ClassroomInstructor.instructorPin`; add `Profile.pinFailedCount` + `Profile.pinWindowStart`.
- `prisma/migrations/00000000000014_pin_management/migration.sql` — **NEW.** (Above.)
- `src/server/profiles/pin-throttle.ts` — **NEW.** Pure `evaluateThrottle`/`nextStateOnFailure` + DB-backed `checkProfilePinThrottle`/`recordProfilePinFailure`/`clearProfilePinThrottle`.
- `src/server/profiles/pin-throttle.test.ts` — **NEW.** Pure window-logic tests.
- `src/server/profiles/pin-rate-limit.ts` + `.test.ts` — **DELETE.** Replaced by the durable throttle.
- `src/server/profiles/pin-actions.ts` — **NEW.** `setProfilePin`/`removeProfilePin` (PARENT-guarded).
- `src/server/profiles/pin-actions.test.ts` — **NEW.**
- `src/app/select-profile/actions.ts` — **MODIFY.** `selectProfile` uses the durable throttle; add `enterProfileManagement`.
- `src/app/select-profile/actions.test.ts` — **MODIFY.** Throttle is now DB-backed (mock it).
- `src/app/manage-profiles/page.tsx` — **NEW.** PARENT-gated server page.
- `src/components/profile/ManageProfiles.tsx` — **NEW.** Client management UI.
- `src/components/profile/ProfilePicker.tsx` — **MODIFY.** "Manage Profiles" button + entry PIN dialog.
- `src/server/actions/blueprint.ts` — **MODIFY.** Stop writing `instructorPin`; PIN optional on edit.
- `src/components/onboarding/classroom-step.tsx` — **MODIFY.** Relabel "Instructor PIN" → "Parent PIN"; optional on edit.
- `scripts/backfill-profiles.ts` — **MODIFY.** Drop the `instructorPin` reference (obsolete; already ran).

---

## Task 1: Shared `pinSchema`

**Files:** Create `src/lib/schemas/pin.ts`; Modify `src/lib/schemas/onboarding.ts`.

- [ ] **Step 1:** Create `src/lib/schemas/pin.ts`:

```ts
import { z } from "zod";

/** A 4-digit profile PIN. Shared by onboarding capture + per-profile PIN management. */
export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");
```

- [ ] **Step 2:** In `src/lib/schemas/onboarding.ts`, import `pinSchema` and replace the inline `instructorPin` rule. Since editing classroom info later must not force re-typing the PIN (FEAT-22), make it **optional**:

```ts
import { pinSchema } from "@/lib/schemas/pin";
// ...
  // Optional: blank means "keep the existing owner PIN" (set at first onboarding).
  instructorPin: pinSchema.optional().or(z.literal("")),
```

- [ ] **Step 3:** `npx tsc --noEmit` → clean. Commit:
```bash
git add src/lib/schemas/pin.ts src/lib/schemas/onboarding.ts
git commit -m "feat(profiles): shared pinSchema; onboarding PIN optional on edit (FEAT-22)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Schema changes (drop instructorPin, add throttle columns) + stop writing instructorPin

**Files:** Modify `prisma/schema.prisma`, `src/server/actions/blueprint.ts`, `scripts/backfill-profiles.ts`, `src/components/onboarding/classroom-step.tsx`.

> This task makes the **code + Prisma schema** consistent with the dropped column BEFORE the DB migration (Task 3) — schema-first. After editing `schema.prisma`, run `npx prisma generate` so `tsc` sees the removal.

- [ ] **Step 1: Edit `schema.prisma`.** In `model ClassroomInstructor`, delete the line `instructorPin String @map("instructor_pin")`. In `model Profile`, add (near the other pin field):

```prisma
  pinFailedCount Int       @default(0) @map("pin_failed_count")
  pinWindowStart DateTime? @map("pin_window_start")
```

- [ ] **Step 2:** `npx prisma generate` (client now lacks `instructorPin`, has the new Profile fields).

- [ ] **Step 3: Stop writing `instructorPin` in `blueprint.ts`.** In `saveClassroomStep`, the instructor `create` (`instructorPin: pinHash,`) must be removed (the column is going away; the owner-profile `pinHash` upsert from Slice 3 stays). Also make the PIN optional-on-edit: only (re)hash + (re)set the owner PIN when a non-empty `instructorPin` was provided.

Replace the `pinHash` computation + the instructor `create`'s `instructorPin` field, and guard the owner-profile `pinHash`:

```ts
  // Hash the PIN only when one was provided (blank on edit = keep the existing owner PIN).
  const newPinHash = validated.instructorPin
    ? await bcrypt.hash(validated.instructorPin, 10)
    : null;
```

In the instructor `create`, **remove** the `instructorPin: pinHash,` line entirely. In the owner-profile `upsert` (added in Slice 3), set `pinHash` from `newPinHash` only when present:

```ts
    await tx.profile.upsert({
      where: { id: parentProfileId(userId) },
      create: {
        id: parentProfileId(userId),
        organizationId: activeOrgId,
        type: "PARENT",
        displayName: ownerName,
        ...(newPinHash ? { pinHash: newPinHash } : {}),
        userId,
        isOwner: true,
      },
      update: { displayName: ownerName },
    });
```

> The old `const pinHash = await bcrypt.hash(validated.instructorPin, 10);` at the top is replaced by the conditional `newPinHash` above. Confirm no other reference to `pinHash` remains in the function (it was only used for the instructor write + the owner upsert).

- [ ] **Step 4: Clean `scripts/backfill-profiles.ts`.** Remove the `select: { instructorPin: true }` read and the `ownerPinHashByOrg` derivation (obsolete — the owner PIN now comes from onboarding, and the column is gone). If that leaves the script unable to provide a PIN hash, pass `ownerPinHashByOrg: {}` (the backfill already ran; this keeps the one-off script compiling).

- [ ] **Step 5: Relabel the onboarding PIN field.** In `src/components/onboarding/classroom-step.tsx`, change the label `Instructor PIN *` → `Parent PIN` (drop the required asterisk), and the helper text to note it protects the parent profile and can be left blank when editing to keep the current PIN. (Field id/register name stay `instructorPin` — it still maps to the form value; only the column it ultimately seeds changed.)

- [ ] **Step 6:** `npx tsc --noEmit` → clean (no `instructorPin` Prisma references remain). Do NOT commit yet — the DB migration (Task 3) lands with this. (If you must checkpoint, commit code + schema together but note the migration is unapplied.)

---

## Task 3: Apply the migration (SQL sign-off → apply → verify)

**Files:** Create `prisma/migrations/00000000000014_pin_management/migration.sql`.

- [ ] **Step 1:** Create the migration file with the SQL shown in "THE MIGRATION" above.

- [ ] **Step 2: SHOW the SQL to the human and get explicit go-ahead before applying.** (Standing rule: never apply to the live DB without sign-off.)

- [ ] **Step 3: Apply** (after approval): `npx prisma migrate deploy` (uses `DIRECT_DATABASE_URL`; applies only the pending `0014`). Then `npx prisma generate`.

- [ ] **Step 4: Verify** — run `mcp__supabase__get_advisors(security)` (expect no new findings) and a read-only check:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'classroom_instructors' AND column_name = 'instructor_pin';   -- expect 0 rows
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('pin_failed_count','pin_window_start'); -- expect 2 rows
```

- [ ] **Step 5: Commit** the schema + code + migration together:
```bash
git add prisma/schema.prisma prisma/migrations/00000000000014_pin_management src/server/actions/blueprint.ts scripts/backfill-profiles.ts src/components/onboarding/classroom-step.tsx
git commit -m "feat(profiles): drop vestigial instructor_pin (HYG-12) + add durable pin-throttle columns

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Durable PIN throttle (TDD)

**Files:** Create `src/server/profiles/pin-throttle.ts` + `.test.ts`. Delete `src/server/profiles/pin-rate-limit.ts` + `.test.ts`.

- [ ] **Step 1: Write the failing test** (`pin-throttle.test.ts`) for the PURE logic:

```ts
import { describe, it, expect } from "vitest";
import { evaluateThrottle, nextStateOnFailure } from "./pin-throttle";

const T0 = 1_700_000_000_000;
const MIN = 60_000;

describe("evaluateThrottle", () => {
  it("allows when under the limit", () => {
    expect(evaluateThrottle({ pinFailedCount: 4, pinWindowStart: new Date(T0) }, T0 + 1000).allowed).toBe(true);
  });
  it("blocks at 5 failures within the 30s window", () => {
    const r = evaluateThrottle({ pinFailedCount: 5, pinWindowStart: new Date(T0) }, T0 + 1000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });
  it("allows once the window has elapsed", () => {
    expect(evaluateThrottle({ pinFailedCount: 5, pinWindowStart: new Date(T0) }, T0 + 31_000).allowed).toBe(true);
  });
  it("allows when never attempted", () => {
    expect(evaluateThrottle({ pinFailedCount: 0, pinWindowStart: null }, T0).allowed).toBe(true);
  });
});

describe("nextStateOnFailure", () => {
  it("starts a fresh window", () => {
    expect(nextStateOnFailure({ pinFailedCount: 0, pinWindowStart: null }, T0)).toEqual({ pinFailedCount: 1, pinWindowStart: new Date(T0) });
  });
  it("increments within the window", () => {
    expect(nextStateOnFailure({ pinFailedCount: 2, pinWindowStart: new Date(T0) }, T0 + MIN / 2)).toEqual({ pinFailedCount: 3, pinWindowStart: new Date(T0) });
  });
  it("resets the window after it elapses", () => {
    expect(nextStateOnFailure({ pinFailedCount: 5, pinWindowStart: new Date(T0) }, T0 + 31_000)).toEqual({ pinFailedCount: 1, pinWindowStart: new Date(T0 + 31_000) });
  });
});
```

- [ ] **Step 2:** Run → red.

- [ ] **Step 3: Implement `pin-throttle.ts`:**

```ts
import "server-only";
import { withTenant } from "@/server/db";

const MAX_FAILURES = 5;
const WINDOW_MS = 30_000;

type ThrottleState = { pinFailedCount: number; pinWindowStart: Date | null };

/** Pure: is an attempt allowed given the stored counters and `now` (ms)? */
export function evaluateThrottle(state: ThrottleState, now: number): { allowed: boolean; retryAfterMs: number } {
  const start = state.pinWindowStart?.getTime();
  if (start === undefined || now - start > WINDOW_MS) return { allowed: true, retryAfterMs: 0 };
  if (state.pinFailedCount >= MAX_FAILURES) return { allowed: false, retryAfterMs: WINDOW_MS - (now - start) };
  return { allowed: true, retryAfterMs: 0 };
}

/** Pure: the next counters after a failed attempt. */
export function nextStateOnFailure(state: ThrottleState, now: number): ThrottleState {
  const start = state.pinWindowStart?.getTime();
  if (start === undefined || now - start > WINDOW_MS) return { pinFailedCount: 1, pinWindowStart: new Date(now) };
  return { pinFailedCount: state.pinFailedCount + 1, pinWindowStart: state.pinWindowStart };
}

/** DB-backed: read the profile's throttle counters and evaluate. org-scoped. */
export async function checkProfilePinThrottle(profileId: string, organizationId: string, now: number) {
  const p = await withTenant(
    (tx) => tx.profile.findUnique({ where: { id: profileId }, select: { pinFailedCount: true, pinWindowStart: true } }),
    undefined,
    { organizationId, userId: null },
  );
  return evaluateThrottle({ pinFailedCount: p?.pinFailedCount ?? 0, pinWindowStart: p?.pinWindowStart ?? null }, now);
}

export async function recordProfilePinFailure(profileId: string, organizationId: string, now: number): Promise<void> {
  await withTenant(async (tx) => {
    const p = await tx.profile.findUnique({ where: { id: profileId }, select: { pinFailedCount: true, pinWindowStart: true } });
    const next = nextStateOnFailure({ pinFailedCount: p?.pinFailedCount ?? 0, pinWindowStart: p?.pinWindowStart ?? null }, now);
    await tx.profile.update({ where: { id: profileId }, data: next });
  }, undefined, { organizationId, userId: null });
}

export async function clearProfilePinThrottle(profileId: string, organizationId: string): Promise<void> {
  await withTenant(
    (tx) => tx.profile.update({ where: { id: profileId }, data: { pinFailedCount: 0, pinWindowStart: null } }),
    undefined,
    { organizationId, userId: null },
  );
}
```

- [ ] **Step 4:** Run → green (7 tests). Delete `src/server/profiles/pin-rate-limit.ts` and `pin-rate-limit.test.ts`.

- [ ] **Step 5:** `npx tsc --noEmit` → clean (nothing imports `pin-rate-limit` after Task 5). Commit (with Task 5, since `selectProfile` still imports the old limiter until then — so do Task 5 Step 1 before this commit, or commit Tasks 4+5 together).

---

## Task 5: PIN-management actions + rewire selectProfile (TDD)

**Files:** Create `src/server/profiles/pin-actions.ts` + `.test.ts`; Modify `src/app/select-profile/actions.ts` + `.test.ts`.

- [ ] **Step 1: Rewire `selectProfile`** ([`select-profile/actions.ts`](../../../src/app/select-profile/actions.ts)) to use the durable throttle. Replace the `pin-rate-limit` imports/calls: `checkPinRateLimit(key, now)` → `await checkProfilePinThrottle(profile.id, organizationId, Date.now())`; `recordPinFailure(key, now)` → `await recordProfilePinFailure(profile.id, organizationId, Date.now())`; `clearPinAttempts(key)` → `await clearProfilePinThrottle(profile.id, organizationId)`. (Drop the `${userId}:${profileId}` key — the throttle is keyed by `profileId`, org-scoped.)

- [ ] **Step 2: Add `enterProfileManagement`** to the same file — PIN-verifies the org's owner PARENT profile, sets it active, lands on `/manage-profiles`:

```ts
export async function enterProfileManagement(pin?: string): Promise<SelectProfileResult> {
  const { organizationId, userId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const owner = await withTenant(
    (tx) => tx.profile.findFirst({
      where: { organizationId, type: "PARENT", isOwner: true },
      select: { id: true, type: true, pinHash: true },
    }),
    undefined,
    { organizationId, userId: null },
  );
  if (!owner) return { ok: false, error: "No owner profile." };

  if (owner.pinHash) {
    const gate = await checkProfilePinThrottle(owner.id, organizationId, Date.now());
    if (!gate.allowed) return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterMs / 1000)}s.` };
    const ok = pin ? await bcrypt.compare(pin, owner.pinHash) : false;
    if (!ok) {
      await recordProfilePinFailure(owner.id, organizationId, Date.now());
      return { ok: false, error: "Incorrect PIN." };
    }
    await clearProfilePinThrottle(owner.id, organizationId);
  }

  await setActiveProfile({ profileId: owner.id, type: "PARENT" });
  redirect("/manage-profiles");
}
```

- [ ] **Step 3: Implement `pin-actions.ts`** (PARENT-guarded management):

```ts
"use server";

import bcrypt from "bcryptjs";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import { assertParentProfile } from "@/server/profiles/guards";
import { pinSchema } from "@/lib/schemas/pin";

export type PinActionResult = { ok: true } | { ok: false; error: string };

async function ownedProfile(profileId: string, organizationId: string) {
  return withTenant(
    (tx) => tx.profile.findUnique({ where: { id: profileId }, select: { id: true, organizationId: true } }),
    undefined,
    { organizationId, userId: null },
  );
}

/** Set or change a profile's PIN. PARENT-only; org-scoped. */
export async function setProfilePin(profileId: string, pin: string): Promise<PinActionResult> {
  await assertParentProfile();
  const parsed = pinSchema.safeParse(pin);
  if (!parsed.success) return { ok: false, error: "PIN must be exactly 4 digits." };
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const profile = await ownedProfile(profileId, organizationId);
  if (!profile || profile.organizationId !== organizationId) return { ok: false, error: "Profile not found." };

  const pinHash = await bcrypt.hash(parsed.data, 10);
  await withTenant(
    (tx) => tx.profile.update({ where: { id: profileId }, data: { pinHash, pinFailedCount: 0, pinWindowStart: null } }),
    undefined,
    { organizationId, userId: null },
  );
  return { ok: true };
}

/** Remove a profile's PIN. PARENT-only; org-scoped. */
export async function removeProfilePin(profileId: string): Promise<PinActionResult> {
  await assertParentProfile();
  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) return { ok: false, error: "No organization." };

  const profile = await ownedProfile(profileId, organizationId);
  if (!profile || profile.organizationId !== organizationId) return { ok: false, error: "Profile not found." };

  await withTenant(
    (tx) => tx.profile.update({ where: { id: profileId }, data: { pinHash: null, pinFailedCount: 0, pinWindowStart: null } }),
    undefined,
    { organizationId, userId: null },
  );
  return { ok: true };
}
```

- [ ] **Step 4: Tests** — `pin-actions.test.ts` (mock `guards`, `auth-helpers`, `withTenant`): PARENT guard called; foreign-org → "Profile not found"; bad PIN format → error; happy path updates `pinHash`. Update `select-profile/actions.test.ts`: replace the in-memory rate-limit mock with mocks of `@/server/profiles/pin-throttle` (`checkProfilePinThrottle`/`recordProfilePinFailure`/`clearProfilePinThrottle`); keep the foreign-org / no-PIN / wrong-PIN / correct-PIN / lockout cases (lockout now driven by the mocked `checkProfilePinThrottle` returning `{allowed:false}`).

- [ ] **Step 5:** Run the relevant tests → green. `npx tsc --noEmit` → clean. Commit Tasks 4+5:
```bash
git add src/server/profiles/pin-throttle.ts src/server/profiles/pin-throttle.test.ts src/server/profiles/pin-actions.ts src/server/profiles/pin-actions.test.ts src/app/select-profile/actions.ts src/app/select-profile/actions.test.ts
git rm src/server/profiles/pin-rate-limit.ts src/server/profiles/pin-rate-limit.test.ts
git commit -m "feat(profiles): durable per-profile PIN throttle + setProfilePin/removeProfilePin + enterProfileManagement

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Manage Profiles UI + picker button

**Files:** Create `src/app/manage-profiles/page.tsx`, `src/components/profile/ManageProfiles.tsx`; Modify `src/components/profile/ProfilePicker.tsx`.

- [ ] **Step 1: `manage-profiles/page.tsx`** (server; PARENT-gated by the proxy):

```tsx
import { redirect } from "next/navigation";
import { getActiveProfile } from "@/server/profiles/active-profile";
import { listOrganizationProfiles } from "@/server/profiles/queries";
import { ManageProfiles } from "@/components/profile/ManageProfiles";

export default async function ManageProfilesPage() {
  const active = await getActiveProfile();
  if (active?.type !== "PARENT") redirect("/select-profile");
  const profiles = await listOrganizationProfiles();
  return <ManageProfiles profiles={profiles} />;
}
```

- [ ] **Step 2: `ManageProfiles.tsx`** (client) — list each profile (avatar + name + PIN status); per row a "Set/Change PIN" control (opens a 4-digit input) calling `setProfilePin`, and "Remove PIN" (when `hasPin`) calling `removeProfilePin`; on success `router.refresh()`. A "Done" link back to `/`. Use `getStudentAvatarUrl`, `Avatar`, `Input`, `Button`, `Dialog`, `useTransition`, `toast`. (Full-screen on `bg-qc-parchment`, consistent with the picker.)

- [ ] **Step 3: Picker button** — in `ProfilePicker.tsx`, add a "Manage Profiles" text button under the card grid. On click: find the owner card (`profiles.find(p => p.isOwner)`); if it `hasPin`, open a PIN dialog ("Enter your parent PIN") calling `enterProfileManagement(pin)`; else call `enterProfileManagement()` directly. Reuse the existing PIN-dialog pattern (it can share the same dialog component or a second instance). `enterProfileManagement` redirects to `/manage-profiles` on success; show its `{ok:false}` error otherwise.

- [ ] **Step 4:** `npx tsc --noEmit` → clean; `npm run build` → succeeds (`/manage-profiles` present). Commit:
```bash
git add src/app/manage-profiles/page.tsx src/components/profile/ManageProfiles.tsx src/components/profile/ProfilePicker.tsx
git commit -m "feat(profiles): Manage Profiles UI (picker entry + PIN set/change/remove)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Verification gate + self-review

- [ ] **Step 1:** `npx tsc --noEmit` → clean.
- [ ] **Step 2:** `npm test` (re-run once if it flakes to "no tests"): the new pure tests (`pin-throttle`) + `pin-actions` + updated `select-profile/actions` + prior slices all green.
- [ ] **Step 3:** `npm run build` → succeeds.
- [ ] **Step 4: Migration re-verify** (already done in Task 3): `instructor_pin` gone; `profiles` has the two throttle columns; `get_advisors(security)` clean.
- [ ] **Step 5: Runtime smoke** (dev): from the picker, "Manage Profiles" → owner PIN → `/manage-profiles`; set a PIN on a STUDENT profile → it shows 🔒 in the picker and now prompts for PIN on select; remove it → no prompt. Onboarding: editing classroom info with a blank PIN keeps the existing owner PIN (no re-type forced).
- [ ] **Step 6: Self-review** against §8 + the decisions.

---

## Self-Review

- **Spec coverage (§8 per-profile PIN):** `verifyProfilePin`-equivalent already shipped in Slice 3 (`selectProfile`); Slice 5 adds **management** (set/change/remove) ✓, the shared `pinSchema` ✓, durable rate-limiting ✓ (the spec's "rate-limited" — now DB-backed), and the **onboarding rewrite** ✓ (relabel + optional-on-edit, closing FEAT-22). **HYG-12** closed by dropping `instructor_pin` ✓. **FEAT-22** closed ✓.
- **Migration:** one file, two simple `ALTER`s, shown for sign-off, applied via `prisma migrate deploy`, verified with `get_advisors` + a read-only column check. `profiles` RLS already covers the new columns (no new policy).
- **Security:** management actions are `assertParentProfile`-guarded (Slice 4) AND org-scoped; `/manage-profiles` is PARENT-only via the proxy; `pinHash` never returned; the durable throttle resets on success and on PIN set/remove.
- **Decisions honored:** picker "Manage Profiles" button (entry PIN-gates to a PARENT-gated route); instructorPin dropped now; durable rate-limiting now.
- **Cleanup:** the in-memory `pin-rate-limit.ts` is deleted; `scripts/backfill-profiles.ts` de-references the dropped column; the data export no longer carries the hash (column gone).
```