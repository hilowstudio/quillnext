# Profiles — Slice 1a: Data Model + Backfill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `Profile` table (typed, optionally PIN'd identity) alongside the existing learner data, link every existing learner to a backfilled profile, and stand up a test runner — all **purely additive** (no existing behavior changes).

**Architecture:** A new `Profile` row is the selectable "card" (type PARENT/STUDENT, name, avatar, PIN, view-mode), pointing at a `User` (parent) and/or the existing `Student` learner record (link via new `Student.profileId`). This slice keeps the `Student` table name (renamed to `Learner` in Slice 1b) and keeps `ClassroomInstructor.instructorPin` in place (dropped in Slice 5). Full design: [`docs/superpowers/specs/2026-06-18-profile-system-design.md`](../specs/2026-06-18-profile-system-design.md).

**Tech Stack:** Prisma 7 (driver-adapter, hand-authored numbered SQL migrations), Postgres + RLS (app connects as non-superuser `app_user`; new tenant tables need a policy or they read 0 rows), Next 16, Vitest (introduced here).

---

## File Structure

- `prisma/schema.prisma` — add `Profile` model + `ProfileType`/`ProfileViewMode` enums; add `profileId`/optional fields to `Student`; add `profiles` relations to `Organization` and `User`.
- `prisma/migrations/00000000000010_add_profiles/migration.sql` — create `profiles` table + RLS policy (hand-authored, matching the existing numbered-migration convention).
- `prisma/migrations/00000000000011_student_profile_link/migration.sql` — add `students.profile_id` + relax `birthdate`/`current_grade` NOT NULL.
- `src/server/profiles/backfill.ts` — **pure** mapping `buildProfileBackfill(users, learners)` → the rows to create/link (no DB access; unit-tested).
- `src/server/profiles/backfill.test.ts` — Vitest unit tests for the pure mapping.
- `scripts/backfill-profiles.ts` — thin runner: load users+learners, call `buildProfileBackfill`, write results, print counts.
- `vitest.config.ts`, `src/smoke.test.ts`, `package.json` (`test` script), `.github/workflows/ci.yml` — Vitest setup (HYG-1).

> **Migration convention:** existing migrations are hand-numbered folders (e.g. `00000000000002_rls_policies/migration.sql`) with raw SQL — NOT `prisma migrate dev` output. Follow that: create the next-numbered folder and write `migration.sql` by hand. Apply with the project's normal migrate step (needs `DIRECT_DATABASE_URL` / superuser, since `app_user` can't DDL). Then `npx prisma generate`.

---

## Task 1: Stand up Vitest (HYG-1)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/smoke.test.ts`
- Modify: `package.json` (scripts)
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Install Vitest**

Run: `npm i -D vitest`
Expected: added to devDependencies, no peer-dep errors.

- [ ] **Step 2: Add config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add the `test` script**

In `package.json` `scripts`, add: `"test": "vitest run"`.

- [ ] **Step 4: Write a smoke test (write it failing first)**

Create `src/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs arithmetic", () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS (1 test). If Vitest can't find tests, re-check `include`.

- [ ] **Step 6: Add CI step**

In `.github/workflows/ci.yml`, in the existing check job (after the `tsc`/`eslint` steps), add:

```yaml
      - run: npm test
```

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts src/smoke.test.ts package.json .github/workflows/ci.yml
git commit -m "test(infra): stand up Vitest + first smoke test + CI step (HYG-1)"
```

---

## Task 2: Add the `Profile` model + RLS policy

**Files:**
- Modify: `prisma/schema.prisma` (add model + enums + relations)
- Create: `prisma/migrations/00000000000010_add_profiles/migration.sql`

- [ ] **Step 1: Add the model and enums to `schema.prisma`**

Add near the other org-owned models:

```prisma
model Profile {
  id             String          @id @default(uuid())
  organizationId String          @map("account_id")
  type           ProfileType
  displayName    String          @map("display_name")
  avatarConfig   Json?           @map("avatar_config")
  pinHash        String?         @map("pin_hash")
  viewMode       ProfileViewMode @default(STANDARD) @map("view_mode")
  userId         String?         @map("user_id")
  isOwner        Boolean         @default(false) @map("is_owner")
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")

  organization   Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User?           @relation(fields: [userId], references: [id], onDelete: SetNull)
  learner        Student?

  @@index([organizationId])
  @@map("profiles")
}

enum ProfileType     { PARENT STUDENT }
enum ProfileViewMode { STANDARD KID }
```

