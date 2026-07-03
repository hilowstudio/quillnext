-- Migration 0020 — retain "Current Challenges" on the classroom as a first-class column.
--
-- Part of consolidating onboarding: goals + challenges (the only Step-3/environment fields actually
-- read by generation) move onto Step 1's classroom record. Goals already has a column (academic_goals);
-- this adds the challenges column so Step 3 can be removed without losing data flow.
--
-- SAFETY: purely additive — one nullable-with-default column, no existing data touched. The classrooms
-- app_user RLS policy already covers it.

ALTER TABLE "classrooms" ADD COLUMN "challenges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
