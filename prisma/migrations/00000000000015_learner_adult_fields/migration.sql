-- Parent-as-learner ("My Learning", spec §9): an adult learner has no birthdate/grade. Relax the
-- two kid-only NOT NULL constraints so a Learner attached to a PARENT profile can be created.
-- (This is the slice-1a §3.2 intent that was not applied at the time.)
ALTER TABLE "learners" ALTER COLUMN "birthdate" DROP NOT NULL;
ALTER TABLE "learners" ALTER COLUMN "current_grade" DROP NOT NULL;
