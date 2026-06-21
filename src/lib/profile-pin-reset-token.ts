import { SignJWT, jwtVerify } from "jose";

/**
 * Short-lived, single-purpose token that authorizes clearing ONE owner PARENT profile's PIN.
 * Prisma-free (mirrors `active-profile-cookie.ts`) so it can be imported anywhere, including the
 * reset page. Bound to a login + org + the specific profile so a leaked link only works for the
 * session it was issued to.
 */
export type PinResetClaims = { uid: string; org: string; profileId: string };

/** Reset links expire quickly — possession of the owner's inbox is the out-of-band factor. */
export const PIN_RESET_TTL_SECONDS = 15 * 60;

const PURPOSE = "profile-pin-reset";

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Sign an HS256 JWS reset token. `now` (ms) is injected so issued-at/expiry are deterministic in tests. */
export async function signPinResetToken(
  claims: PinResetClaims,
  secret: string,
  now: number,
): Promise<string> {
  const iat = Math.floor(now / 1000);
  return new SignJWT({ uid: claims.uid, org: claims.org, profileId: claims.profileId, purpose: PURPOSE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + PIN_RESET_TTL_SECONDS)
    .sign(key(secret));
}

/** Verify signature + purpose + expiry. Returns null on ANY failure (fail-closed). */
export async function verifyPinResetToken(
  token: string,
  secret: string,
  now: number,
): Promise<PinResetClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      currentDate: new Date(now),
    });
    const { uid, org, profileId, purpose } = payload as Record<string, unknown>;
    if (purpose !== PURPOSE) return null;
    if (typeof uid !== "string" || typeof org !== "string" || typeof profileId !== "string") return null;
    return { uid, org, profileId };
  } catch {
    return null; // bad signature, malformed, expired, etc.
  }
}
