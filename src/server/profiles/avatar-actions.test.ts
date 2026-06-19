import { describe, it, expect, vi, beforeEach } from "vitest";

const getCurrentUserOrg = vi.fn();
const withTenant = vi.fn();
const verifyProfilePin = vi.fn();

vi.mock("@/lib/auth-helpers", () => ({ getCurrentUserOrg: () => getCurrentUserOrg() }));
vi.mock("@/server/db", () => ({ withTenant: (...a: unknown[]) => withTenant(...a) }));
vi.mock("@/server/profiles/pin-actions", () => ({ verifyProfilePin: (...a: unknown[]) => verifyProfilePin(...a) }));

import { setProfileAvatar } from "./avatar-actions";

const CTX = { userId: "u1", organizationId: "o1" };
const CONFIG = { seed: "x", hair: ["variant01"] };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserOrg.mockResolvedValue(CTX);
});

describe("setProfileAvatar", () => {
  it("rejects a profile in a different org", async () => {
    withTenant.mockResolvedValueOnce({ id: "p1", organizationId: "other", pinHash: null, learner: null });
    expect(await setProfileAvatar("p1", CONFIG)).toEqual({ ok: false, error: "Profile not found." });
    expect(withTenant).toHaveBeenCalledTimes(1); // only the lookup
  });

  it("updates a no-PIN profile without verifying a PIN", async () => {
    withTenant
      .mockResolvedValueOnce({ id: "p1", organizationId: "o1", pinHash: null, learner: { id: "l1" } })
      .mockResolvedValueOnce(undefined);
    expect(await setProfileAvatar("p1", CONFIG)).toEqual({ ok: true });
    expect(verifyProfilePin).not.toHaveBeenCalled();
    expect(withTenant).toHaveBeenCalledTimes(2); // lookup + update
  });

  it("rejects a wrong PIN on a protected profile and does not update", async () => {
    withTenant.mockResolvedValueOnce({ id: "p1", organizationId: "o1", pinHash: "hash", learner: null });
    verifyProfilePin.mockResolvedValue({ ok: false, error: "Incorrect PIN." });
    expect(await setProfileAvatar("p1", CONFIG, "0000")).toEqual({ ok: false, error: "Incorrect PIN." });
    expect(withTenant).toHaveBeenCalledTimes(1); // lookup only; no update
  });

  it("updates a protected profile when the PIN verifies", async () => {
    withTenant
      .mockResolvedValueOnce({ id: "p1", organizationId: "o1", pinHash: "hash", learner: { id: "l1" } })
      .mockResolvedValueOnce(undefined);
    verifyProfilePin.mockResolvedValue({ ok: true });
    expect(await setProfileAvatar("p1", CONFIG, "1234")).toEqual({ ok: true });
    expect(verifyProfilePin).toHaveBeenCalledWith("p1", "1234");
    expect(withTenant).toHaveBeenCalledTimes(2);
  });
});
