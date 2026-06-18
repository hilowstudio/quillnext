import { describe, it, expect } from "vitest";
import {
  signActiveProfile,
  verifyActiveProfile,
  idleTtlMs,
  type ActiveProfilePayload,
} from "./active-profile-cookie";

// jose HS256 requires a key >= 256 bits (32 bytes). Real AUTH_SECRET is >= 32 bytes.
const SECRET = "test-secret-0123456789-abcdefghij-KLMNOP";
const OTHER_SECRET = "different-secret-0123456789-abcdefghij-XY";
const T0 = 1_700_000_000_000; // a whole-second epoch (ms), so iat round-trips exactly
const MIN = 60 * 1000;

const parent: ActiveProfilePayload = { profileId: "p1", type: "PARENT", uid: "u1", org: "o1" };
const student: ActiveProfilePayload = { profileId: "p2", type: "STUDENT", uid: "u1", org: "o1" };

describe("signActiveProfile / verifyActiveProfile", () => {
  it("round-trips a payload signed and verified at the same instant", async () => {
    const token = await signActiveProfile(parent, SECRET, T0);
    const out = await verifyActiveProfile(token, SECRET, T0);
    expect(out).toMatchObject({ profileId: "p1", type: "PARENT", uid: "u1", org: "o1" });
    expect(out?.iat).toBe(T0 / 1000);
  });

  it("rejects a token signed with a different secret (forged)", async () => {
    const token = await signActiveProfile(parent, SECRET, T0);
    expect(await verifyActiveProfile(token, OTHER_SECRET, T0)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signActiveProfile(parent, SECRET, T0);
    // Flip a character in the payload segment.
    const [h, p, s] = token.split(".");
    const tampered = `${h}.${p.slice(0, -1)}${p.endsWith("A") ? "B" : "A"}.${s}`;
    expect(await verifyActiveProfile(tampered, SECRET, T0)).toBeNull();
  });

  it("rejects garbage that is not a JWS", async () => {
    expect(await verifyActiveProfile("not-a-token", SECRET, T0)).toBeNull();
    expect(await verifyActiveProfile("", SECRET, T0)).toBeNull();
  });

  it("rejects an unknown profile type (fail-closed)", async () => {
    const bogus = { ...parent, type: "ADMIN" } as unknown as ActiveProfilePayload;
    const token = await signActiveProfile(bogus, SECRET, T0);
    expect(await verifyActiveProfile(token, SECRET, T0)).toBeNull();
  });

  it("PARENT: valid before the 15-min idle window, null after", async () => {
    const token = await signActiveProfile(parent, SECRET, T0);
    expect(await verifyActiveProfile(token, SECRET, T0 + 14 * MIN)).not.toBeNull();
    expect(await verifyActiveProfile(token, SECRET, T0 + 16 * MIN)).toBeNull();
  });

  it("STUDENT: persists far beyond the PARENT window", async () => {
    const token = await signActiveProfile(student, SECRET, T0);
    const hundredDays = 100 * 24 * 60 * MIN;
    expect(await verifyActiveProfile(token, SECRET, T0 + hundredDays)).not.toBeNull();
  });
});

describe("idleTtlMs", () => {
  it("PARENT idles at 15 minutes; STUDENT never idles", () => {
    expect(idleTtlMs("PARENT")).toBe(15 * MIN);
    expect(idleTtlMs("STUDENT")).toBe(Number.POSITIVE_INFINITY);
  });
});
