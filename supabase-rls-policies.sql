-- ============================================================
-- SUPABASE ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================
-- Run this in Supabase SQL Editor ONCE.
--
-- This creates a defense-in-depth layer. Even if someone obtains
-- the anon key or bypasses the Next.js app, Postgres itself
-- refuses to return data from tables unless the request meets
-- RLS rules.
--
-- Our app uses SUPABASE_SERVICE_ROLE_KEY in server actions, which
-- BYPASSES RLS by design (that's the whole point of the service
-- role). So RLS here protects against:
--   1. Leaked anon key → can't read anything sensitive
--   2. Direct Postgres connections → blocked at row level
--   3. Future frontend queries with the anon key → only public data
--
-- Strategy: enable RLS on EVERY table, then add a single
-- "deny all to anon" policy. Service role (server actions) is
-- unaffected and continues to work normally.
--
-- To undo: see section at bottom.
-- ============================================================

BEGIN;

-- ── Enable RLS on every application table ────────────────────

ALTER TABLE "User"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Asset"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PipelineStage"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssetCompanyTracking"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StageStatus"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StageHistory"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedView"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SigningToken"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvestorInvite"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssetContent"            ENABLE ROW LEVEL SECURITY;

-- ── Default-deny policy: anon role can't read ANYTHING ───────
-- Service role bypasses RLS automatically — the Next.js server
-- actions continue to work as before.

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'User','Asset','Company','PipelineStage','AssetCompanyTracking',
      'StageStatus','Comment','StageHistory','ActivityLog','SavedView',
      'Document','SigningToken','InvestorInvite','AssetContent'
    ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS deny_anon_select ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS deny_anon_all    ON %I', tbl);

    -- One blanket deny-all policy covering SELECT / INSERT / UPDATE / DELETE
    EXECUTE format(
      'CREATE POLICY deny_anon_all ON %I AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)',
      tbl
    );
  END LOOP;
END $$;

-- ── Verify RLS is enabled on every table ─────────────────────

DO $$
DECLARE
  unprotected text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO unprotected
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'User','Asset','Company','PipelineStage','AssetCompanyTracking',
      'StageStatus','Comment','StageHistory','ActivityLog','SavedView',
      'Document','SigningToken','InvestorInvite','AssetContent'
    )
    AND c.relrowsecurity = false;

  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION 'RLS is NOT enabled on: %', unprotected;
  END IF;
END $$;

COMMIT;

-- ── Sanity check: list tables + RLS status ───────────────────
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname NOT LIKE '\_%' ESCAPE '\'
ORDER BY c.relname;

-- Expected result: every app table shows rls_enabled = true, policy_count >= 1.

-- ============================================================
-- STORAGE BUCKET RLS (run separately in Supabase UI or below)
-- ============================================================
-- The `documents` bucket should already be private.
-- Add a storage policy to ensure ONLY the service role can
-- read/write. Anon gets nothing.

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop any pre-existing policies on storage.objects for this bucket
DROP POLICY IF EXISTS "documents_deny_anon" ON storage.objects;

-- Block ALL anon access to documents bucket.
-- Service role bypasses this (generates signed URLs via server action).
CREATE POLICY "documents_deny_anon"
  ON storage.objects
  AS RESTRICTIVE
  FOR ALL
  TO anon
  USING (bucket_id <> 'documents')
  WITH CHECK (bucket_id <> 'documents');

-- ============================================================
-- TO UNDO (emergency rollback)
-- ============================================================
-- Uncomment and run if RLS breaks the app:
--
-- ALTER TABLE "User"                    DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Asset"                   DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Company"                 DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "PipelineStage"           DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "AssetCompanyTracking"    DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "StageStatus"             DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Comment"                 DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "StageHistory"            DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "ActivityLog"             DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "SavedView"               DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "Document"                DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "SigningToken"            DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "InvestorInvite"          DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE "AssetContent"            DISABLE ROW LEVEL SECURITY;
