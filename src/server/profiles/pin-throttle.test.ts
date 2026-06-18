import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({ withTenant: vi.fn() }));

import { evaluateThrottle, nextStateOnFailure } from "./pin-throttle";

const T0 = 1_700_000_000_000;
const MIN = 60_000;

describe("evaluateThrottle", () => {
  it("allows when under the limit", () => {
    expect(evaluateThrottle({ pinFailedCount: 4, pinWindowStart: new Date(T0) }, T0 + 1000).allowed).toBe(true);
  });
  it("blocks at 5 failures within the 30s window", () => {
    const r = evaluateThrottle({ pinFailedCount: 5, pinWindowStart: new Date(T0) }, T0 + 1000);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });
  it("allows once the window has elapsed", () => {
    expect(evaluateThrottle({ pinFailedCount: 5, pinWindowStart: new Date(T0) }, T0 + 31_000).allowed).toBe(true);
  });
  it("allows when never attempted", () => {
    expect(evaluateThrottle({ pinFailedCount: 0, pinWindowStart: null }, T0).allowed).toBe(true);
  });
});

describe("nextStateOnFailure", () => {
  it("starts a fresh window", () => {
    expect(nextStateOnFailure({ pinFailedCount: 0, pinWindowStart: null }, T0)).toEqual({
      pinFailedCount: 1,
      pinWindowStart: new Date(T0),
    });
  });
  it("increments within the window", () => {
    expect(nextStateOnFailure({ pinFailedCount: 2, pinWindowStart: new Date(T0) }, T0 + MIN / 2)).toEqual({
      pinFailedCount: 3,
      pinWindowStart: new Date(T0),
    });
  });
  it("resets the window after it elapses", () => {
    expect(nextStateOnFailure({ pinFailedCount: 5, pinWindowStart: new Date(T0) }, T0 + 31_000)).toEqual({
      pinFailedCount: 1,
      pinWindowStart: new Date(T0 + 31_000),
    });
  });
});
