-- Fix the bible_memory RLS policy so it matches how the app actually uses the table.
--
-- The original 00000000000002_rls_policies classified bible_memory as user-owned and gave it a
-- single ALL policy keyed on `user_id = app.current_user_id()`. But the application uses this
-- table STUDENT-scoped (verses are created with student_id and NO user_id), plus there are
-- global `is_default = true` library verses owned by no one. Under that policy every write was
-- rejected ("new row violates row-level security policy") and student verses were invisible,
-- which crashed the Scripture Memory page on render.
--
-- Replace the single ALL policy with command-specific policies that mirror the sibling
-- bible_memory_folder policy (student -> org), allow the caller's own user verses, and treat
-- `is_default` rows as a globally readable/seedable shared library (but NOT tenant-writable, so
-- one family can't mutate another family's shared library).

DROP POLICY IF EXISTS app_user_rls ON public.bible_memory;
DROP POLICY IF EXISTS app_user_sel ON public.bible_memory;
DROP POLICY IF EXISTS app_user_ins ON public.bible_memory;
DROP POLICY IF EXISTS app_user_upd ON public.bible_memory;
DROP POLICY IF EXISTS app_user_del ON public.bible_memory;

-- Readable: the global default library OR the caller's own user verse OR a verse for a student
-- in the caller's org (the primary app pattern).
CREATE POLICY app_user_sel ON public.bible_memory FOR SELECT TO app_user
USING (
  is_default
  OR (user_id IS NOT NULL AND user_id = app.current_user_id())
  OR (student_id IN (SELECT id FROM public.students WHERE account_id = app.current_org()))
);

-- Insertable: seeding the default library, the caller's own verse, or a verse for a student in
-- the caller's org.
CREATE POLICY app_user_ins ON public.bible_memory FOR INSERT TO app_user
WITH CHECK (
  is_default
  OR (user_id IS NOT NULL AND user_id = app.current_user_id())
  OR (student_id IN (SELECT id FROM public.students WHERE account_id = app.current_org()))
);

-- Updatable: own verse or student-in-org verse. NOT shared defaults (protects the library).
CREATE POLICY app_user_upd ON public.bible_memory FOR UPDATE TO app_user
USING (
  (user_id IS NOT NULL AND user_id = app.current_user_id())
  OR (student_id IN (SELECT id FROM public.students WHERE account_id = app.current_org()))
)
WITH CHECK (
  (user_id IS NOT NULL AND user_id = app.current_user_id())
  OR (student_id IN (SELECT id FROM public.students WHERE account_id = app.current_org()))
);

-- Deletable: own verse or student-in-org verse. NOT shared defaults.
CREATE POLICY app_user_del ON public.bible_memory FOR DELETE TO app_user
USING (
  (user_id IS NOT NULL AND user_id = app.current_user_id())
  OR (student_id IN (SELECT id FROM public.students WHERE account_id = app.current_org()))
);