Add `profiles Profile[]` to `model Organization` and `profiles Profile[]` to `model User`.

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/00000000000010_add_profiles/migration.sql`. Mirror the RLS policy shape used for other `account_id`-keyed tenant tables in `prisma/migrations/00000000000002_rls_policies/migration.sql`:

```sql
CREATE TYPE "ProfileType" AS ENUM ('PARENT', 'STUDENT');
CREATE TYPE "ProfileViewMode" AS ENUM ('STANDARD', 'KID');

CREATE TABLE "profiles" (
  "id"           TEXT PRIMARY KEY,
  "account_id"   TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "type"         "ProfileType" NOT NULL,
  "display_name" TEXT NOT NULL,
  "avatar_config" JSONB,
  "pin_hash"     TEXT,
  "view_mode"    "ProfileViewMode" NOT NULL DEFAULT 'STANDARD',
  "user_id"      TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "is_owner"     BOOLEAN NOT NULL DEFAULT false,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL
);
CREATE INDEX "profiles_account_id_idx" ON "profiles"("account_id");

-- RLS: tenant-scoped on the app.current_org GUC, exactly like other account_id tables.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_tenant_isolation" ON "profiles"
  USING ("account_id" = current_setting('app.current_org', true))
  WITH CHECK ("account_id" = current_setting('app.current_org', true));
GRANT SELECT, INSERT, UPDATE, DELETE ON "profiles" TO app_user;
```

> Verify the exact `GRANT`/policy form against `00000000000002_rls_policies/migration.sql` and copy it precisely — the goal is a foreign-org `SELECT` returns 0 rows for `app_user`.

- [ ] **Step 3: Apply the migration + regenerate the client**

Run: `npm run db:migrate` (or the project's migrate-deploy step with `DIRECT_DATABASE_URL`), then `npx prisma generate`.
Expected: migration applies; `profiles` table exists; client regenerates with `db.profile`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no usages yet; the model just compiles).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/00000000000010_add_profiles
git commit -m "feat(profiles): add Profile model + tenant RLS policy"
```

---

## Task 3: Link learners to profiles + relax adult-incompatible fields

**Files:**
- Modify: `prisma/schema.prisma` (`model Student`)
- Create: `prisma/migrations/00000000000011_student_profile_link/migration.sql`

- [ ] **Step 1: Edit `model Student`**

Add `profileId String? @unique @map("profile_id")` and a back-relation `profile Profile? @relation(fields: [profileId], references: [id], onDelete: SetNull)`. Change `birthdate DateTime @db.Date` → `birthdate DateTime? @db.Date` and `currentGrade String @map("current_grade")` → `currentGrade String? @map("current_grade")`. (Leave the `Profile.learner Student?` relation from Task 2 — it now resolves.)

- [ ] **Step 2: Write the migration SQL**

Create `prisma/migrations/00000000000011_student_profile_link/migration.sql`:

```sql
ALTER TABLE "students" ADD COLUMN "profile_id" TEXT UNIQUE REFERENCES "profiles"("id") ON DELETE SET NULL;
ALTER TABLE "students" ALTER COLUMN "birthdate" DROP NOT NULL;
ALTER TABLE "students" ALTER COLUMN "current_grade" DROP NOT NULL;
```

- [ ] **Step 3: Apply + regenerate**

Run: `npm run db:migrate` then `npx prisma generate`.
Expected: column added; `db.student` now has `profileId`/`profile`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (nullable changes don't break existing reads; existing writes still pass non-null values).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/00000000000011_student_profile_link
git commit -m "feat(profiles): link Student.profileId + relax adult-incompatible fields"
```

---

## Task 4: The pure backfill mapping (TDD)

**Files:**
- Create: `src/server/profiles/backfill.ts`
- Test: `src/server/profiles/backfill.test.ts`

The mapping is a **pure function** so it's unit-testable with no DB: given the existing users and learners, it returns the profile rows to create, the learner→profile links, and which owner profile gets the copied PIN.

- [ ] **Step 1: Write the failing test**

Create `src/server/profiles/backfill.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildProfileBackfill } from "./backfill";

const ORG = "org-1";

