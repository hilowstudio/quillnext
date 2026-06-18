import { describe, it, expect, vi, beforeEach } from "vitest";

const getActiveProfile = vi.fn();
vi.mock("server-only", () => ({}));
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
