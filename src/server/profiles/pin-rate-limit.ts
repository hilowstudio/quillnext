/**
 * Best-effort in-memory PIN attempt limiter: 5 failures per 30s window per key, then a lockout
 * for the remainder of the window. `now` (ms) is injected for deterministic tests.
 *
 * NOTE: in-memory only — does not survive cold starts and is per-instance. A durable/distributed
 * limiter is a Slice 5 hardening item. Adequate for the single pre-launch account.
 */
const MAX_FAILURES = 5;
const WINDOW_MS = 30_000;

const attempts = new Map<string, { count: number; firstAt: number }>();

export function checkPinRateLimit(key: string, now: number): { allowed: boolean; retryAfterMs: number } {
  const rec = attempts.get(key);
  if (!rec || now - rec.firstAt > WINDOW_MS) return { allowed: true, retryAfterMs: 0 };
  if (rec.count >= MAX_FAILURES) return { allowed: false, retryAfterMs: WINDOW_MS - (now - rec.firstAt) };
  return { allowed: true, retryAfterMs: 0 };
}

export function recordPinFailure(key: string, now: number): void {
  const rec = attempts.get(key);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
  } else {
    rec.count += 1;
  }
}

export function clearPinAttempts(key: string): void {
  attempts.delete(key);
}