describe("buildProfileBackfill", () => {
  it("makes one PARENT profile per user (owner flagged) and one STUDENT profile per learner, linked", () => {
    const users = [
      { id: "u-owner", name: "Adam", role: "OWNER", organizationId: ORG },
      { id: "u-parent", name: "Bea", role: "PARENT", organizationId: ORG },
    ];
    const learners = [
      { id: "l-sam", organizationId: ORG, firstName: "Sam", preferredName: null, avatarConfig: { a: 1 } },
      { id: "l-mia", organizationId: ORG, firstName: "Mia", preferredName: "Mimi", avatarConfig: null },
    ];

    const r = buildProfileBackfill(users, learners, { ownerPinHashByOrg: { [ORG]: "HASH" } });

    const parents = r.profilesToCreate.filter((p) => p.type === "PARENT");
    const students = r.profilesToCreate.filter((p) => p.type === "STUDENT");
    expect(parents).toHaveLength(2);
    expect(students).toHaveLength(2);

    const owner = parents.find((p) => p.userId === "u-owner");
    expect(owner?.isOwner).toBe(true);
    expect(owner?.pinHash).toBe("HASH"); // PIN copied to the owner profile only
    expect(parents.find((p) => p.userId === "u-parent")?.isOwner).toBe(false);
    expect(parents.find((p) => p.userId === "u-parent")?.pinHash).toBeNull();

    expect(students.find((p) => p.displayName === "Mimi")).toBeTruthy(); // preferredName wins
    expect(students.find((p) => p.displayName === "Sam")).toBeTruthy();

    // every learner is linked to exactly one student profile
    expect(r.learnerLinks).toHaveLength(2);
    const samLink = r.learnerLinks.find((x) => x.learnerId === "l-sam");
    const samProfile = students.find((p) => p.id === samLink?.profileId);
    expect(samProfile?.displayName).toBe("Sam");
  });

  it("is idempotent-safe: skips users/learners that already have a profile", () => {
    const r = buildProfileBackfill(
      [{ id: "u1", name: "X", role: "OWNER", organizationId: ORG }],
      [{ id: "l1", organizationId: ORG, firstName: "Kid", preferredName: null, avatarConfig: null, profileId: "existing" }],
      { ownerPinHashByOrg: {}, existingProfileUserIds: new Set(["u1"]) },
    );
    expect(r.profilesToCreate).toHaveLength(0);
    expect(r.learnerLinks).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/server/profiles/backfill.test.ts`
Expected: FAIL — "Cannot find module './backfill'".

- [ ] **Step 3: Implement the pure mapping**

Create `src/server/profiles/backfill.ts`:

```ts
type UserRow = { id: string; name: string | null; role: string; organizationId: string | null };
type LearnerRow = {
  id: string; organizationId: string; firstName: string;
  preferredName: string | null; avatarConfig: unknown; profileId?: string | null;
};
type Opts = {
  ownerPinHashByOrg: Record<string, string | undefined>;
  existingProfileUserIds?: Set<string>;
};

export type NewProfile = {
  id: string; organizationId: string; type: "PARENT" | "STUDENT";
  displayName: string; avatarConfig: unknown; pinHash: string | null;
  userId: string | null; isOwner: boolean;
};
export type LearnerLink = { learnerId: string; profileId: string };
export type Backfill = { profilesToCreate: NewProfile[]; learnerLinks: LearnerLink[] };

// Deterministic id from a stable seed so re-runs map to the same profile (no Math.random/Date).
const pid = (seed: string) => `profile-${seed}`;

export function buildProfileBackfill(users: UserRow[], learners: LearnerRow[], opts: Opts): Backfill {
  const existing = opts.existingProfileUserIds ?? new Set<string>();
  const profilesToCreate: NewProfile[] = [];
  const learnerLinks: LearnerLink[] = [];

  for (const u of users) {
    if (!u.organizationId || existing.has(u.id)) continue;
    const isOwner = u.role === "OWNER";
    profilesToCreate.push({
      id: pid(`user-${u.id}`),
      organizationId: u.organizationId,
      type: "PARENT",
      displayName: u.name ?? "Parent",
      avatarConfig: null,
      pinHash: isOwner ? (opts.ownerPinHashByOrg[u.organizationId] ?? null) : null,
      userId: u.id,
      isOwner,
    });
  }

  for (const l of learners) {
    if (l.profileId) continue; // already linked
    const profileId = pid(`learner-${l.id}`);
    profilesToCreate.push({
      id: profileId,
      organizationId: l.organizationId,
      type: "STUDENT",
      displayName: l.preferredName ?? l.firstName,
      avatarConfig: l.avatarConfig ?? null,
      pinHash: null,
      userId: null,
      isOwner: false,
    });
    learnerLinks.push({ learnerId: l.id, profileId });
  }

  return { profilesToCreate, learnerLinks };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/server/profiles/backfill.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add src/server/profiles/backfill.ts src/server/profiles/backfill.test.ts
git commit -m "feat(profiles): pure backfill mapping (users->PARENT, learners->STUDENT) with tests"
```

---

## Task 5: Run the backfill against the database

**Files:**
- Create: `scripts/backfill-profiles.ts`

This thin runner reads the org's existing PIN (from `ClassroomInstructor`, which we are NOT dropping yet), calls the pure mapping, and writes inside `withTenant`/a transaction so RLS GUCs are set per org.

- [ ] **Step 1: Write the runner**

Create `scripts/backfill-profiles.ts`:

```ts
import { db, withTenant } from "@/server/db";
import { buildProfileBackfill } from "@/server/profiles/backfill";

async function main() {
  const orgs = await db.organization.findMany({ select: { id: true } });
  let createdProfiles = 0, linkedLearners = 0;

  for (const { id: organizationId } of orgs) {
    await withTenant(async (tx) => {
      const users = await tx.user.findMany({ where: { organizationId }, select: { id: true, name: true, role: true, organizationId: true } });
      const learners = await tx.student.findMany({ where: { organizationId }, select: { id: true, organizationId: true, firstName: true, preferredName: true, avatarConfig: true, profileId: true } });
      const existingProfileUserIds = new Set((await tx.profile.findMany({ where: { organizationId, userId: { not: null } }, select: { userId: true } })).map((p) => p.userId!));

      // One classroom PIN hash per org (same hash on every instructor row): take the first.
      const firstInstructor = await tx.classroomInstructor.findFirst({ where: { classroom: { organizationId } }, select: { instructorPin: true } });
      const ownerPinHashByOrg = { [organizationId]: firstInstructor?.instructorPin };

      const { profilesToCreate, learnerLinks } = buildProfileBackfill(users, learners as any, { ownerPinHashByOrg, existingProfileUserIds });

      for (const p of profilesToCreate) {
        await tx.profile.create({ data: { id: p.id, organizationId: p.organizationId, type: p.type as any, displayName: p.displayName, avatarConfig: p.avatarConfig as any, pinHash: p.pinHash, viewMode: "STANDARD", userId: p.userId, isOwner: p.isOwner } });
      }
      for (const link of learnerLinks) {
        await tx.student.update({ where: { id: link.learnerId }, data: { profileId: link.profileId } });
      }
      createdProfiles += profilesToCreate.length;
      linkedLearners += learnerLinks.length;
    }, undefined, { organizationId, userId: null });
  }

  console.log(`Backfill done: ${createdProfiles} profiles created, ${linkedLearners} learners linked.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it**

Run: `npx tsx scripts/backfill-profiles.ts`
Expected: prints created/linked counts (for the single live account: 1 PARENT owner profile + N STUDENT profiles, N learners linked).

- [ ] **Step 3: Verify invariants in the DB**

Run a read (via `npx tsx` or Prisma Studio) and confirm:
- every `User` with an org has exactly one PARENT profile (owner flagged for OWNER, PIN copied);
- every `students` row has a non-null `profile_id` pointing at a STUDENT profile;
- re-running the script creates 0 new profiles (idempotent).

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-profiles.ts
git commit -m "feat(profiles): backfill runner (profiles + learner links + copy owner PIN)"
```

---

## Self-Review

- **Spec coverage (Slice 1a portion of §3–4):** Profile model ✓ (Task 2), enums ✓ (Task 2), `Learner.profileId` + optional adult fields ✓ (Task 3, on `Student` pre-rename), backfill of PARENT/STUDENT profiles + PIN copy ✓ (Tasks 4–5), profiles RLS policy ✓ (Task 2). **Deferred (documented):** table rename → Slice 1b; `instructorPin` drop + onboarding rewrite + HYG-12 → Slice 5; session/picker/authz/PIN-verify → Slices 2–5.
- **Placeholder scan:** none — every code/SQL/command step is concrete.
- **Type consistency:** `buildProfileBackfill` signature, `NewProfile`/`LearnerLink` shapes, and the `pid()` deterministic ids match between the test (Task 4 Step 1), the implementation (Step 3), and the runner (Task 5). The runner reads `Student.profileId` added in Task 3.
- **Determinism:** ids derive from stable seeds (no `Math.random`/`Date`) so the backfill is idempotent and re-runnable.
- **RLS gotcha called out:** new tenant table needs its policy in the same migration or `app_user` reads 0 rows (Task 2 Step 2).
