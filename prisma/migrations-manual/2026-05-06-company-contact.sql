-- CompanyContact: address-book entry for a person at a Company.
--
-- Apply once in the Supabase SQL editor against production. After this
-- runs, the next deploy's `prisma generate` step picks up the new model.
--
-- Idempotent: re-running creates nothing new and never errors.

CREATE TABLE IF NOT EXISTS "CompanyContact" (
  "id"        TEXT         PRIMARY KEY,
  "companyId" TEXT         NOT NULL,
  "name"      TEXT,
  "email"     TEXT         NOT NULL,
  "role"      TEXT,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyContact_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyContact_companyId_email_key"
  ON "CompanyContact" ("companyId", "email");

CREATE INDEX IF NOT EXISTS "CompanyContact_companyId_idx"
  ON "CompanyContact" ("companyId");
