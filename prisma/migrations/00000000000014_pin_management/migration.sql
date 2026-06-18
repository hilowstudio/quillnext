-- HYG-12: the instructor PIN is vestigial — the PIN now lives on the owner PARENT profile
-- (profiles.pin_hash, seeded at onboarding since Slice 3). Drop the column so the data export
-- can no longer ship its bcrypt hash to the client.
ALTER TABLE "classroom_instructors" DROP COLUMN "instructor_pin";

-- Durable per-profile PIN-attempt throttle (replaces the in-memory limiter). Stored on the
-- profile itself, so it reuses the existing profiles RLS policy (no new table/policy).
ALTER TABLE "profiles" ADD COLUMN "pin_failed_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "profiles" ADD COLUMN "pin_window_start" TIMESTAMP(3);
