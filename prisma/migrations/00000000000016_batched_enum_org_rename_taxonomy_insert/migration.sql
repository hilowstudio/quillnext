-- Migration 0016 — batched schema hardening for the RLS cutover.
-- Bundles the long-deferred items: Q-013 (stringly-typed columns -> DB enums, IN PLACE so no
-- data is lost), Q-011 (org-FK column rename organization_id -> account_id to match every other
-- table), Q-23-003 (DocumentResource.extraction_status), and the Q-17-010 RLS-cutover blocker
-- (app_user INSERT policies on the custom-taxonomy reference tables).
--
-- SAFETY: every type change uses ALTER COLUMN ... TYPE ... USING (...::text::Enum) and every
-- org-FK change uses RENAME COLUMN — both preserve all existing rows. No DROP COLUMN, no reseed.

-- ============================================================================
-- Q-013: create enum types
-- ============================================================================
CREATE TYPE "SafetySeverity" AS ENUM ('CONCERN', 'DANGER', 'SAFE', 'TIER_1', 'TIER_2', 'TIER_3');
CREATE TYPE "SafetyCategory" AS ENUM ('BULLYING', 'SELF_HARM', 'GROOMING', 'VIOLENCE', 'SEXUAL_CONTENT', 'INCEST', 'BYPASS_ATTEMPT', 'OTHER', 'NONE');
CREATE TYPE "SafetyResolutionType" AS ENUM ('NO_ACTION', 'PARENT_SUMMARY_SAFETY_COACH', 'PARENT_SUMMARY_URGENT', 'SUPPORTIVE_ONLY', 'STUDENT_OPTIONAL_OUTREACH', 'INTERNAL_LOG_ONLY');
CREATE TYPE "FullTextStatus" AS ENUM ('INGESTED', 'INGESTING', 'UNAVAILABLE');
CREATE TYPE "SectionsStatus" AS ENUM ('EXTRACTED', 'UNAVAILABLE');
CREATE TYPE "ExtractionConfidence" AS ENUM ('high', 'medium', 'low');
CREATE TYPE "TextbookStatus" AS ENUM ('PENDING', 'INGESTING', 'INGESTED', 'UNAVAILABLE');
CREATE TYPE "CompileStatus" AS ENUM ('COMPILING', 'COMPLETED', 'FAILED');
CREATE TYPE "PrayerEntryStatus" AS ENUM ('ongoing', 'answered');
CREATE TYPE "PrayerEntryType" AS ENUM ('entry');

-- ============================================================================
-- Q-013: convert columns IN PLACE (the USING cast preserves every existing row)
-- ============================================================================
-- safety_flags (15 rows; severity/category NOT NULL preserved, resolution nullable)
ALTER TABLE "safety_flags" ALTER COLUMN "severity" TYPE "SafetySeverity" USING ("severity"::text::"SafetySeverity");
ALTER TABLE "safety_flags" ALTER COLUMN "category" TYPE "SafetyCategory" USING ("category"::text::"SafetyCategory");
ALTER TABLE "safety_flags" ALTER COLUMN "resolution" TYPE "SafetyResolutionType" USING ("resolution"::text::"SafetyResolutionType");

-- book_extractions (all nullable, no defaults)
ALTER TABLE "book_extractions" ALTER COLUMN "confidence" TYPE "ExtractionConfidence" USING ("confidence"::text::"ExtractionConfidence");
ALTER TABLE "book_extractions" ALTER COLUMN "full_text_status" TYPE "FullTextStatus" USING ("full_text_status"::text::"FullTextStatus");
ALTER TABLE "book_extractions" ALTER COLUMN "sections_status" TYPE "SectionsStatus" USING ("sections_status"::text::"SectionsStatus");

-- curriculum_bundles.status (NOT NULL, no default; 2 rows = FAILED)
ALTER TABLE "curriculum_bundles" ALTER COLUMN "status" TYPE "CompileStatus" USING ("status"::text::"CompileStatus");

-- textbook_documents.status (NOT NULL, string default -> drop, retype, reset)
ALTER TABLE "textbook_documents" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "textbook_documents" ALTER COLUMN "status" TYPE "TextbookStatus" USING ("status"::text::"TextbookStatus");
ALTER TABLE "textbook_documents" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- prayer_entries.status/type (0 rows, but both carry string defaults -> drop, retype, reset)
ALTER TABLE "prayer_entries" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "prayer_entries" ALTER COLUMN "status" TYPE "PrayerEntryStatus" USING ("status"::text::"PrayerEntryStatus");
ALTER TABLE "prayer_entries" ALTER COLUMN "status" SET DEFAULT 'ongoing';
ALTER TABLE "prayer_entries" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "prayer_entries" ALTER COLUMN "type" TYPE "PrayerEntryType" USING ("type"::text::"PrayerEntryType");
ALTER TABLE "prayer_entries" ALTER COLUMN "type" SET DEFAULT 'entry';

-- ============================================================================
-- Q-23-003: DocumentResource extraction status (new column; document_resources has 0 rows)
-- ============================================================================
ALTER TABLE "document_resources" ADD COLUMN "extraction_status" "ExtractionStatus" NOT NULL DEFAULT 'NOT_EXTRACTED';

-- ============================================================================
-- Q-011: rename org-FK column organization_id -> account_id (matches every other table).
-- RENAME COLUMN preserves data + the FK; the FK constraint is renamed for tidiness; the tenant
-- RLS policies that referenced organization_id are recreated against account_id below.
-- ============================================================================
ALTER TABLE "transcripts" RENAME COLUMN "organization_id" TO "account_id";
ALTER TABLE "curriculum_specs" RENAME COLUMN "organization_id" TO "account_id";

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transcripts_organization_id_fkey') THEN
    EXECUTE 'ALTER TABLE public.transcripts RENAME CONSTRAINT "transcripts_organization_id_fkey" TO "transcripts_account_id_fkey"';
  END IF;
END $do$;

DROP POLICY IF EXISTS app_user_rls ON public.curriculum_specs;
CREATE POLICY app_user_rls ON public.curriculum_specs FOR ALL TO app_user
  USING (account_id = app.current_org()) WITH CHECK (account_id = app.current_org());

DROP POLICY IF EXISTS app_user_rls ON public.transcripts;
CREATE POLICY app_user_rls ON public.transcripts FOR ALL TO app_user
  USING (account_id = app.current_org()) WITH CHECK (account_id = app.current_org());

DROP POLICY IF EXISTS app_user_rls ON public.curriculum_bundles;
CREATE POLICY app_user_rls ON public.curriculum_bundles FOR ALL TO app_user
  USING ("specId" IN (SELECT id FROM public.curriculum_specs WHERE account_id = app.current_org()))
  WITH CHECK ("specId" IN (SELECT id FROM public.curriculum_specs WHERE account_id = app.current_org()));

-- ============================================================================
-- Q-17-010: RLS-cutover blocker. The `new:` custom-taxonomy flow does
-- db.{subject,strand,topic,subtopic}.create, but migration 02 granted app_user SELECT-only on
-- these reference tables (no INSERT policy), so the creates would fail-closed once RLS is
-- enforced. Add a scoped INSERT policy so the existing flow keeps working under RLS. No
-- UPDATE/DELETE policy — the app never mutates or removes taxonomy.
-- ============================================================================
DO $do$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['subjects','strands','topics','subtopics'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_user_insert ON public.%I', t);
    EXECUTE format('CREATE POLICY app_user_insert ON public.%I FOR INSERT TO app_user WITH CHECK (true)', t);
  END LOOP; END $do$;
