import { describe, it, expect, vi, beforeEach } from "vitest";

const assertParentProfile = vi.fn();
const getCurrentUserOrg = vi.fn();
const withTenant = vi.fn();

vi.mock("@/server/profiles/guards", () => ({ assertParentProfile: () => assertParentProfile() }));
vi.mock("@/lib/auth-helpers", () => ({ getCurrentUserOrg: () => getCurrentUserOrg() }));
vi.mock("@/server/db", () => ({ withTenant: (...a: unknown[]) => withTenant(...a) }));

import { setProfilePin, removeProfilePin } from "./pin-actions";

const CTX = { userId: "u1", organizationId: "o1" };

beforeEach(() => {
  vi.clearAllMocks();
  assertParentProfile.mockResolvedValue(undefined);
  getCurrentUserOrg.mockResolvedValue(CTX);
});

describe("setProfilePin", () => {
  it("requires a PARENT active profile (throws when the guard throws)", async () => {
    assertParentProfile.mockRejectedValue(new Error("This action requires a parent profile."));
    await expect(setProfilePin("p1", "1234")).rejects.toThrow(/parent profile/i);
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("rejects a non-4-digit PIN without touching the DB", async () => {
    const res = await setProfilePin("p1", "12");
    expect(res).toEqual({ ok: false, error: "PIN must be exactly 4 digits." });
    expect(withTenant).not.toHaveBeenCalled();
  });

  it("rejects a profile in a different org", async () => {
    withTenant.mockResolvedValue({ id: "p1", organizationId: "other" });
    const res = await setProfilePin("p1", "1234");
    expect(res).toEqual({ ok: false, error: "Profile not found." });
  });

  it("sets the PIN on a valid in-org profile", async () => {
    withTenant.mockResolvedValueOnce({ id: "p1", organizationId: "o1" }).mockResolvedValueOnce(undefined);
    const res = await setProfilePin("p1", "1234");
    expect(res).toEqual({ ok: true });
    expect(assertParentProfile).toHaveBeenCalled();
    expect(withTenant).toHaveBeenCalledTimes(2); // lookup + update
  });
});

describe("removeProfilePin", () => {
  it("requires a PARENT active profile", async () => {
    assertParentProfile.mockRejectedValue(new Error("This action requires a parent profile."));
    await expect(removeProfilePin("p1")).rejects.toThrow(/parent profile/i);
  });

  it("removes the PIN on a valid in-org profile", async () => {
    withTenant.mockResolvedValueOnce({ id: "p1", organizationId: "o1" }).mockResolvedValueOnce(undefined);
    const res = await removeProfilePin("p1");
    expect(res).toEqual({ ok: true });
  });
});
