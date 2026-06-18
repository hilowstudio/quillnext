# Profiles — Slice 4: Profile-Type Authorization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the edge proxy (`src/proxy.ts`) with profile-type authorization — no active profile → the picker; an active STUDENT profile → a learner-route allowlist; an active PARENT profile → everything, with a throttled sliding-idle cookie re-stamp — and add a server-side `assertParentProfile()` re-check on the destructive/admin actions so a STUDENT session can't call them directly.

**Architecture:** All authorization *logic* lives in a **pure, edge-safe** module (`src/lib/profile-access.ts`: `isStudentAllowed`, `isSelectProfilePath`, `profileGateDecision`) that is exhaustively unit-tested; `src/proxy.ts` stays a thin async shell that resolves the active-profile *type* from the signed cookie at the edge (verify + `uid`/`org` binding against `auth()`, **no DB hit**), calls `profileGateDecision`, and re-stamps a PARENT cookie whose `iat` is >5 min old. Defense-in-depth: `assertParentProfile()` (server, reads `getActiveProfile()`) is added to the triaged PARENT-only destructive actions; student-own discipleship data and onboarding are deliberately left unguarded.

**Tech Stack:** Next 16 edge proxy/middleware (`NextResponse`, `req.cookies`/`res.cookies`), the Slice-2 jose-only cookie lib (`verifyActiveProfile`/`signActiveProfile`), next-auth v5 (`auth()` exposes `session.user.id`/`organizationId` at the edge), Vitest.

---

## Background — verified seam

- **Proxy today** ([`src/proxy.ts`](../../../src/proxy.ts)): `isPublicRoute(pathname)` (exact-match Set) → `next()`; else `await auth()` → no session → redirect `/login`; else `next()`. Matcher: `["/((?!api|_next/static|_next/image|assets|favicon.ico).*)"]` (so `/api/*` and assets are NOT gated by the proxy — server actions/route handlers must self-guard). Runs on the **Edge** runtime (no `runtime` annotation = renamed middleware).
- **Edge mechanics (confirmed):** `req.cookies.get(name)?.value` reads; `const res = NextResponse.next(); res.cookies.set(name, value, opts); return res` writes. `await auth()` returns `session.user.id` + `session.user.organizationId` (JWT-stamped, no DB). `process.env.AUTH_SECRET || NEXTAUTH_SECRET` readable at the edge.
- **Cookie lib** [`src/lib/active-profile-cookie.ts`](../../../src/lib/active-profile-cookie.ts) (jose-only, edge-safe, no `server-only`): `verifyActiveProfile(token, secret, now) → {profileId,type,uid,org,iat}|null` (`iat` = **UNIX seconds**); `signActiveProfile(payload, secret, now) → string`; `ACTIVE_PROFILE_COOKIE`; `activeProfileCookieOptions()`; `idleTtlMs(type)` (PARENT 15min, STUDENT Infinity); `ProfileType`.
- **Active profile (server)** [`src/server/profiles/active-profile.ts`](../../../src/server/profiles/active-profile.ts): `getActiveProfile()` → `{ id, type, ... }|null` (cached, org-scoped, strips `pinHash`).
- **STUDENT surfaces (reality):** `/` (dashboard) exists; `/courses/[id]/learn` is **reserved/not built** (allow anyway — 404s harmlessly until built); `/living-library/resource/[id]` exists; `/family-discipleship/**` (9 pages) exists; `/students/[id]/family-discipleship/**` exists (only `/` + `/catechism` so far). Avatar customization is a **modal at `/`**, not a route. `/context` is **excluded** (decision). The `/courses/[id]/learn` and `/students/[id]/family-discipleship/**` carve-outs are **not clean prefixes** (the rest of `/courses/**` and `/students/[id]/**` are admin).
- **Destructive actions to guard (PARENT-only set):** `account-actions.ts` (`deleteAccount`, `deactivateAccount`, `reactivateAccount`, `transferOwnership`), `student-actions.ts` (`deleteStudent`), `course-actions.ts` (`deleteCourse`, `deleteBlock`), `resource-library-actions.ts` (`deleteBook`, `deleteVideo`, `deleteArticle`, `deleteDocument`, `deleteGeneratedResource`), `src/server/actions/transcript.ts` (`deleteTranscript`), and the `DELETE` handler in `src/app/api/courses/[id]/blocks/[blockId]/route.ts`. **Excluded:** onboarding (`blueprint.ts`, runs before any profile exists) and student-own discipleship (prayer-journal, bible-memory, family-discipleship notes).

