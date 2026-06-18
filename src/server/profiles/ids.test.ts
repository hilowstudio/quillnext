import { describe, it, expect } from "vitest";
import { parentProfileId, studentProfileId } from "./ids";

describe("deterministic profile ids", () => {
  it("match the backfill convention exactly", () => {
    expect(parentProfileId("u1")).toBe("profile-user-u1");
    expect(studentProfileId("l1")).toBe("profile-learner-l1");
  });
});
