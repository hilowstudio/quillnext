-- Baseline prerequisites that precede the Prisma schema (00000000000001_init).
-- These objects are NOT managed by the Prisma datamodel; they are reproduced here
-- so `prisma migrate deploy` can build a working database from scratch.

-- pgvector: required by the books.embedding / video_resources.embedding columns
-- created in the init migration (modeled in schema as Unsupported("vector")).
CREATE EXTENSION IF NOT EXISTS "vector";

-- Auto-enable Row Level Security on every table created in `public`. Defined BEFORE
-- the init migration so the tables it creates pick up RLS (matching the canonical DB,
-- which was built with this trigger already present).
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
AS $fn$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name = 'public' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
    END IF;
  END LOOP;
END;
$fn$;

-- Creating an event trigger requires elevated privileges; guard it so a fresh
-- `migrate deploy` under a restricted role degrades gracefully instead of failing.
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    BEGIN
      CREATE EVENT TRIGGER ensure_rls ON ddl_command_end EXECUTE FUNCTION public.rls_auto_enable();
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped ensure_rls event trigger (insufficient privilege); enable RLS via the platform if required.';
    END;
  END IF;
END
$do$;
