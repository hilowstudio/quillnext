import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

const checkProfilePinThrottle = vi.fn();
const recordProfilePinFailure = vi.fn();
const clearProfilePinThrottle = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/server/profiles/pin-throttle", () => ({
  checkProfilePinThrottle: (...a: unknown[]) => checkProfilePinThrottle(...a),
  recordProfilePinFailure: (...a: unknown[]) => recordProfilePinFailure(...a),
  clearProfilePinThrottle: (...a: unknown[]) => clearProfilePinThrottle(...a),
}));

import { verifyPinWithThrottle } from "./pin-verify";

beforeEach(() => {
  vi.clearAllMocks();
  checkProfilePinThrottle.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
});

describe("verifyPinWithThrottle", () => {
  it("returns ok for a profile with no PIN, doing no throttle or bcrypt work", async () => {
    expect(await verifyPinWithThrottle("p1", "o1", null, undefined)).toEqual({ ok: true });
    expect(checkProfilePinThrottle).not.toHaveBeenCalled();
    expect(recordProfilePinFailure).not.toHaveBeenCalled();
  });

  it("blocks before any shape/bcrypt work when the throttle is locked out", async () => {
    const hash = await bcrypt.hash("1234", 10);
    checkProfilePinThrottle.mockResolvedValue({ allowed: false, retryAfterMs: 9000 });
    const res = await verifyPinWithThrottle("p1", "o1", hash, "1234");
    expect(res.ok).toBe(false);
    expect((res as { ok: false; error: string }).error).toMatch(/Too many attempts/);
    expect(recordProfilePinFailure).not.toHaveBeenCalled();
  });

  it("rejects a malformed/oversized/undefined PIN server-side, without bcrypt, still recording the failure (Q-05-002)", async () => {
    const hash = await bcrypt.hash("1234", 10);
    const compareSpy = vi.spyOn(bcrypt, "compare");
    for (const bad of [undefined, "", "12", "12345", "abcd", "12a4"] as (string | undefined)[]) {
      recordProfilePinFailure.mockClear();
      compareSpy.mockClear();
      const res = await verifyPinWithThrottle("p1", "o1", hash, bad);
      expect(res).toEqual({ ok: false, error: "Incorrect PIN." });
      expect(recordProfilePinFailure).toHaveBeenCalledTimes(1);
      expect(compareSpy).not.toHaveBeenCalled();
    }
    compareSpy.mockRestore();
  });

  it("records a failure and returns Incorrect PIN for a wrong 4-digit PIN", async () => {
    const hash = await bcrypt.hash("1234", 10);
    const res = await verifyPinWithThrottle("p1", "o1", hash, "0000");
    expect(res).toEqual({ ok: false, error: "Incorrect PIN." });
    expect(recordProfilePinFailure).toHaveBeenCalledTimes(1);
    expect(clearProfilePinThrottle).not.toHaveBeenCalled();
  });

  it("clears the throttle and returns ok for the correct PIN", async () => {
    const hash = await bcrypt.hash("1234", 10);
    const res = await verifyPinWithThrottle("p1", "o1", hash, "1234");
    expect(res).toEqual({ ok: true });
    expect(clearProfilePinThrottle).toHaveBeenCalledTimes(1);
    expect(recordProfilePinFailure).not.toHaveBeenCalled();
  });
});
