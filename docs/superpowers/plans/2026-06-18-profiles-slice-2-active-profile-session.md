# Profiles — Slice 2: Active-Profile Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a signed `active_profile` cookie and a `getActiveProfile()` server helper so the rest of the epic (picker, proxy authz, PIN) has an authoritative "who is currently selected" for the logged-in session — with **no UI and no proxy wiring** (those are Slices 3/4).

**Architecture:** Two files split by runtime-safety. A **pure, edge-safe** library (`src/lib/active-profile-cookie.ts`) signs/verifies a JWS (jose, **HS256** = the HMAC the spec calls for) over `{ profileId, type, uid, org, iat }` and owns the cookie name/attributes — zero DB/Node imports so the Slice-4 proxy can reuse the *same* verifier at the edge. A **server-only** helper (`src/server/profiles/active-profile.ts`) reads the cookie via `next/headers`, verifies it, binds it to the current login (`uid`/`org`), and loads the profile through `withTenant` (RLS-correct). Idle policy lives in one place: **PARENT 15-min idle, STUDENT persistent** (the per-type TTL is checked against `iat`; the *sliding* re-stamp on activity is wired later in Slice 4's proxy).

**Tech Stack:** Next 16 (async `cookies()`), next-auth v5 (JWT), `jose` 6 (edge-safe JWS), Prisma 7 + RLS (`withTenant`), React `cache()` for per-request dedup, Vitest.

---

## Background — verified state this slice builds on

- **Schema (live on prod):** `Profile` model exists (`@@map("profiles")`): `id, organizationId(@map account_id), type(ProfileType PARENT|STUDENT), displayName, avatarConfig, pinHash?, viewMode(ProfileViewMode default STANDARD), userId?, isOwner, createdAt, updatedAt`. `Learner.profileId` is nullable/`@unique`/`onDelete SetNull`. Backfill ran: 1 PARENT owner (with `pin_hash`) + 1 STUDENT, linked. Migrations `00000000000012`/`00000000000013` applied. **Slice 2 changes NO schema** — it only reads `profiles`.
- **Auth:** next-auth v5 JWT. Secret = `process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET`. The session callback stamps `session.user.id` and `session.user.organizationId`. The canonical per-request helper is `getCurrentUserOrg()` in `src/lib/auth-helpers.ts` → `{ userId, organizationId }`; **it throws** `"User not authenticated"` when there is no session.
- **RLS:** org-scoped reads on an RSC path MUST use `withTenant(fn, undefined, { organizationId, userId })` (the auto-extension does not propagate into RSC). Pattern reference: `getStudentById` in `src/server/queries/students.ts`.
- **Cookie conventions** (from the `pkceCodeVerifier` block in `src/auth.ts`): `httpOnly:true, sameSite:"lax", secure: NODE_ENV==="production", domain: prod ? ".quillandcompass.app" : undefined, path:"/"`, and a `__Secure-` name prefix in production only.
- **Proxy (NOT touched here):** `src/proxy.ts` runs in Next's default **Edge** runtime (no `runtime` annotation) and is where Slice 4 will read+refresh this cookie — hence the edge-safe split.

---

## File Structure

- `src/lib/active-profile-cookie.ts` — **NEW, pure + edge-safe.** Types (`ProfileType`, `ActiveProfilePayload`, `ActiveProfileToken`), `signActiveProfile`/`verifyActiveProfile` (jose HS256, `now` injected for testability), `idleTtlMs`, `ACTIVE_PROFILE_COOKIE`, `activeProfileCookieOptions()`. No imports of Prisma, `node:crypto`, `next/headers`, or `server-only`.
- `src/lib/active-profile-cookie.test.ts` — **NEW.** Exhaustive unit tests for the pure crypto/idle logic.
- `src/server/profiles/active-profile.ts` — **NEW, server-only.** `loadActiveProfile()` (impl), `getActiveProfile = cache(loadActiveProfile)`, `setActiveProfile()`, `clearActiveProfile()`. Imports `next/headers`, `@/auth` helpers, `@/server/db`, and the pure lib.
- `src/server/profiles/active-profile.test.ts` — **NEW.** Integration tests for `loadActiveProfile`'s fail-closed branches (mocks `next/headers`, `@/lib/auth-helpers`, `@/server/db`; uses the REAL pure lib to mint tokens).
- `package.json` — **MODIFY.** Add `jose` to dependencies.

> **Why two files:** the proxy (Slice 4) runs at the edge where `node:crypto` and Prisma are unavailable. Keeping sign/verify in a dependency-light module lets the proxy import `verifyActiveProfile` directly. The server module carries everything node-only (`server-only`, `next/headers`, Prisma) and must never be imported by the proxy.

---

## Task 1: Add the `jose` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install jose**

Run: `npm i jose`
Expected: `jose` (v6.x) added to `dependencies`, no peer-dep errors. (It is already present transitively via `@auth/core`; this promotes it to a direct, edge-safe dependency we control.)

- [ ] **Step 2: Confirm the version resolved**

Run: `npm ls jose`
Expected: a top-level `jose@6.x` entry (not only nested under `@auth/core`).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(profiles): add jose as a direct dep (edge-safe JWS signing for Slice 2)"
```

---

## Task 2: The pure, edge-safe cookie library (TDD)

**Files:**
- Create: `src/lib/active-profile-cookie.ts`
- Test: `src/lib/active-profile-cookie.test.ts`

This module is the security core. It is pure (I/O-free), so it gets the hardest test coverage. `now` is injected into sign/verify so idle-expiry is deterministic in tests.

- [ ] **Step 1: Write the failing test**

Create `src/lib/active-profile-cookie.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  signActiveProfile,
  verifyActiveProfile,
  idleTtlMs,
  type ActiveProfilePayload,
} from "./active-profile-cookie";

