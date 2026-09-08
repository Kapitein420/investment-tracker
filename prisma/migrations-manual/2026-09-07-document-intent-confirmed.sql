-- Signature certificate + intent confirmation evidence (compliance gap G8,
-- follow-up to 2026-09-07-signing-evidence-and-actor.sql).
--
-- Document.intentConfirmedAt records when the signer ticked the required
-- "I intend this electronic signature to be my legally binding signature..."
-- checkbox — the last missing piece of BW 3:15a "sufficiently reliable"
-- evidence alongside signerIp/signerUserAgent/pdfSha256 (already added).
--
-- Apply once in the Supabase SQL editor against production. After this
-- runs, the next deploy's `prisma generate` step picks up the new field.
--
-- Idempotent: re-running creates nothing new and never errors.

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "intentConfirmedAt" TIMESTAMP(3);
