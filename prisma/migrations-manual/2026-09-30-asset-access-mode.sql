-- Per-asset investor process ("access mode").
--
-- STANDARD  (default, current behaviour): Teaser -> NDA -> IM -> Viewing -> NBO.
-- DIRECT_IM (additional process): first login shows the teaser and the IM is
--   open immediately. The portal terms click-accept (TermsAcceptance, G13)
--   replaces the NDA, there is no viewing stage, and NBO unlocks with the IM.
--
-- Apply once in the Supabase SQL editor BEFORE the deploy. Every existing
-- asset backfills to STANDARD, so nothing changes until an admin switches an
-- asset. Idempotent.

DO $$ BEGIN
  CREATE TYPE "AccessMode" AS ENUM ('STANDARD', 'DIRECT_IM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Asset"
  ADD COLUMN IF NOT EXISTS "accessMode" "AccessMode" NOT NULL DEFAULT 'STANDARD';
