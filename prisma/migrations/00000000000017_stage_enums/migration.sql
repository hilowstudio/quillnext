-- Migration 0017 — Q-013 follow-up: the two write-only `stage` graceful-degradation markers
-- promoted to DB enums. IN-PLACE cast preserves every existing value (the enum labels are the
-- same hyphenated strings the columns already hold). book_extractions.stage = perfect-parse(6)
-- + null(1); video_extractions has 0 rows. Both columns stay nullable.

CREATE TYPE "BookStage" AS ENUM ('perfect-parse', 'chapter-parse', 'manual-needed');
CREATE TYPE "VideoStage" AS ENUM ('transcript', 'gemini-fallback', 'manual-needed');

ALTER TABLE "book_extractions" ALTER COLUMN "stage" TYPE "BookStage" USING ("stage"::text::"BookStage");
ALTER TABLE "video_extractions" ALTER COLUMN "stage" TYPE "VideoStage" USING ("stage"::text::"VideoStage");
