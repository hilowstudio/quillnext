import "server-only";
import bcrypt from "bcryptjs";
import { pinSchema } from "@/lib/schemas/pin";
import {
  checkProfilePinThrottle,
  recordProfilePinFailure,
  clearProfilePinThrottle,
} from "@/server/profiles/pin-throttle";

export type PinVerifyResult = { ok: true } | { ok: false; error: string };

/**
 * Verify a 4-digit PIN against an ALREADY-FETCHED hash, with server-side shape validation and the
 * durable per-profile throttle. This is the single source of truth for the
 * throttle -> shape -> bcrypt.compare -> record/clear sequence that was previously copied verbatim
 * in three places (`verifyProfilePin`, `selectProfile`, `enterAsOwnerParent` — Q-05-003), and the
 * only place the verify paths enforce the 4-digit shape server-side (Q-05-002).
 *
 * Callers fetch the profile (for the org-match / existence check they already do) and pass its
 * `pinHash` in — shape (b): no second DB fetch.
 *
 * The order is deliberate and behavior-preserving against the previous inline copies:
 *   1. `pinHash === null` -> ok (nothing to verify; a no-PIN profile is open — matches all 3 callers).
 *   2. throttle gate FIRST -> a locked-out caller still gets the correct "Too many attempts" signal.
 *   3. shape check -> a non-4-digit PIN records a throttle failure (same accounting as the old
 *      `pin ? compare : false` path) and returns "Incorrect PIN." WITHOUT running bcrypt.compare —
 *      this closes the per-attempt bcrypt cost called out in Q-05-002 while keeping lockout semantics
 *      identical to before.
 *   4. bcrypt.compare -> record on failure / clear on success.
 */
export async function verifyPinWithThrottle(
  profileId: string,
  organizationId: string,
  pinHash: string | null,
  pin: string | undefined,
): Promise<PinVerifyResult> {
  if (!pinHash) return { ok: true };

  const gate = await checkProfilePinThrottle(profileId, organizationId, Date.now());
  if (!gate.allowed) {
    return { ok: false, error: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterMs / 1000)}s.` };
  }

  const parsed = pinSchema.safeParse(pin);
  if (!parsed.success) {
    await recordProfilePinFailure(profileId, organizationId, Date.now());
    return { ok: false, error: "Incorrect PIN." };
  }

  const ok = await bcrypt.compare(parsed.data, pinHash);
  if (!ok) {
    await recordProfilePinFailure(profileId, organizationId, Date.now());
    return { ok: false, error: "Incorrect PIN." };
  }

  await clearProfilePinThrottle(profileId, organizationId);
  return { ok: true };
}
