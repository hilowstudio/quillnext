-- Coarse textbook↔spine-Topic coverage (grounded-generation (b)). GLOBAL / cross-org shared
-- (CONTEXT_FREE_MODELS), readable by every org and writable by app_user, mirroring the other corpus
-- tables. topic_id references the spine Topic by id WITHOUT a FK (Topic is core reference data).

-- CreateTable
CREATE TABLE "textbook_topic_coverage" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "textbook_topic_coverage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "textbook_topic_coverage_topic_id_idx" ON "textbook_topic_coverage"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "textbook_topic_coverage_document_id_topic_id_key" ON "textbook_topic_coverage"("document_id", "topic_id");

-- AddForeignKey
ALTER TABLE "textbook_topic_coverage" ADD CONSTRAINT "textbook_topic_coverage_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "textbook_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: global/shared, readable by every org, writable (incl. DELETE for re-crosswalk) by app_user.
ALTER TABLE public.textbook_topic_coverage ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.textbook_topic_coverage TO app_user;
CREATE POLICY app_user_read   ON public.textbook_topic_coverage FOR SELECT TO app_user USING (true);
CREATE POLICY app_user_write  ON public.textbook_topic_coverage FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY app_user_update ON public.textbook_topic_coverage FOR UPDATE TO app_user USING (true) WITH CHECK (true);
CREATE POLICY app_user_delete ON public.textbook_topic_coverage FOR DELETE TO app_user USING (true);
