/**
 * Deterministic Profile ids — the SINGLE source shared by the backfill, onboarding, and the
 * add-learner path, so the same User/Learner always maps to the same Profile id. This makes all
 * three paths idempotent (upsert-by-id) and prevents duplicate profiles.
 */
export const parentProfileId = (userId: string): string => `profile-user-${userId}`;
export const studentProfileId = (learnerId: string): string => `profile-learner-${learnerId}`;
