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
