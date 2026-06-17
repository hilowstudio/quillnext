-- Phase 3 of grounded generation: full-text RAG for public-domain / open works.
-- book_text_chunks is GLOBAL / cross-org shared (public-domain text + embeddings are identical
-- for everyone) — same RLS recipe + CONTEXT_FREE_MODELS as the other shared chunk tables.
-- The new book_extractions columns ride the existing per-table policies (no new policy needed).

-- AlterTable: provenance + public-domain flag on the shared catalog row
ALTER TABLE "book_extractions"
  ADD COLUMN "full_text_source" TEXT,
  ADD COLUMN "full_text_source_id" TEXT,
  ADD COLUMN "full_text_status" TEXT,
  ADD COLUMN "public_domain" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "book_text_chunks" (
    "id" TEXT NOT NULL,
    "book_extraction_id" TEXT NOT NULL,
    "section_number" INTEGER,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "book_text_chunks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "book_text_chunks_book_extraction_id_idx" ON "book_text_chunks"("book_extraction_id");

ALTER TABLE "book_text_chunks" ADD CONSTRAINT "book_text_chunks_book_extraction_id_fkey" FOREIGN KEY ("book_extraction_id") REFERENCES "book_extractions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: global/shared, readable by every org, writable (incl. DELETE for re-ingest) by app_user.
ALTER TABLE public.book_text_chunks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_text_chunks TO app_user;
CREATE POLICY app_user_read   ON public.book_text_chunks FOR SELECT TO app_user USING (true);
CREATE POLICY app_user_write  ON public.book_text_chunks FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY app_user_update ON public.book_text_chunks FOR UPDATE TO app_user USING (true) WITH CHECK (true);
CREATE POLICY app_user_delete ON public.book_text_chunks FOR DELETE TO app_user USING (true);
