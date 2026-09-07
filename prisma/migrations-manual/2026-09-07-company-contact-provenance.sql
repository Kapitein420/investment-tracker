-- Art. 14 provenance for CompanyContact (compliance gap G2).
--
-- Most contacts arrive via CSV import or staff entry, which is Art. 14 data:
-- the notice to the person must state the *source* and reach them at first
-- contact or within one month. Today there is no way to tell where a
-- CompanyContact came from or when it was collected, so that clock is
-- unprovable. `source` is free text (like `role` on this model) rather than
-- an enum — known values: CSV_IMPORT, STAFF, SELF, BROKER_LIST.
--
-- `collectedAt` backfills from `createdAt` for existing rows since that's
-- the closest available approximation of when the data was actually
-- collected.
--
-- Apply once in the Supabase SQL editor against production. After this
-- runs, the next deploy's `prisma generate` step picks up the new fields.
--
-- Idempotent: re-running creates nothing new and never errors.

ALTER TABLE "CompanyContact"
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "collectedAt" TIMESTAMP(3);

UPDATE "CompanyContact"
SET "collectedAt" = "createdAt"
WHERE "collectedAt" IS NULL;

ALTER TABLE "CompanyContact"
  ALTER COLUMN "collectedAt" SET DEFAULT now(),
  ALTER COLUMN "collectedAt" SET NOT NULL;
