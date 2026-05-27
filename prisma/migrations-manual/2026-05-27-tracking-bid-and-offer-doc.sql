-- Record an investor's bid (amount + offer PDF) on a tracking.
--
-- AssetCompanyTracking gets three nullable columns for the bid value;
-- the offer PDF reuses the existing Document table with a new "kind"
-- column ("SIGNING" = default, signing-flow doc; "OFFER" = admin-
-- uploaded reference doc, no signing token).
--
-- Apply once in the Supabase SQL editor against production. After this
-- runs, the next deploy's `prisma generate` step picks up the new fields.
--
-- Idempotent: re-running creates nothing new and never errors.

ALTER TABLE "AssetCompanyTracking"
  ADD COLUMN IF NOT EXISTS "bidAmount"      DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "bidCurrency"    TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS "bidSubmittedAt" TIMESTAMP(3);

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'SIGNING';