> **Test reality:** the edge proxy itself isn't unit-testable here; the authz **logic** is fully covered by `profile-access.test.ts` + `guards.test.ts`, and the proxy wiring is verified by `tsc`, `npm run build`, and a manual runtime smoke (Task 5). Re-run `npm test` if it flakes to "no tests" (known vitest-v4 flake — do NOT downgrade).

---

## File Structure

- `src/lib/profile-access.ts` — **NEW, pure edge-safe.** `isSelectProfilePath`, `isStudentAllowed`, `profileGateDecision`. Imports only the `ProfileType` type.
- `src/lib/profile-access.test.ts` — **NEW.**
- `src/server/profiles/guards.ts` — **NEW, server.** `assertParentProfile()` (imports `getActiveProfile` from `./active-profile`).
- `src/server/profiles/guards.test.ts` — **NEW.**
- `src/proxy.ts` — **MODIFY.** Resolve active-profile type at the edge + apply `profileGateDecision` + throttled PARENT re-stamp.
- The ~14 destructive actions listed above — **MODIFY.** Insert `await assertParentProfile();`.

---

## Task 1: Pure authorization logic (TDD)

**Files:**
- Create: `src/lib/profile-access.ts`
- Test: `src/lib/profile-access.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/profile-access.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isSelectProfilePath, isStudentAllowed, profileGateDecision } from "./profile-access";

describe("isSelectProfilePath", () => {
  it("matches the picker route and its subpaths only", () => {
    expect(isSelectProfilePath("/select-profile")).toBe(true);
    expect(isSelectProfilePath("/select-profile/anything")).toBe(true);
    expect(isSelectProfilePath("/select-profile-foo")).toBe(false);
    expect(isSelectProfilePath("/")).toBe(false);
  });
});

describe("isStudentAllowed", () => {
  it("allows the learner surfaces", () => {
    for (const p of [
      "/",
      "/select-profile",
      "/courses/abc123/learn",
      "/living-library/resource/xyz",
      "/family-discipleship",
      "/family-discipleship/prayer",
      "/students/s1/family-discipleship",
      "/students/s1/family-discipleship/catechism",
    ]) {
      expect(isStudentAllowed(p), p).toBe(true);
    }
  });

  it("blocks admin / non-learner surfaces", () => {
    for (const p of [
      "/courses",
      "/courses/abc123",
      "/courses/abc123/builder",
      "/courses/abc123/blocks/b1",
      "/living-library",
      "/living-library/videos",
      "/students",
      "/students/s1",
      "/students/s1/assessment",
      "/context",
      "/planner",
      "/grading",
      "/creation-station",
      "/blueprint",
      "/onboarding",
    ]) {
      expect(isStudentAllowed(p), p).toBe(false);
    }
  });
});

describe("profileGateDecision", () => {
  it("PARENT may go anywhere", () => {
    expect(profileGateDecision("/courses", "PARENT")).toBe("allow");
    expect(profileGateDecision("/anything/at/all", "PARENT")).toBe("allow");
  });

  it("STUDENT is held to the learner allowlist", () => {
    expect(profileGateDecision("/", "STUDENT")).toBe("allow");
    expect(profileGateDecision("/family-discipleship/prayer", "STUDENT")).toBe("allow");
    expect(profileGateDecision("/courses/c1/builder", "STUDENT")).toBe("picker");
    expect(profileGateDecision("/students/s1", "STUDENT")).toBe("picker");
  });

  it("no active profile may reach only the picker", () => {
    expect(profileGateDecision("/select-profile", null)).toBe("allow");
    expect(profileGateDecision("/", null)).toBe("picker");
    expect(profileGateDecision("/courses", null)).toBe("picker");
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run src/lib/profile-access.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure module**

Create `src/lib/profile-access.ts`:

```ts
import type { ProfileType } from "@/lib/active-profile-cookie";

/** The picker route (and its subpaths). Reachable by any logged-in user, profile or not. */
export function isSelectProfilePath(pathname: string): boolean {
  return pathname === "/select-profile" || pathname.startsWith("/select-profile/");
}

/**
 * Routes an active STUDENT profile may reach. NON-clean-prefix carve-outs (e.g. `/courses/[id]/learn`
 * is open while the rest of `/courses/**` is admin), so this is an ordered set of explicit matchers.
 * `/courses/[id]/learn` is reserved (not built yet) — allowed now so it works the moment it lands.
 */
