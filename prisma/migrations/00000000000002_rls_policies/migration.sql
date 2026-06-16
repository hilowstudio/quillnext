-- ============================================================================
-- Real Row-Level Security: a non-bypass app role + per-tenant policies.
--
-- Context: the app historically connected as `postgres`, which has BYPASSRLS,
-- so the RLS enabled on every table was inert ("theater"). This migration adds
-- a dedicated NON-bypass role (`app_user`) and policies keyed on per-request
-- GUCs, all scoped `TO app_user` so the public Data API (anon/authenticated)
-- stays deny-all and the `postgres` connection is unaffected.
--
-- Enforcement only takes effect once the app CONNECTS as `app_user` (see
-- DATABASE_URL cutover) AND sets the GUCs per request (Prisma extension).
--
-- NOTE: this migration creates `app_user` as NOLOGIN with no password. Grant
-- login + set a password OUT OF BAND (never commit a secret):
--   ALTER ROLE app_user LOGIN PASSWORD '<secret>';
-- ============================================================================

-- Tenant-context accessors. NULL-safe -> a missing GUC fails CLOSED (sees nothing
-- org-scoped). Returns TEXT because Prisma String ids are stored as text, not uuid.
CREATE SCHEMA IF NOT EXISTS app;
CREATE OR REPLACE FUNCTION app.current_org() RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('app.current_org', true), '')
$fn$;
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS text LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('app.current_user', true), '')
$fn$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
  END IF;
