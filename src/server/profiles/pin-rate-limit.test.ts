import { describe, it, expect, beforeEach } from "vitest";
import { checkPinRateLimit, recordPinFailure, clearPinAttempts } from "./pin-rate-limit";

const KEY = "u1:p1";
const T0 = 1_700_000_000_000;

beforeEach(() => clearPinAttempts(KEY));

describe("pin rate limit", () => {
  it("allows up to 5 failures, then locks within the 30s window", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkPinRateLimit(KEY, T0).allowed).toBe(true);
      recordPinFailure(KEY, T0);
    }
    const gate = checkPinRateLimit(KEY, T0 + 1000);
    expect(gate.allowed).toBe(false);
    expect(gate.retryAfterMs).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    for (let i = 0; i < 5; i++) recordPinFailure(KEY, T0);
    expect(checkPinRateLimit(KEY, T0 + 31_000).allowed).toBe(true);
  });

  it("clearPinAttempts unlocks immediately (used on success)", () => {
    for (let i = 0; i < 5; i++) recordPinFailure(KEY, T0);
    clearPinAttempts(KEY);
    expect(checkPinRateLimit(KEY, T0 + 1000).allowed).toBe(true);
  });
});
