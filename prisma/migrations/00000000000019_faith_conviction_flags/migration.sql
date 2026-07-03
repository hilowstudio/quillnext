-- Migration 0019 — faith-aware generation: conviction-flag columns on classrooms + their enums.
--
-- SAFETY: purely additive — CREATE TYPE + ADD COLUMN only. Every new column is nullable or has a
-- default; no existing column, row, or type is touched, no reseed. No RLS change is needed: the
-- classrooms table's existing app_user policy (account_id = app.current_org()) already covers the
-- new columns, and PUBLIC has USAGE on the new enum types by default.

CREATE TYPE "OriginsStance" AS ENUM ('YOUNG_EARTH', 'OLD_EARTH', 'EVOLUTIONARY_CREATION', 'MULTIPLE_VIEWS', 'MAINSTREAM_SCIENCE');
CREATE TYPE "SexualityStance" AS ENUM ('TRADITIONAL', 'FACTUAL_DEFER', 'AVOID');
CREATE TYPE "SoteriologyStance" AS ENUM ('REFORMED_CALVINIST', 'ARMINIAN_WESLEYAN');
CREATE TYPE "EschatologyStance" AS ENUM ('DISPENSATIONAL_PREMIL', 'HISTORIC_PREMIL', 'AMILLENNIAL', 'POSTMILLENNIAL', 'PRETERIST');
CREATE TYPE "SpiritualGiftsStance" AS ENUM ('CONTINUATIONIST', 'CESSATIONIST', 'OPEN_CAUTIOUS');
CREATE TYPE "BibleStorylineStance" AS ENUM ('COVENANT', 'DISPENSATIONALISM', 'PROGRESSIVE_DISPENSATIONALISM', 'PROGRESSIVE_COVENANTALISM', 'NEW_COVENANT_THEOLOGY');
CREATE TYPE "CatholicEmphasisStance" AS ENUM ('TRADITIONAL_LATIN_MASS', 'CONSERVATIVE_JPII_BENEDICT', 'MAINSTREAM', 'PROGRESSIVE');

ALTER TABLE "classrooms"
  ADD COLUMN "bible_translation"  TEXT,
  ADD COLUMN "confessions"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "origins"            "OriginsStance",
  ADD COLUMN "sexuality_approach" "SexualityStance",
  ADD COLUMN "soteriology"        "SoteriologyStance",
  ADD COLUMN "eschatology"        "EschatologyStance",
  ADD COLUMN "spiritual_gifts"    "SpiritualGiftsStance",
  ADD COLUMN "bible_storyline"    "BibleStorylineStance",
  ADD COLUMN "catholic_emphasis"  "CatholicEmphasisStance";