const STUDENT_ROUTE_MATCHERS: RegExp[] = [
  /^\/$/,
  /^\/courses\/[^/]+\/learn$/,
  /^\/living-library\/resource\/[^/]+$/,
  /^\/family-discipleship(?:\/.*)?$/,
  /^\/students\/[^/]+\/family-discipleship(?:\/.*)?$/,
];

export function isStudentAllowed(pathname: string): boolean {
  if (isSelectProfilePath(pathname)) return true;
  return STUDENT_ROUTE_MATCHERS.some((re) => re.test(pathname));
}

/**
 * The proxy gate decision for a (non-public, authenticated) request, given the active profile type
 * resolved from the signed cookie (or null when there is no valid active profile).
 */
export function profileGateDecision(
  pathname: string,
  activeType: ProfileType | null,
): "allow" | "picker" {
  if (activeType === "PARENT") return "allow";
  if (activeType === "STUDENT") return isStudentAllowed(pathname) ? "allow" : "picker";
  return isSelectProfilePath(pathname) ? "allow" : "picker";
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run src/lib/profile-access.test.ts`
Expected: PASS (5 tests). If `npm test` flakes to "no tests", re-run.

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add src/lib/profile-access.ts src/lib/profile-access.test.ts
git commit -m "feat(profiles): pure edge-safe profile-gate logic (student allowlist + decision)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `assertParentProfile()` server guard (TDD)

**Files:**
- Create: `src/server/profiles/guards.ts`
- Test: `src/server/profiles/guards.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/profiles/guards.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getActiveProfile = vi.fn();
vi.mock("./active-profile", () => ({ getActiveProfile: () => getActiveProfile() }));

import { assertParentProfile } from "./guards";

beforeEach(() => vi.clearAllMocks());

describe("assertParentProfile", () => {
  it("resolves when the active profile is PARENT", async () => {
    getActiveProfile.mockResolvedValue({ id: "p1", type: "PARENT" });
    await expect(assertParentProfile()).resolves.toBeUndefined();
  });

  it("throws when the active profile is STUDENT", async () => {
    getActiveProfile.mockResolvedValue({ id: "p2", type: "STUDENT" });
    await expect(assertParentProfile()).rejects.toThrow(/parent profile/i);
  });

  it("throws when there is no active profile", async () => {
    getActiveProfile.mockResolvedValue(null);
    await expect(assertParentProfile()).rejects.toThrow(/parent profile/i);
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `npx vitest run src/server/profiles/guards.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the guard**

Create `src/server/profiles/guards.ts`:

```ts
import "server-only";
import { getActiveProfile } from "./active-profile";

/**
 * Server-side defense-in-depth: require that the CURRENT active profile is PARENT.
 * Throws otherwise (no/STUDENT profile). Call at the very top of destructive/admin actions —
 * before any DB work — so a STUDENT session can't invoke them by calling the action directly,
 * even though the proxy already gates page navigation.
 */
export async function assertParentProfile(): Promise<void> {
  const active = await getActiveProfile();
  if (active?.type !== "PARENT") {
    throw new Error("This action requires a parent profile.");
  }
}
```

- [ ] **Step 4: Run it (green)**

Run: `npx vitest run src/server/profiles/guards.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add src/server/profiles/guards.ts src/server/profiles/guards.test.ts
git commit -m "feat(profiles): assertParentProfile() server guard (defense-in-depth for destructive actions)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Extend the proxy with profile-type tiers + sliding re-stamp

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Rewrite the `proxy` function body (keep `PUBLIC_ROUTES`/`isPublicRoute`/`config` as-is)**

Replace the imports and the `proxy` function in `src/proxy.ts` (leave `PUBLIC_ROUTES`, `isPublicRoute`, and the exported `config` unchanged):

```ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACTIVE_PROFILE_COOKIE,
  activeProfileCookieOptions,
  signActiveProfile,
  verifyActiveProfile,
  type ProfileType,
} from "@/lib/active-profile-cookie";
import { profileGateDecision } from "@/lib/profile-access";

// (PUBLIC_ROUTES + isPublicRoute unchanged, above)

const RESTAMP_AFTER_SECONDS = 5 * 60; // re-issue a PARENT cookie at most once per ~5 min of activity
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // browser retention; idle is enforced server-side via iat

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Resolve the active profile TYPE from the signed cookie — at the edge, no DB hit. The cookie is
  // only trusted if its signature/idle is valid AND it is bound to THIS login + org.
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  const raw = req.cookies.get(ACTIVE_PROFILE_COOKIE)?.value;
  const userId = session.user.id;
  const orgId = (session.user as { organizationId?: string }).organizationId;

  let activeType: ProfileType | null = null;
  let token: Awaited<ReturnType<typeof verifyActiveProfile>> = null;
  if (raw && secret) {
    token = await verifyActiveProfile(raw, secret, Date.now());
    if (token && token.uid === userId && token.org === orgId) {
      activeType = token.type;
    }
  }

  if (profileGateDecision(pathname, activeType) === "picker") {
    return NextResponse.redirect(new URL("/select-profile", req.url));
  }

  // Allowed. Sliding idle: refresh an aging PARENT cookie so continued activity keeps it alive.
  const res = NextResponse.next();
  if (activeType === "PARENT" && token && secret) {
    const ageSeconds = Math.floor(Date.now() / 1000) - token.iat;
    if (ageSeconds > RESTAMP_AFTER_SECONDS) {
      const fresh = await signActiveProfile(
        { profileId: token.profileId, type: token.type, uid: token.uid, org: token.org },
        secret,
        Date.now(),
      );
      res.cookies.set(ACTIVE_PROFILE_COOKIE, fresh, {
        ...activeProfileCookieOptions(),
        maxAge: COOKIE_MAX_AGE,
      });
    }
  }
  return res;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (If `session.user.id` is typed `string | undefined`, the binding check `token.uid === userId` still type-checks; the cast `(session.user as { organizationId?: string })` matches how the app reads org elsewhere.)

- [ ] **Step 3: Build (edge boundary gate)**

Run: `npm run build`
Expected: succeeds. Confirms the proxy still bundles for the edge (the cookie lib it now imports is jose-only / edge-safe — no `node:`/Prisma/`server-only` pulled in). If the build complains the proxy pulls a server-only module, STOP — something imported transitively broke edge-safety; report it.

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(profiles): proxy profile-type authz (picker/student-allowlist/parent) + sliding re-stamp

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Guard the destructive/admin actions

**Files (modify — insert one guard line each):**
- `src/app/actions/account-actions.ts` — `deleteAccount`, `deactivateAccount`, `reactivateAccount`, `transferOwnership`
- `src/app/actions/student-actions.ts` — `deleteStudent`
- `src/app/actions/course-actions.ts` — `deleteCourse`, `deleteBlock`
- `src/app/actions/resource-library-actions.ts` — `deleteBook`, `deleteVideo`, `deleteArticle`, `deleteDocument`, `deleteGeneratedResource`
- `src/server/actions/transcript.ts` — `deleteTranscript`
- `src/app/api/courses/[id]/blocks/[blockId]/route.ts` — the `DELETE` handler

The change is uniform: `import { assertParentProfile } from "@/server/profiles/guards";` (once per file) and `await assertParentProfile();` as the **first awaited statement** in each listed function — immediately after its existing `getCurrentUserOrg()` / `auth()` call and **before any DB read/write or transaction** (so nothing partial runs if it throws).

- [ ] **Step 1: Worked example — `deleteAccount`**

In `src/app/actions/account-actions.ts`, add the import, then guard each listed export. For `deleteAccount`, place the guard right after the existing auth/`getCurrentUserOrg()` call and before the cascade transaction:

```ts
import { assertParentProfile } from "@/server/profiles/guards";

// ... inside deleteAccount, after the existing getCurrentUserOrg()/session check, before any db work:
  await assertParentProfile();
```

Apply the same `await assertParentProfile();` placement to `deactivateAccount`, `reactivateAccount`, and `transferOwnership` in this file.

- [ ] **Step 2: Apply the same guard to the remaining files**

For each remaining file/function in the list above: add the `import { assertParentProfile } from "@/server/profiles/guards";` (once), and insert `await assertParentProfile();` as the first awaited statement in each listed function (after its existing auth call, before DB work). In the API route handler (`route.ts`), insert it at the top of the `DELETE` function after the session check.

> Do NOT guard anything not on the list — especially NOT `blueprint.ts` (onboarding runs before a profile exists) or the prayer-journal / bible-memory / family-discipleship-notes actions (a STUDENT legitimately manages their own discipleship data).

- [ ] **Step 3: Verify every target is guarded**

Run (Git Bash):
```bash
for f in src/app/actions/account-actions.ts src/app/actions/student-actions.ts src/app/actions/course-actions.ts src/app/actions/resource-library-actions.ts src/server/actions/transcript.ts "src/app/api/courses/[id]/blocks/[blockId]/route.ts"; do echo "== $f =="; grep -c "assertParentProfile" "$f"; done
```
Expected counts: account-actions `5` (1 import + 4 calls), student-actions `2`, course-actions `3`, resource-library-actions `6`, transcript `2`, route.ts `2`.

Confirm onboarding is NOT guarded:
```bash
grep -c "assertParentProfile" src/server/actions/blueprint.ts
```
Expected: `0`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` → clean. (If any listed function doesn't already import from `@/server/profiles/guards`, the per-file import added in Steps 1–2 resolves it.)

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/account-actions.ts src/app/actions/student-actions.ts src/app/actions/course-actions.ts src/app/actions/resource-library-actions.ts src/server/actions/transcript.ts "src/app/api/courses/[id]/blocks/[blockId]/route.ts"
git commit -m "feat(profiles): require PARENT active profile for destructive/admin actions (defense-in-depth)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Verification gate + runtime smoke + self-review

**Files:** none.

- [ ] **Step 1: Typecheck + full suite + build**

Run: `npx tsc --noEmit` → clean.
Run: `npm test` → all green (new `profile-access` 5 + `guards` 3, plus prior slices). Re-run once if it flakes to "no tests".
Run: `npm run build` → succeeds.

- [ ] **Step 2: Runtime smoke (dev), signed in as the live account**

Start `npm run dev` and confirm:
- **No active profile** (after "Switch Profile"): visiting `/courses` (or any non-picker route) → redirected to `/select-profile`; `/select-profile` itself loads.
- **STUDENT active:** `/` loads (their dashboard); `/family-discipleship` loads; `/courses` and `/students/<id>` and `/planner` → redirect to `/select-profile`; `/living-library/resource/<id>` loads.
- **PARENT active:** all of the above load; leaving the tab idle and returning within 15 min keeps you in (cookie re-stamped); a Set-Cookie for `active_profile` appears on a request made >5 min after the last issue (DevTools → Network → a navigation response).
- **Server guard:** (optional) calling a guarded action while a STUDENT profile is active fails with "requires a parent profile" rather than mutating.

- [ ] **Step 3: Self-review against the design**

- Tiers: no-profile → picker ✓; STUDENT → allowlist ✓; PARENT → all + throttled re-stamp ✓.
- Binding: the proxy trusts the cookie `type` only when `uid`/`org` match the session ✓ (no DB hit).
- Guard triage: PARENT-only set guarded; onboarding + student-own discipleship NOT guarded ✓.
- Edge-safety: `src/proxy.ts` imports only the jose-only cookie lib + the pure `profile-access` module ✓ (`npm run build` is the gate).

---

## Self-Review

- **Spec coverage (§7 authorization + §5 sliding re-stamp):** tier 1 public (unchanged) ✓; tier 2 no-profile → picker ✓ (Task 3 + `profileGateDecision`); tier 3 STUDENT allowlist ✓ (Task 1, non-prefix carve-outs handled by explicit matchers); tier 4 PARENT all ✓; sliding PARENT re-stamp ✓ (Task 3, throttled >5min); server-side defense-in-depth ✓ (Task 2 + Task 4 triaged set). **Deferred (documented):** per-student discipleship data scoping within `/family-discipleship` (the `?studentId` view) is **FEAT-19/20, post-epic** — Slice 4 gates the *path*, not the per-student data; the reserved `/courses/[id]/learn` page itself is out of scope (allowlisted for when it lands).
- **No schema/migration/env change.** (`AUTH_SECRET` must be present in the deploy env for the edge proxy — it already is, since Slice 2 ships.)
- **Placeholder scan:** none. Task 4 applies a *uniform* one-line guard across an explicit, enumerated list with a worked example + a grep-count verification — concrete, not a placeholder.
- **Type/name consistency:** `isSelectProfilePath`/`isStudentAllowed`/`profileGateDecision` (Task 1) consumed by the proxy (Task 3); `assertParentProfile` (Task 2) consumed by Task 4; `ProfileType`/`verifyActiveProfile`/`signActiveProfile`/`ACTIVE_PROFILE_COOKIE`/`activeProfileCookieOptions` are the Slice-2 exports; `iat` compared in **seconds** (matches the lib).
- **Security:** the proxy trusts `type` without a DB hit only because the signature + `uid`/`org` binding are checked (fail-closed to "no profile" → picker on any mismatch); the server guard is the real protection for direct action calls (the proxy can't gate `/api/*` or server-action RPCs by logical identity).
- **Known follow-ups:** the student allowlist must stay complete as new learner surfaces ship (add matchers when `/courses/[id]/learn` and more `/students/[id]/family-discipleship/*` pages land); `/context` is currently parent-only (revisit if students need an "All About Me").
```