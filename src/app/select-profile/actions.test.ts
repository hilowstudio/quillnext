import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const getCurrentUserOrg = vi.fn();
const withTenant = vi.fn();
const setActiveProfile = vi.fn();
const clearActiveProfile = vi.fn();
const checkProfilePinThrottle = vi.fn();
const recordProfilePinFailure = vi.fn();
const clearProfilePinThrottle = vi.fn();
const redirect = vi.fn((_: string) => { throw new Error("REDIRECT"); });

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-helpers", () => ({ getCurrentUserOrg: () => getCurrentUserOrg() }));
vi.mock("@/server/db", () => ({ withTenant: (...a: unknown[]) => withTenant(...a) }));
vi.mock("@/server/profiles/active-profile", () => ({
  setActiveProfile: (...a: unknown[]) => setActiveProfile(...a),
  clearActiveProfile: (...a: unknown[]) => clearActiveProfile(...a),
}));
vi.mock("@/server/profiles/pin-throttle", () => ({
  checkProfilePinThrottle: (...a: unknown[]) => checkProfilePinThrottle(...a),
  recordProfilePinFailure: (...a: unknown[]) => recordProfilePinFailure(...a),
  clearProfilePinThrottle: (...a: unknown[]) => clearProfilePinThrottle(...a),
}));
vi.mock("next/navigation", () => ({ redirect: (p: string) => redirect(p) }));

import { selectProfile, enterAssessment } from "./actions";

const CTX = { userId: "u1", organizationId: "o1" };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserOrg.mockResolvedValue(CTX);
  checkProfilePinThrottle.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

describe("selectProfile", () => {
  it("rejects a profile in a different org without setting a cookie", async () => {
    withTenant.mockResolvedValue({ id: "p1", organizationId: "other", type: "PARENT", pinHash: null });
    const res = await selectProfile("p1");
    expect(res).toEqual({ ok: false, error: "Profile not found." });
    expect(setActiveProfile).not.toHaveBeenCalled();
  });

  it("selects a no-PIN profile and redirects to /", async () => {
    withTenant.mockResolvedValue({ id: "p2", organizationId: "o1", type: "STUDENT", pinHash: null });
    await expect(selectProfile("p2")).rejects.toThrow("REDIRECT");
    expect(setActiveProfile).toHaveBeenCalledWith({ profileId: "p2", type: "STUDENT" });
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("rejects a wrong PIN and does not set a cookie", async () => {
    const hash = await bcrypt.hash("1234", 10);
    withTenant.mockResolvedValue({ id: "p1", organizationId: "o1", type: "PARENT", pinHash: hash });
    const res = await selectProfile("p1", "0000");
    expect(res).toEqual({ ok: false, error: "Incorrect PIN." });
    expect(setActiveProfile).not.toHaveBeenCalled();
  });

  it("accepts the correct PIN and redirects", async () => {
    const hash = await bcrypt.hash("1234", 10);
    withTenant.mockResolvedValue({ id: "p1", organizationId: "o1", type: "PARENT", pinHash: hash });
    await expect(selectProfile("p1", "1234")).rejects.toThrow("REDIRECT");
    expect(setActiveProfile).toHaveBeenCalledWith({ profileId: "p1", type: "PARENT" });
  });

  it("blocks when the durable throttle is locked out", async () => {
    const hash = await bcrypt.hash("1234", 10);
    withTenant.mockResolvedValue({ id: "p1", organizationId: "o1", type: "PARENT", pinHash: hash });
    checkProfilePinThrottle.mockResolvedValue({ allowed: false, retryAfterMs: 12_000 });
    const res = await selectProfile("p1", "0000");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/Too many attempts/);
    expect(recordProfilePinFailure).not.toHaveBeenCalled(); // gated before the bcrypt check
    expect(setActiveProfile).not.toHaveBeenCalled();
  });
});

describe("enterAssessment", () => {
  it("rejects a non-id-charset studentId before any DB read", async () => {
    const res = await enterAssessment("../etc/passwd");
    expect(res).toEqual({ ok: false, error: "Invalid student." });
    expect(withTenant).not.toHaveBeenCalled();
    expect(setActiveProfile).not.toHaveBeenCalled();
  });

  it("rejects a well-formed id that is not a learner in the caller's org (Q-05-004)", async () => {
    withTenant.mockResolvedValueOnce(null); // learner existence check → not found
    const res = await enterAssessment("not-a-real-learner");
    expect(res).toEqual({ ok: false, error: "Invalid student." });
    expect(setActiveProfile).not.toHaveBeenCalled();
  });

  it("becomes the owner PARENT and redirects when the learner exists in-org", async () => {
    withTenant
      .mockResolvedValueOnce({ id: "s1" }) // learner existence check → found
      .mockResolvedValueOnce({ id: "owner1", pinHash: null }); // owner lookup (no PIN)
    await expect(enterAssessment("s1")).rejects.toThrow("REDIRECT");
    expect(setActiveProfile).toHaveBeenCalledWith({ profileId: "owner1", type: "PARENT" });
    expect(redirect).toHaveBeenCalledWith("/students/s1/assessment");
  });
});
