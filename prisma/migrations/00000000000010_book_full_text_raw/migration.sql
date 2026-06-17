-- Transient raw-text holding column for the SPLIT book full-text ingestion. The fetch step downloads
-- the body and stores it here; the stage step reads it back, segments + chunks it, then clears it to
-- NULL. This keeps the multi-MB body OUT of the Inngest step output (which has a size limit) and lets
-- the heavy network fetch and the CPU/DB staging each be their own bounded step (Vercel Hobby 60s).
-- book_extractions is GLOBAL / context-free; the new column inherits the table's existing app_user
-- RLS policies and grants (no policy/grant change needed).
ALTER TABLE "book_extractions" ADD COLUMN "full_text_raw" TEXT;
