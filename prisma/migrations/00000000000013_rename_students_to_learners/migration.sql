-- Rename the learner table to match the Prisma model (Student -> Learner, Slice 1b).
-- Metadata-only: indexes, FK constraints, the app_user_rls RLS policy, and grants all FOLLOW the
-- table automatically on RENAME. FK columns on other tables (e.g. student_id) are intentionally
-- left unchanged. Constraint/index names keep their `students_*` prefix (cosmetic, harmless).
ALTER TABLE "students" RENAME TO "learners";
