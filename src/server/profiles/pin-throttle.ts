import "server-only";
import { withTenant } from "@/server/db";

const MAX_FAILURES = 5;
const WINDOW_MS = 30_000;

type ThrottleState = { pinFailedCount: number; pinWindowStart: Date | null };

/** Pure: is an attempt allowed given the stored counters and `now` (ms)? */
export function evaluateThrottle(state: ThrottleState, now: number): { allowed: boolean; retryAfterMs: number } {
  const start = state.pinWindowStart?.getTime();
  if (start === undefined || now - start > WINDOW_MS) return { allowed: true, retryAfterMs: 0 };
  if (state.pinFailedCount >= MAX_FAILURES) return { allowed: false, retryAfterMs: WINDOW_MS - (now - start) };
  return { allowed: true, retryAfterMs: 0 };
}

/** Pure: the next counters after a failed attempt. */
export function nextStateOnFailure(state: ThrottleState, now: number): ThrottleState {
  const start = state.pinWindowStart?.getTime();
  if (start === undefined || now - start > WINDOW_MS) return { pinFailedCount: 1, pinWindowStart: new Date(now) };
  return { pinFailedCount: state.pinFailedCount + 1, pinWindowStart: state.pinWindowStart };
}

/** DB-backed: read the profile's throttle counters and evaluate. org-scoped. */
export async function checkProfilePinThrottle(profileId: string, organizationId: string, now: number) {
  const p = await withTenant(
    (tx) => tx.profile.findUnique({ where: { id: profileId }, select: { pinFailedCount: true, pinWindowStart: true } }),
    undefined,
    { organizationId, userId: null },
  );
  return evaluateThrottle({ pinFailedCount: p?.pinFailedCount ?? 0, pinWindowStart: p?.pinWindowStart ?? null }, now);
}

export async function recordProfilePinFailure(profileId: string, organizationId: string, now: number): Promise<void> {
  await withTenant(
    async (tx) => {
      const p = await tx.profile.findUnique({
        where: { id: profileId },
        select: { pinFailedCount: true, pinWindowStart: true },
      });
      const next = nextStateOnFailure(
        { pinFailedCount: p?.pinFailedCount ?? 0, pinWindowStart: p?.pinWindowStart ?? null },
        now,
      );
      await tx.profile.update({ where: { id: profileId }, data: next });
    },
    undefined,
    { organizationId, userId: null },
  );
}

export async function clearProfilePinThrottle(profileId: string, organizationId: string): Promise<void> {
  await withTenant(
    (tx) => tx.profile.update({ where: { id: profileId }, data: { pinFailedCount: 0, pinWindowStart: null } }),
    undefined,
    { organizationId, userId: null },
  );
}
