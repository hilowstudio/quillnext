import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const assertParentProfile = vi.fn();
const getCurrentUserOrg = vi.fn();
const withTenant = vi.fn();
const checkProfilePinThrottle = vi.fn();
const recordProfilePinFailure = vi.fn();
const clearProfilePinThrottle = vi.fn();

vi.mock("@/server/profiles/guards", () => ({ assertParentProfile: () => assertParentProfile() }));
vi.mock("@/lib/auth-helpers", () => ({ getCurrentUserOrg: () => getCurrentUserOrg() }));
vi.mock("@/server/db", () => ({ withTenant: (...a: unknown[]) => withTenant(...a) }));
vi.mock("@/server/profiles/pin-throttle", () => ({
  checkProfilePinThrottle: (...a: unknown[]) => checkProfilePinThrottle(...a),
  recordProfilePinFailure: (...a: unknown[]) => recordProfilePinFailure(...a),
  clearProfilePinThrottle: (...a: unknown[]) => clearProfilePinThrottle(...a),
}));

import { setProfilePin, removeProfilePin, verifyProfilePin } from "./pin-actions";

const CTX = { userId: "u1", organizationId: "o1" };

beforeEach(() => {
  vi.clearAllMocks();
  assertParentProfile.mockResolvedValue(undefined);
  getCurrentUserOrg.mockResolvedValue(CTX);
  checkProfilePinThrottle.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
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

describe("verifyProfilePin", () => {
  it("returns ok for a profile with no PIN (nothing to verify)", async () => {
    withTenant.mockResolvedValue({ id: "p1", organizationId: "o1", pinHash: null });
    expect(await verifyProfilePin("p1", "")).toEqual({ ok: true });
    expect(checkProfilePinThrottle).not.toHaveBeenCalled();
  });

  it("rejects a wrong PIN and records the failure", async () => {
    const hash = await bcrypt.hash("1234", 10);
    withTenant.mockResolvedValue({ id: "p1", organizationId: "o1", pinHash: hash });
    expect(await verifyProfilePin("p1", "0000")).toEqual({ ok: false, error: "Incorrect PIN." });
    expect(recordProfilePinFailure).toHaveBeenCalled();
    expect(clearProfilePinThrottle).not.toHaveBeenCalled();
  });

  it("accepts the correct PIN and clears the throttle", async () => {
    const hash = await bcrypt.hash("1234", 10);
    withTenant.mockResolvedValue({ id: "p1", organizationId: "o1", pinHash: hash });
    expect(await verifyProfilePin("p1", "1234")).toEqual({ ok: true });
    expect(clearProfilePinThrottle).toHaveBeenCalled();
  });

  it("blocks when the throttle is locked out", async () => {
    const hash = await bcrypt.hash("1234", 10);
    withTenant.mockResolvedValue({ id: "p1", organizationId: "o1", pinHash: hash });
    checkProfilePinThrottle.mockResolvedValue({ allowed: false, retryAfterMs: 9000 });
    const res = await verifyProfilePin("p1", "1234");
    expect(res.ok).toBe(false);
    expect((res as { ok: false; error: string }).error).toMatch(/Too many attempts/);
  });

  it("rejects a profile in a different org", async () => {
    withTenant.mockResolvedValue({ id: "p1", organizationId: "other", pinHash: null });
    expect(await verifyProfilePin("p1", "")).toEqual({ ok: false, error: "Profile not found." });
  });
});
