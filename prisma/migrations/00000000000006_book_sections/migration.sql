-- Phase 2 of grounded generation (docs/specs/grounded-generation.md): chapter/section-level
-- facts sheets + section<->objective cross-walk + spine-gap backlog.
--
-- All three tables are GLOBAL / cross-org shared (no account_id), like book_extractions:
-- readable by every org, writable by the producer (Inngest worker as app_user). Same RLS recipe
-- as migrations 0004/0005, and they go in CONTEXT_FREE_MODELS so the per-request org GUC is
-- skipped. DELETE is granted so the worker can re-extract idempotently (delete-then-insert).

-- CreateTable
CREATE TABLE "book_extraction_sections" (
    "id" TEXT NOT NULL,
    "book_extraction_id" TEXT NOT NULL,
    "section_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CHAPTER',
    "summary" TEXT,
    "key_points" JSONB,
    "characters_present" JSONB,
    "vocabulary" JSONB,
    "quotes" JSONB,
    "factsSource" TEXT NOT NULL DEFAULT 'WEB',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "book_extraction_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_section_objectives" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "objective_id" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "book_section_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spine_gaps" (
    "id" TEXT NOT NULL,
    "book_extraction_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "topic_guess" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "spine_gaps_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "book_extraction_sections_book_extraction_id_idx" ON "book_extraction_sections"("book_extraction_id");
CREATE UNIQUE INDEX "book_extraction_sections_book_extraction_id_section_number_key" ON "book_extraction_sections"("book_extraction_id", "section_number");
CREATE INDEX "book_section_objectives_objective_id_idx" ON "book_section_objectives"("objective_id");
CREATE UNIQUE INDEX "book_section_objectives_section_id_objective_id_key" ON "book_section_objectives"("section_id", "objective_id");
CREATE INDEX "spine_gaps_book_extraction_id_idx" ON "spine_gaps"("book_extraction_id");

-- Foreign keys
ALTER TABLE "book_extraction_sections" ADD CONSTRAINT "book_extraction_sections_book_extraction_id_fkey" FOREIGN KEY ("book_extraction_id") REFERENCES "book_extractions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_section_objectives" ADD CONSTRAINT "book_section_objectives_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "book_extraction_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_section_objectives" ADD CONSTRAINT "book_section_objectives_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "spine_gaps" ADD CONSTRAINT "spine_gaps_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "book_extraction_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS: all three are global/shared, readable by every org, writable by app_user (the worker).
-- ---------------------------------------------------------------------------
ALTER TABLE public.book_extraction_sections ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_extraction_sections TO app_user;
CREATE POLICY app_user_read   ON public.book_extraction_sections FOR SELECT TO app_user USING (true);
CREATE POLICY app_user_write  ON public.book_extraction_sections FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY app_user_update ON public.book_extraction_sections FOR UPDATE TO app_user USING (true) WITH CHECK (true);
CREATE POLICY app_user_delete ON public.book_extraction_sections FOR DELETE TO app_user USING (true);

ALTER TABLE public.book_section_objectives ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_section_objectives TO app_user;
CREATE POLICY app_user_read   ON public.book_section_objectives FOR SELECT TO app_user USING (true);
CREATE POLICY app_user_write  ON public.book_section_objectives FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY app_user_update ON public.book_section_objectives FOR UPDATE TO app_user USING (true) WITH CHECK (true);
CREATE POLICY app_user_delete ON public.book_section_objectives FOR DELETE TO app_user USING (true);

ALTER TABLE public.spine_gaps ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spine_gaps TO app_user;
CREATE POLICY app_user_read   ON public.spine_gaps FOR SELECT TO app_user USING (true);
CREATE POLICY app_user_write  ON public.spine_gaps FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY app_user_update ON public.spine_gaps FOR UPDATE TO app_user USING (true) WITH CHECK (true);
CREATE POLICY app_user_delete ON public.spine_gaps FOR DELETE TO app_user USING (true);
