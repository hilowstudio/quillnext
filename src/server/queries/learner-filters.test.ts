import { describe, it, expect } from "vitest";
import { excludeParentLearners } from "./learner-filters";

/**
 * The exact shape of this fragment is load-bearing (Q-05-006). It MUST be `NOT: { profile: { is:
 * { type: "PARENT" } } }` and NOT the naive `profile: { is: { type: "STUDENT" } }`:
 *  - excludes learners whose linked profile is PARENT (the My-Learning parent-as-learner row),
 *  - preserves learners with a STUDENT profile,
 *  - preserves learners with NO linked profile (pre-backfill / unlinked students) — which an
 *    IS-STUDENT predicate would silently drop.
 * This test fails if someone "simplifies" the predicate in a way that re-breaks null-profile rows.
 */
describe("excludeParentLearners", () => {
  it("negates a PARENT-profile relation match (not an IS-STUDENT filter)", () => {
    expect(excludeParentLearners).toEqual({ NOT: { profile: { is: { type: "PARENT" } } } });
  });
});
