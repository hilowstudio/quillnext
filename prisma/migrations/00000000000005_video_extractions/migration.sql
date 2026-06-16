-- Transcript-first, cross-org SHARED YouTube ingestion.
--
-- video_extractions / video_extraction_chunks are GLOBAL (no account_id): the transcript,
-- metadata, summary and chunk embeddings for a YouTube video are identical for everyone, so the
-- first org to ingest a video populates the shared row and every other org's VideoResource links
-- to it (videoExtractionId) and reuses it for free. This also FIXES the prior global-unique bug
-- on video_resources.youtube_video_id (which wrongly let only one org own any given video) by
-- moving the global identity to video_extractions and making the per-org row unique per (org,video).

-- DropIndex (global unique that blocked two orgs owning the same video)
DROP INDEX "video_resources_youtube_video_id_key";

-- AlterTable
ALTER TABLE "video_resources" ADD COLUMN     "video_extraction_id" TEXT;

-- CreateTable
CREATE TABLE "video_extractions" (
    "id" TEXT NOT NULL,
    "youtube_video_id" TEXT NOT NULL,
    "youtube_url" TEXT NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'NOT_EXTRACTED',
    "stage" TEXT,
    "title" TEXT,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "channel_name" TEXT,
    "duration_seconds" INTEGER,
    "summary" TEXT,
    "key_points" JSONB,
    "chapters" JSONB,
    "topics" TEXT[],
    "transcript" TEXT,
    "captions_available" BOOLEAN NOT NULL DEFAULT false,
    "extracted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_extraction_chunks" (
    "id" TEXT NOT NULL,
    "video_extraction_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_extraction_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "video_extractions_youtube_video_id_key" ON "video_extractions"("youtube_video_id");

-- CreateIndex
CREATE INDEX "video_extraction_chunks_video_extraction_id_idx" ON "video_extraction_chunks"("video_extraction_id");

-- CreateIndex (per-org uniqueness replaces the dropped global unique)
CREATE UNIQUE INDEX "video_resources_account_id_youtube_video_id_key" ON "video_resources"("account_id", "youtube_video_id");

-- AddForeignKey
ALTER TABLE "video_resources" ADD CONSTRAINT "video_resources_video_extraction_id_fkey" FOREIGN KEY ("video_extraction_id") REFERENCES "video_extractions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_extraction_chunks" ADD CONSTRAINT "video_extraction_chunks_video_extraction_id_fkey" FOREIGN KEY ("video_extraction_id") REFERENCES "video_extractions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS: both new tables are GLOBAL/shared (no account_id), readable by every org and writable by
-- the producer (Inngest worker running as the non-bypass app_user). Mirrors 00000000000004
-- (book_extractions). They are also added to CONTEXT_FREE_MODELS in src/server/db.ts so the
-- per-query org GUC is skipped (read/write with plain db).
-- video_resources.video_extraction_id needs no new policy — the existing per-org app_user_rls
-- on video_resources (account_id = app.current_org()) covers the added column.
-- ---------------------------------------------------------------------------
ALTER TABLE public.video_extractions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.video_extractions TO app_user;
CREATE POLICY app_user_read ON public.video_extractions FOR SELECT TO app_user USING (true);
CREATE POLICY app_user_write ON public.video_extractions FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY app_user_update ON public.video_extractions FOR UPDATE TO app_user USING (true) WITH CHECK (true);

ALTER TABLE public.video_extraction_chunks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_extraction_chunks TO app_user;
CREATE POLICY app_user_read ON public.video_extraction_chunks FOR SELECT TO app_user USING (true);
CREATE POLICY app_user_write ON public.video_extraction_chunks FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY app_user_update ON public.video_extraction_chunks FOR UPDATE TO app_user USING (true) WITH CHECK (true);
-- DELETE allowed on chunks so the worker can re-embed idempotently (delete-then-insert per video).
CREATE POLICY app_user_delete ON public.video_extraction_chunks FOR DELETE TO app_user USING (true);
