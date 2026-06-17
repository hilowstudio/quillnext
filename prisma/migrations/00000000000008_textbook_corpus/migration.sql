-- Textbook corpus (by-subject open-textbook grounding). Two GLOBAL / cross-org shared tables
-- (CONTEXT_FREE_MODELS), readable by every org and writable by app_user (incl. DELETE for re-ingest),
-- mirroring book_text_chunks.

-- CreateTable
CREATE TABLE "textbook_documents" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'openstax',
    "cnx_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "textbook_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "textbook_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "subject" TEXT,
    "category" TEXT,
    "section_title" TEXT,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "textbook_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "textbook_documents_cnx_id_key" ON "textbook_documents"("cnx_id");

-- CreateIndex
CREATE INDEX "textbook_documents_subject_idx" ON "textbook_documents"("subject");

-- CreateIndex
CREATE INDEX "textbook_chunks_subject_idx" ON "textbook_chunks"("subject");

-- CreateIndex
CREATE INDEX "textbook_chunks_document_id_idx" ON "textbook_chunks"("document_id");

-- AddForeignKey
ALTER TABLE "textbook_chunks" ADD CONSTRAINT "textbook_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "textbook_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: global/shared, readable by every org, writable (incl. DELETE for re-ingest) by app_user.
ALTER TABLE public.textbook_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textbook_documents TO app_user;
CREATE POLICY app_user_read   ON public.textbook_documents FOR SELECT TO app_user USING (true);
CREATE POLICY app_user_write  ON public.textbook_documents FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY app_user_update ON public.textbook_documents FOR UPDATE TO app_user USING (true) WITH CHECK (true);
CREATE POLICY app_user_delete ON public.textbook_documents FOR DELETE TO app_user USING (true);

ALTER TABLE public.textbook_chunks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textbook_chunks TO app_user;
CREATE POLICY app_user_read   ON public.textbook_chunks FOR SELECT TO app_user USING (true);
CREATE POLICY app_user_write  ON public.textbook_chunks FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY app_user_update ON public.textbook_chunks FOR UPDATE TO app_user USING (true) WITH CHECK (true);
CREATE POLICY app_user_delete ON public.textbook_chunks FOR DELETE TO app_user USING (true);