// jose HS256 requires a key >= 256 bits (32 bytes). Real AUTH_SECRET is >= 32 bytes.
const SECRET = "test-secret-0123456789-abcdefghij-KLMNOP";
const OTHER_SECRET = "different-secret-0123456789-abcdefghij-XY";
const T0 = 1_700_000_000_000; // a whole-second epoch (ms), so iat round-trips exactly
const MIN = 60 * 1000;

const parent: ActiveProfilePayload = { profileId: "p1", type: "PARENT", uid: "u1", org: "o1" };
const student: ActiveProfilePayload = { profileId: "p2", type: "STUDENT", uid: "u1", org: "o1" };

describe("signActiveProfile / verifyActiveProfile", () => {
  it("round-trips a payload signed and verified at the same instant", async () => {
    const token = await signActiveProfile(parent, SECRET, T0);
    const out = await verifyActiveProfile(token, SECRET, T0);
    expect(out).toMatchObject({ profileId: "p1", type: "PARENT", uid: "u1", org: "o1" });
    expect(out?.iat).toBe(T0 / 1000);
  });

  it("rejects a token signed with a different secret (forged)", async () => {
    const token = await signActiveProfile(parent, SECRET, T0);
    expect(await verifyActiveProfile(token, OTHER_SECRET, T0)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signActiveProfile(parent, SECRET, T0);
    // Flip a character in the payload segment.
    const [h, p, s] = token.split(".");
    const tampered = `${h}.${p.slice(0, -1)}${p.endsWith("A") ? "B" : "A"}.${s}`;
    expect(await verifyActiveProfile(tampered, SECRET, T0)).toBeNull();
  });

  it("rejects garbage that is not a JWS", async () => {
    expect(await verifyActiveProfile("not-a-token", SECRET, T0)).toBeNull();
    expect(await verifyActiveProfile("", SECRET, T0)).toBeNull();
  });

  it("rejects an unknown profile type (fail-closed)", async () => {
    const bogus = { ...parent, type: "ADMIN" } as unknown as ActiveProfilePayload;
    const token = await signActiveProfile(bogus, SECRET, T0);
    expect(await verifyActiveProfile(token, SECRET, T0)).toBeNull();
  });

  it("PARENT: valid before the 15-min idle window, null after", async () => {
    const token = await signActiveProfile(parent, SECRET, T0);
    expect(await verifyActiveProfile(token, SECRET, T0 + 14 * MIN)).not.toBeNull();
    expect(await verifyActiveProfile(token, SECRET, T0 + 16 * MIN)).toBeNull();
  });

  it("STUDENT: persists far beyond the PARENT window", async () => {
    const token = await signActiveProfile(student, SECRET, T0);
    const hundredDays = 100 * 24 * 60 * MIN;
    expect(await verifyActiveProfile(token, SECRET, T0 + hundredDays)).not.toBeNull();
  });
});

describe("idleTtlMs", () => {
  it("PARENT idles at 15 minutes; STUDENT never idles", () => {
    expect(idleTtlMs("PARENT")).toBe(15 * MIN);
    expect(idleTtlMs("STUDENT")).toBe(Number.POSITIVE_INFINITY);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/active-profile-cookie.test.ts`
Expected: FAIL — "Cannot find module './active-profile-cookie'".

- [ ] **Step 3: Implement the pure library**

Create `src/lib/active-profile-cookie.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";

/** Profile types, kept as a local string-literal union so this module stays Prisma-free
 *  (it must be importable by the edge proxy). Values match the Prisma `ProfileType` enum. */
export type ProfileType = "PARENT" | "STUDENT";

/** Claims we put in the signed cookie. `uid`/`org` bind it to the login + tenant. */
export type ActiveProfilePayload = {
  profileId: string;
  type: ProfileType;
  uid: string; // the User.id this cookie was issued to
  org: string; // the Organization.id this cookie was issued under
};

/** What a successful verify returns: the payload plus the issued-at (seconds). */
export type ActiveProfileToken = ActiveProfilePayload & { iat: number };

const PARENT_IDLE_MS = 15 * 60 * 1000;

/** Per-type idle window. PARENT re-prompts after 15 min idle; STUDENT persists. */
export function idleTtlMs(type: ProfileType): number {
  return type === "PARENT" ? PARENT_IDLE_MS : Number.POSITIVE_INFINITY;
}

function isProfileType(v: unknown): v is ProfileType {
  return v === "PARENT" || v === "STUDENT";
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Sign an HS256 JWS. `now` (ms) is injected so issued-at is deterministic in tests. */
export async function signActiveProfile(
  payload: ActiveProfilePayload,
  secret: string,
  now: number,
): Promise<string> {
  return new SignJWT({
    profileId: payload.profileId,
    type: payload.type,
    uid: payload.uid,
    org: payload.org,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(now / 1000))
    .sign(key(secret));
}

/** Verify signature + per-type idle window. Returns null on ANY failure (fail-closed). */
export async function verifyActiveProfile(
  token: string,
  secret: string,
  now: number,
): Promise<ActiveProfileToken | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    const { profileId, type, uid, org, iat } = payload as Record<string, unknown>;
    if (typeof profileId !== "string" || typeof uid !== "string" || typeof org !== "string") return null;
    if (!isProfileType(type)) return null;
    if (typeof iat !== "number") return null;
    if (now - iat * 1000 > idleTtlMs(type)) return null; // idle-expired
    return { profileId, type, uid, org, iat };
  } catch {
    return null; // bad signature, malformed token, etc.
  }
}

const isProd = process.env.NODE_ENV === "production";

/** Cookie name — `__Secure-`-prefixed in prod only (mirrors the auth.js pkce cookie). */
export const ACTIVE_PROFILE_COOKIE = `${isProd ? "__Secure-" : ""}active_profile`;

/** Base cookie attributes, matching the session-cookie conventions in src/auth.ts. */
export function activeProfileCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: isProd,
    domain: isProd ? ".quillandcompass.app" : undefined,
    path: "/" as const,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/active-profile-cookie.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add src/lib/active-profile-cookie.ts src/lib/active-profile-cookie.test.ts
git commit -m "feat(profiles): edge-safe active_profile cookie lib (jose HS256 sign/verify + idle policy)"
```

---

## Task 3: The server-only active-profile helper

**Files:**
- Create: `src/server/profiles/active-profile.ts`

`getActiveProfile()` mirrors `getStudentById`: `cache()`-wrapped, loads via `withTenant`, fails closed. The testable logic lives in `loadActiveProfile()` (un-cached) so unit tests can call it directly without a React request scope; `getActiveProfile` is the trivial `cache()` wrapper the app imports.

- [ ] **Step 1: Implement the helper**

Create `src/server/profiles/active-profile.ts`:

```ts
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { withTenant } from "@/server/db";
import {
  ACTIVE_PROFILE_COOKIE,
  activeProfileCookieOptions,
  signActiveProfile,
  verifyActiveProfile,
  type ProfileType,
} from "@/lib/active-profile-cookie";

/** Fields safe to expose. NEVER selects pin_hash. */
const activeProfileSelect = {
  id: true,
  organizationId: true,
  type: true,
  displayName: true,
  avatarConfig: true,
  viewMode: true,
  userId: true,
  isOwner: true,
} as const;

function authSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) is not set");
  return s;
}

/**
 * The authoritative active profile for the current request, or null.
 * Fail-closed at every step: not logged in, no/invalid cookie, cookie not bound
 * to this login/org, or profile missing/out-of-org all return null.
 *
 * Exported un-cached for testability; the app should import `getActiveProfile`.
 */
export async function loadActiveProfile() {
  // Must be logged in. getCurrentUserOrg throws when unauthenticated -> treat as no profile.
  let ctx: { userId: string; organizationId: string };
  try {
    ctx = await getCurrentUserOrg();
  } catch {
    return null;
  }

  const raw = (await cookies()).get(ACTIVE_PROFILE_COOKIE)?.value;
  if (!raw) return null;

  const token = await verifyActiveProfile(raw, authSecret(), Date.now());
  if (!token) return null;

  // Defense in depth: the cookie must belong to THIS login + tenant.
  if (token.uid !== ctx.userId || token.org !== ctx.organizationId) return null;

  const profile = await withTenant(
    (tx) =>
      tx.profile.findUnique({
        where: { id: token.profileId },
        select: activeProfileSelect,
      }),
    undefined,
    { organizationId: ctx.organizationId, userId: null },
  );

  if (!profile || profile.organizationId !== ctx.organizationId) return null;
  return profile;
}

/** Request-deduped active profile (mirrors getStudentById's cache() pattern). */
export const getActiveProfile = cache(loadActiveProfile);

export type ActiveProfile = NonNullable<Awaited<ReturnType<typeof loadActiveProfile>>>;

/**
 * Sign + set the active_profile cookie for the current login.
 * Callers (the picker action in Slice 3, verifyProfilePin in Slice 5) MUST authorize
 * the profile (in-org, PIN if required) BEFORE calling this. Server Action / Route Handler only.
 */
export async function setActiveProfile(input: { profileId: string; type: ProfileType }): Promise<void> {
  const ctx = await getCurrentUserOrg();
  const token = await signActiveProfile(
    { profileId: input.profileId, type: input.type, uid: ctx.userId, org: ctx.organizationId },
    authSecret(),
    Date.now(),
  );
  (await cookies()).set(ACTIVE_PROFILE_COOKIE, token, {
    ...activeProfileCookieOptions(),
    maxAge: 60 * 60 * 24 * 30, // browser retention; PARENT idle is still enforced server-side via iat
  });
}

/** Clear the active_profile cookie ("Switch Profile" / logout). Server Action / Route Handler only. */
export async function clearActiveProfile(): Promise<void> {
  // Overwrite with an immediately-expiring cookie so the matching domain/path is cleared in prod.
  (await cookies()).set(ACTIVE_PROFILE_COOKIE, "", {
    ...activeProfileCookieOptions(),
    maxAge: 0,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (If `tx.profile` is flagged, run `npx prisma generate` first — the `Profile` model is already in `schema.prisma`, so the client just needs regenerating in this workspace.)

- [ ] **Step 3: Commit**

```bash
git add src/server/profiles/active-profile.ts
git commit -m "feat(profiles): getActiveProfile/setActiveProfile/clearActiveProfile server helpers"
```

---

## Task 4: Integration tests for the fail-closed branches

**Files:**
- Test: `src/server/profiles/active-profile.test.ts`

Mocks the I/O seams (`next/headers`, `@/lib/auth-helpers`, `@/server/db`) but uses the REAL pure lib to mint tokens, so verification logic is exercised end-to-end. Targets `loadActiveProfile` (not the `cache()` wrapper) to avoid needing a React request scope.

- [ ] **Step 1: Write the test**

Create `src/server/profiles/active-profile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks for the I/O seams (declared before importing the module under test). ---
const getCurrentUserOrg = vi.fn();
const withTenant = vi.fn();
const cookieGet = vi.fn();

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUserOrg: () => getCurrentUserOrg() }));
vi.mock("@/server/db", () => ({ withTenant: (...a: unknown[]) => withTenant(...a) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => cookieGet(n) }) }));
vi.mock("server-only", () => ({}));

import { loadActiveProfile } from "./active-profile";
import { signActiveProfile, ACTIVE_PROFILE_COOKIE } from "@/lib/active-profile-cookie";

const SECRET = "test-secret-0123456789-abcdefghij-KLMNOP";
const CTX = { userId: "u1", organizationId: "o1" };
const PROFILE = { id: "p1", organizationId: "o1", type: "PARENT", displayName: "Adam", avatarConfig: null, viewMode: "STANDARD", userId: "u1", isOwner: true };

async function cookieValue(overrides: Partial<{ profileId: string; uid: string; org: string }> = {}) {
  return signActiveProfile(
    { profileId: overrides.profileId ?? "p1", type: "PARENT", uid: overrides.uid ?? "u1", org: overrides.org ?? "o1" },
    SECRET,
    Date.now(),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = SECRET;
  getCurrentUserOrg.mockResolvedValue(CTX);
  cookieGet.mockReturnValue(undefined);
  withTenant.mockResolvedValue(PROFILE);
});

describe("loadActiveProfile", () => {
  it("returns null when not logged in (getCurrentUserOrg throws)", async () => {
    getCurrentUserOrg.mockRejectedValue(new Error("User not authenticated"));
    expect(await loadActiveProfile()).toBeNull();
    expect(cookieGet).not.toHaveBeenCalled();
  });

  it("returns null when there is no active_profile cookie", async () => {
    cookieGet.mockReturnValue(undefined);
    expect(await loadActiveProfile()).toBeNull();
  });

  it("returns null when the cookie is signed with the wrong secret", async () => {
    const bad = await signActiveProfile({ profileId: "p1", type: "PARENT", uid: "u1", org: "o1" }, "WRONG-secret-0123456789-abcdefghij-ZZ", Date.now());
    cookieGet.mockReturnValue({ value: bad });
    expect(await loadActiveProfile()).toBeNull();
  });

  it("returns null when the cookie's uid does not match the session", async () => {
    cookieGet.mockReturnValue({ value: await cookieValue({ uid: "someone-else" }) });
    expect(await loadActiveProfile()).toBeNull();
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("returns null when the profile is not found", async () => {
    cookieGet.mockReturnValue({ value: await cookieValue() });
    withTenant.mockResolvedValue(null);
    expect(await loadActiveProfile()).toBeNull();
  });

  it("returns null when the loaded profile is in a different org", async () => {
    cookieGet.mockReturnValue({ value: await cookieValue() });
    withTenant.mockResolvedValue({ ...PROFILE, organizationId: "other-org" });
    expect(await loadActiveProfile()).toBeNull();
  });

  it("returns the profile on the happy path", async () => {
    cookieGet.mockReturnValue({ value: await cookieValue() });
    const out = await loadActiveProfile();
    expect(out).toMatchObject({ id: "p1", type: "PARENT" });
    expect(cookieGet).toHaveBeenCalledWith(ACTIVE_PROFILE_COOKIE);
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npx vitest run src/server/profiles/active-profile.test.ts`
Expected: PASS (7 tests). If `loadActiveProfile` returns a profile where null was expected, re-check the corresponding fail-closed guard in Task 3.

- [ ] **Step 3: Commit**

```bash
git add src/server/profiles/active-profile.test.ts
git commit -m "test(profiles): fail-closed coverage for loadActiveProfile (auth/cookie/uid/org guards)"
```

---

## Task 5: Verification gate + self-review

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests pass — including the new `active-profile-cookie.test.ts` (8) and `active-profile.test.ts` (7), plus the pre-existing `smoke` and `backfill` tests.

- [ ] **Step 3: Real-secret round-trip smoke (throwaway)**

Confirm sign/verify works under the *actual* configured secret (not just the test secret). Create `scripts/_tmp-active-profile-check.ts`:

```ts
import "dotenv/config";
import { signActiveProfile, verifyActiveProfile } from "@/lib/active-profile-cookie";

const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET!;
const now = Date.now();
const token = await signActiveProfile({ profileId: "p1", type: "PARENT", uid: "u1", org: "o1" }, secret, now);
const ok = await verifyActiveProfile(token, secret, now);
const forged = await verifyActiveProfile(token, secret + "x", now);
console.log("verify:", ok && ok.profileId === "p1" ? "OK" : "FAIL", "| forged rejected:", forged === null ? "OK" : "FAIL");
```

Run: `npx tsx scripts/_tmp-active-profile-check.ts`
Expected: `verify: OK | forged rejected: OK`.

- [ ] **Step 4: Delete the throwaway script**

Run: `rm scripts/_tmp-active-profile-check.ts` (PowerShell: `Remove-Item scripts/_tmp-active-profile-check.ts`)
Expected: file gone; nothing references it. (Do NOT commit this script.)

- [ ] **Step 5: Self-review against the spec (§5)**

Confirm each §5 requirement maps to a task:
- "signed (HMAC w/ AUTH_SECRET) `active_profile` cookie holds `{ profileId, type, issuedAt }`" → Task 2 (HS256 JWS = HMAC; `iat` is issuedAt; payload additionally binds `uid`/`org`).
- "`getActiveProfile()` … verify cookie → load + org-scope the profile → return it (or null). Memoized per request" → Task 3 (`withTenant` org-scope + `cache()`).
- "the signature lets the proxy trust `type` without a DB hit" → `verifyActiveProfile` is pure/edge-safe and returns `type` (Slice 4 consumes it).
- "Idle expiry … PARENT ~15 min idle … STUDENT persists" → Task 2 (`idleTtlMs`); sliding re-stamp is explicitly Slice 4.
- "Switch Profile clears the cookie" → Task 3 (`clearActiveProfile`).
- "stale/forged cookie → fail-closed" → Tasks 2 & 4 (forged/tampered/garbage/uid-mismatch/out-of-org all → null).

---

## Self-Review

- **Spec coverage (§5):** signed cookie ✓ (Task 2), `getActiveProfile` org-scoped + memoized ✓ (Task 3), edge-safe `type` for the proxy ✓ (Task 2 split), idle policy ✓ (Task 2), switch/clear ✓ (Task 3), fail-closed ✓ (Tasks 2/4). **Deferred (documented):** picker/split-homepage → Slice 3; proxy read + **sliding re-stamp** + type authz → Slice 4; PIN verify + management → Slice 5.
- **Placeholder scan:** none — every code/test/command step is concrete.
- **Type/name consistency:** `ProfileType`, `ActiveProfilePayload`, `ActiveProfileToken`, `signActiveProfile`, `verifyActiveProfile`, `idleTtlMs`, `ACTIVE_PROFILE_COOKIE`, `activeProfileCookieOptions`, `loadActiveProfile`, `getActiveProfile`, `setActiveProfile`, `clearActiveProfile` are used identically across Tasks 2–4. `withTenant(fn, undefined, { organizationId, userId })` matches `src/server/db.ts:98` and `getStudentById`.
- **No schema/prod changes:** Slice 2 only reads `profiles`; no migration, no backfill, no env changes. Safe for the live DB.
- **Edge-safety invariant:** `src/lib/active-profile-cookie.ts` imports only `jose` — no Prisma, `node:crypto`, `next/headers`, or `server-only` — so Slice 4's edge proxy can reuse `verifyActiveProfile`. The node-only concerns are quarantined in `src/server/profiles/active-profile.ts` (guarded by `server-only`).
- **Known follow-ups for later slices:** PARENT idle is effectively *absolute*-15-min until Slice 4 wires the proxy to re-issue the cookie (fresh `iat`) on activity, making it truly sliding; `setActiveProfile` trusts its caller to have authorized the profile (Slices 3/5 do that).
```