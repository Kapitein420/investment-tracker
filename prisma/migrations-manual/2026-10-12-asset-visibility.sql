-- Per-asset visibility switches.
--
-- isHidden            : drop the asset from the default admin dashboard list.
--                       Admins/editors can reveal hidden assets with "Show hidden".
-- hiddenFromInvestors : the asset disappears from the investor portal and its
--                       documents/content stop being served to investors.
--
-- Apply once in the Supabase SQL editor BEFORE the deploy. Every existing
-- asset backfills to visible, so nothing changes until an admin hides one.
-- Idempotent.

ALTER TABLE "Asset"
  ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hiddenFromInvestors" BOOLEAN NOT NULL DEFAULT false;
