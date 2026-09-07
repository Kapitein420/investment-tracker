-- Wwft / AML buyer-side CDD attestation on Company (compliance gap G7).
--
-- Dils Netherlands B.V. is a Wwft institution (Art. 1a lid 4 sub h). KYC
-- itself runs outside this app, but nothing today shows whether buyer-side
-- client due diligence and sanctions screening happened before a deal
-- reaches the non-binding-offer (NBO) stage. This adds a manual, soft
-- attestation on Company — a status marker + note, NOT a KYC engine and
-- NOT document storage (no ID uploads, no UBO data).
--
-- cddStatus is a plain string, not an enum, matching Document.kind /
-- Document.placementMode elsewhere in this schema: "NOT_STARTED" |
-- "IN_PROGRESS" | "CLEARED" | "ESCALATED".
--
-- Apply once in the Supabase SQL editor against production. After this
-- runs, the next deploy's `prisma generate` step picks up the new fields.
--
-- Idempotent: re-running creates nothing new and never errors.

ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "cddStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "cddClearedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cddClearedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "cddNote" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "sanctionsScreenedAt" TIMESTAMP(3);

-- No ON DELETE CASCADE, matching every other *ByUserId column on this
-- table (contactPhone-style pointers aside) — deleting the clearing user
-- must not silently wipe the CDD record.
DO $$ BEGIN
  ALTER TABLE "Company"
    ADD CONSTRAINT "Company_cddClearedByUserId_fkey"
    FOREIGN KEY ("cddClearedByUserId") REFERENCES "User"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
