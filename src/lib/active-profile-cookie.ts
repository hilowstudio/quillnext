import { SignJWT, jwtVerify } from "jose";

/** Profile types, kept as a local string-literal union so this module stays Prisma-free
 *  (it must be importable by the edge proxy). Values match the Prisma `ProfileType` enum. */
export type ProfileType = "PARENT" | "STUDENT";

/** Claims we put in the signed cookie. `uid`/`org` bind it to the login + tenant. */
export type ActiveProfilePayload = {
  profileId: string;
  type: ProfileType;
  uid: string; // the User.id this cookie was issued to
  org: string; // the Organization.id this cookie was issued under
};

/** What a successful verify returns: the payload plus the issued-at (seconds). */
export type ActiveProfileToken = ActiveProfilePayload & { iat: number };

const PARENT_IDLE_MS = 15 * 60 * 1000;

/** Per-type idle window. PARENT re-prompts after 15 min idle; STUDENT persists. */
export function idleTtlMs(type: ProfileType): number {
  return type === "PARENT" ? PARENT_IDLE_MS : Number.POSITIVE_INFINITY;
}

function isProfileType(v: unknown): v is ProfileType {
  return v === "PARENT" || v === "STUDENT";
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Sign an HS256 JWS. `now` (ms) is injected so issued-at is deterministic in tests. */
export async function signActiveProfile(
  payload: ActiveProfilePayload,
  secret: string,
  now: number,
): Promise<string> {
  return new SignJWT({
    profileId: payload.profileId,
    type: payload.type,
    uid: payload.uid,
    org: payload.org,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(now / 1000))
    .sign(key(secret));
}

/** Verify signature + per-type idle window. Returns null on ANY failure (fail-closed). */
export async function verifyActiveProfile(
  token: string,
  secret: string,
  now: number,
): Promise<ActiveProfileToken | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    const { profileId, type, uid, org, iat } = payload as Record<string, unknown>;
    if (typeof profileId !== "string" || typeof uid !== "string" || typeof org !== "string") return null;
    if (!isProfileType(type)) return null;
    if (typeof iat !== "number") return null;
    if (now - iat * 1000 > idleTtlMs(type)) return null; // idle-expired
    return { profileId, type, uid, org, iat };
  } catch {
    return null; // bad signature, malformed token, etc.
  }
}

const isProd = process.env.NODE_ENV === "production";

/** Cookie name — `__Secure-`-prefixed in prod only (mirrors the auth.js pkce cookie). */
export const ACTIVE_PROFILE_COOKIE = `${isProd ? "__Secure-" : ""}active_profile`;

/** Base cookie attributes, matching the session-cookie conventions in src/auth.ts. */
export function activeProfileCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: isProd,
    domain: isProd ? ".quillandcompass.app" : undefined,
    path: "/" as const,
  };
}
