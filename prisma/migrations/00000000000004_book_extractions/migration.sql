-- Global, cross-org shared AI book extraction (book_extractions) + Book.book_extraction_id link.
--
-- book_extractions deliberately has NO account_id: it is a single shared catalog of AI book
-- extractions. The first org to extract a given book (deduped on dedup_key = normalized ISBN-13
-- or a title|author slug) populates the row; every other org's `books` row links to it via
-- book_extraction_id and reuses it for free. This is the cross-org sharing the per-family
-- predecessor never actually delivered.

-- AlterTable
ALTER TABLE "books" ADD COLUMN     "book_extraction_id" TEXT;

-- CreateTable
CREATE TABLE "book_extractions" (
    "id" TEXT NOT NULL,
    "dedup_key" TEXT NOT NULL,
    "isbn_13" TEXT,
    "title_author_slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT[],
    "status" "ExtractionStatus" NOT NULL DEFAULT 'NOT_EXTRACTED',
    "stage" TEXT,
    "summary" TEXT,
    "table_of_contents" JSONB,
    "reading_level" TEXT,
    "main_themes" TEXT[],
    "sources" JSONB,
    "confidence" TEXT,
    "extracted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "book_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "book_extractions_dedup_key_key" ON "book_extractions"("dedup_key");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_book_extraction_id_fkey" FOREIGN KEY ("book_extraction_id") REFERENCES "book_extractions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS: book_extractions is GLOBAL (shared by all orgs). Unlike the read-only
-- global reference tables (subjects, strands, ...), it must be WRITABLE by the
-- producer, which runs as the non-bypass `app_user` role inside an Inngest worker.
-- So: readable by every org (USING true) + insert/update by any app_user. No DELETE
-- policy/grant => catalog rows cannot be deleted by the app (safe default). The
-- dedup_key UNIQUE index is the integrity guard against duplicate catalog rows.
-- (books.book_extraction_id needs no new policy: the existing per-org app_user_rls
-- on books covers the new column.)
-- ---------------------------------------------------------------------------
ALTER TABLE public.book_extractions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.book_extractions TO app_user;

DROP POLICY IF EXISTS app_user_read ON public.book_extractions;
CREATE POLICY app_user_read ON public.book_extractions FOR SELECT TO app_user USING (true);

DROP POLICY IF EXISTS app_user_write ON public.book_extractions;
CREATE POLICY app_user_write ON public.book_extractions FOR INSERT TO app_user WITH CHECK (true);

DROP POLICY IF EXISTS app_user_update ON public.book_extractions;
CREATE POLICY app_user_update ON public.book_extractions FOR UPDATE TO app_user USING (true) WITH CHECK (true);
