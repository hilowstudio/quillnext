-- Per-feature status for the SECTIONS facts-sheet, which now ingests in its OWN Inngest function
-- (ingest-book-sections) decoupled from the core extraction. EXTRACTED | UNAVAILABLE | null (pending).
-- Lets a sections failure (e.g. a web-grounded AI step timing out on Vercel Hobby) be recorded at
-- feature granularity WITHOUT marking the book's extraction_status FAILED. book_extractions is GLOBAL
-- / context-free; the new column inherits the table's existing app_user RLS (no policy/grant change).
ALTER TABLE "book_extractions" ADD COLUMN "sections_status" TEXT;
