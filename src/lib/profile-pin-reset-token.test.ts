import { describe, it, expect } from "vitest";
import { signPinResetToken, verifyPinResetToken, PIN_RESET_TTL_SECONDS } from "./profile-pin-reset-token";

const SECRET = "test-secret-0123456789-abcdefghij-KLMNOP";
const CLAIMS = { uid: "u1", org: "o1", profileId: "p1" };
const NOW = 1_700_000_000_000; // fixed, ms (divides evenly by 1000)

describe("profile-pin-reset-token", () => {
  it("round-trips the claims for a fresh token", async () => {
    const token = await signPinResetToken(CLAIMS, SECRET, NOW);
    expect(await verifyPinResetToken(token, SECRET, NOW)).toEqual(CLAIMS);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signPinResetToken(CLAIMS, SECRET, NOW);
    expect(await verifyPinResetToken(token, "a-totally-different-secret-aaaaaaaaaa", NOW)).toBeNull();
  });

  it("rejects an expired token (past the 15-minute TTL)", async () => {
    const token = await signPinResetToken(CLAIMS, SECRET, NOW);
    const later = NOW + (PIN_RESET_TTL_SECONDS + 2) * 1000;
    expect(await verifyPinResetToken(token, SECRET, later)).toBeNull();
  });

  it("still accepts a token just inside the TTL", async () => {
    const token = await signPinResetToken(CLAIMS, SECRET, NOW);
    const justInside = NOW + (PIN_RESET_TTL_SECONDS - 5) * 1000;
    expect(await verifyPinResetToken(token, SECRET, justInside)).toEqual(CLAIMS);
  });

  it("rejects an empty or malformed token (fail-closed)", async () => {
    expect(await verifyPinResetToken("", SECRET, NOW)).toBeNull();
    expect(await verifyPinResetToken("not.a.jwt", SECRET, NOW)).toBeNull();
  });
});