END $do$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA app TO app_user;
GRANT EXECUTE ON FUNCTION app.current_org() TO app_user;
GRANT EXECUTE ON FUNCTION app.current_user_id() TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Direct account_id = org
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['articles','books','classrooms','courses','custom_events','document_resources','resources','students','student_schedule_items','video_resources'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_user_rls ON public.%I', t);
    EXECUTE format('CREATE POLICY app_user_rls ON public.%I FOR ALL TO app_user USING (account_id = app.current_org()) WITH CHECK (account_id = app.current_org())', t);
  END LOOP; END $do$;

-- Direct organization_id = org
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['curriculum_specs','transcripts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_user_rls ON public.%I', t);
    EXECUTE format('CREATE POLICY app_user_rls ON public.%I FOR ALL TO app_user USING (organization_id = app.current_org()) WITH CHECK (organization_id = app.current_org())', t);
  END LOOP; END $do$;

DROP POLICY IF EXISTS app_user_rls ON public.organizations;
-- INSERT gets a null-context allowance so first-run onboarding can create the org BEFORE any
-- tenant context exists; SELECT/UPDATE/DELETE stay gated by USING (id = current_org).
CREATE POLICY app_user_rls ON public.organizations FOR ALL TO app_user USING (id = app.current_org()) WITH CHECK (id = app.current_org() OR app.current_org() IS NULL);

-- User-owned (user_id = current_user)
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['gratitude_entries','devotional_reflections','local_church_notes','prayer_entries','bible_memory'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_user_rls ON public.%I', t);
    EXECUTE format('CREATE POLICY app_user_rls ON public.%I FOR ALL TO app_user USING (user_id = app.current_user_id()) WITH CHECK (user_id = app.current_user_id())', t);
  END LOOP; END $do$;

-- Parent-scoped via student -> students.account_id
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['activity_progress','bible_memory_folder','classroom_students','course_progress','course_students','learner_profiles','safety_flags','student_catechism_progress'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_user_rls ON public.%I', t);
    EXECUTE format('CREATE POLICY app_user_rls ON public.%I FOR ALL TO app_user USING (student_id IN (SELECT id FROM public.students WHERE account_id = app.current_org())) WITH CHECK (student_id IN (SELECT id FROM public.students WHERE account_id = app.current_org()))', t);
  END LOOP; END $do$;

-- Parent-scoped via course -> courses.account_id
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['assessments','course_blocks'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_user_rls ON public.%I', t);
    EXECUTE format('CREATE POLICY app_user_rls ON public.%I FOR ALL TO app_user USING (course_id IN (SELECT id FROM public.courses WHERE account_id = app.current_org())) WITH CHECK (course_id IN (SELECT id FROM public.courses WHERE account_id = app.current_org()))', t);
  END LOOP; END $do$;

DROP POLICY IF EXISTS app_user_rls ON public.activities;
CREATE POLICY app_user_rls ON public.activities FOR ALL TO app_user
  USING (course_block_id IN (SELECT cb.id FROM public.course_blocks cb JOIN public.courses c ON c.id = cb.course_id WHERE c.account_id = app.current_org()))
  WITH CHECK (course_block_id IN (SELECT cb.id FROM public.course_blocks cb JOIN public.courses c ON c.id = cb.course_id WHERE c.account_id = app.current_org()));

DROP POLICY IF EXISTS app_user_rls ON public.activity_objectives;
CREATE POLICY app_user_rls ON public.activity_objectives FOR ALL TO app_user
  USING (activity_id IN (SELECT a.id FROM public.activities a JOIN public.course_blocks cb ON cb.id = a.course_block_id JOIN public.courses c ON c.id = cb.course_id WHERE c.account_id = app.current_org()))
  WITH CHECK (activity_id IN (SELECT a.id FROM public.activities a JOIN public.course_blocks cb ON cb.id = a.course_block_id JOIN public.courses c ON c.id = cb.course_id WHERE c.account_id = app.current_org()));

DROP POLICY IF EXISTS app_user_rls ON public.assessment_items;
CREATE POLICY app_user_rls ON public.assessment_items FOR ALL TO app_user
  USING (assessment_id IN (SELECT a.id FROM public.assessments a JOIN public.courses c ON c.id = a.course_id WHERE c.account_id = app.current_org()))
  WITH CHECK (assessment_id IN (SELECT a.id FROM public.assessments a JOIN public.courses c ON c.id = a.course_id WHERE c.account_id = app.current_org()));

DROP POLICY IF EXISTS app_user_rls ON public.assessment_attempts;
CREATE POLICY app_user_rls ON public.assessment_attempts FOR ALL TO app_user
  USING (assessment_id IN (SELECT a.id FROM public.assessments a JOIN public.courses c ON c.id = a.course_id WHERE c.account_id = app.current_org()))
  WITH CHECK (assessment_id IN (SELECT a.id FROM public.assessments a JOIN public.courses c ON c.id = a.course_id WHERE c.account_id = app.current_org()));

DROP POLICY IF EXISTS app_user_rls ON public.assessment_item_responses;
CREATE POLICY app_user_rls ON public.assessment_item_responses FOR ALL TO app_user
  USING (attempt_id IN (SELECT at.id FROM public.assessment_attempts at JOIN public.assessments a ON a.id = at.assessment_id JOIN public.courses c ON c.id = a.course_id WHERE c.account_id = app.current_org()))
  WITH CHECK (attempt_id IN (SELECT at.id FROM public.assessment_attempts at JOIN public.assessments a ON a.id = at.assessment_id JOIN public.courses c ON c.id = a.course_id WHERE c.account_id = app.current_org()));

-- Parent-scoped via classroom
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['classroom_holidays','classroom_instructors'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_user_rls ON public.%I', t);
    EXECUTE format('CREATE POLICY app_user_rls ON public.%I FOR ALL TO app_user USING (classroom_id IN (SELECT id FROM public.classrooms WHERE account_id = app.current_org())) WITH CHECK (classroom_id IN (SELECT id FROM public.classrooms WHERE account_id = app.current_org()))', t);
  END LOOP; END $do$;

-- Parent-scoped via resource -> resources.account_id
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['book_generated_materials','resource_assignments'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_user_rls ON public.%I', t);
    EXECUTE format('CREATE POLICY app_user_rls ON public.%I FOR ALL TO app_user USING (resource_id IN (SELECT id FROM public.resources WHERE account_id = app.current_org())) WITH CHECK (resource_id IN (SELECT id FROM public.resources WHERE account_id = app.current_org()))', t);
  END LOOP; END $do$;

-- curriculum_bundles -> curriculum_specs.organization_id ("specId" is camelCase in DB)
DROP POLICY IF EXISTS app_user_rls ON public.curriculum_bundles;
CREATE POLICY app_user_rls ON public.curriculum_bundles FOR ALL TO app_user
  USING ("specId" IN (SELECT id FROM public.curriculum_specs WHERE organization_id = app.current_org()))
  WITH CHECK ("specId" IN (SELECT id FROM public.curriculum_specs WHERE organization_id = app.current_org()));

-- Auth tables: permissive for app_user (sign-in happens before any org context exists).
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['users','accounts','sessions','verification_tokens'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_user_rls ON public.%I', t);
    EXECUTE format('CREATE POLICY app_user_rls ON public.%I FOR ALL TO app_user USING (true) WITH CHECK (true)', t);
  END LOOP; END $do$;

-- Global reference data: read-only for app_user (writes only via migrations/seeds as superuser).
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['subjects','strands','topics','subtopics','objectives','grade_bands','resource_kinds','catechisms','catechism_questions','commentary_chapters','commentary_sections','devotionals','counties','prayer_categories'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_user_read ON public.%I', t);
    EXECUTE format('CREATE POLICY app_user_read ON public.%I FOR SELECT TO app_user USING (true)', t);
  END LOOP; END $do$;
