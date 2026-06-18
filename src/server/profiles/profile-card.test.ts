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
