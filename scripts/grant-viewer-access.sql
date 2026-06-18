-- Grant the VIEWER (seed: Sarah Viewer) read access to every asset so the
-- client/opdrachtgever dashboard shows real deal flow for screenshots.
INSERT INTO "AssetViewerAccess" (id, "userId", "assetId", "grantedAt", "grantedByUserId")
SELECT 'ava_' || substr(md5(u.id || a.id), 1, 20), u.id, a.id, now(), adm.id
FROM "User" u
CROSS JOIN "Asset" a
LEFT JOIN LATERAL (SELECT id FROM "User" WHERE role = 'ADMIN' LIMIT 1) adm ON true
WHERE u.role = 'VIEWER'
ON CONFLICT ("userId", "assetId") DO NOTHING;

SELECT
  (SELECT count(*) FROM "AssetViewerAccess") AS viewer_grants,
  (SELECT count(*) FROM "Asset") AS assets,
  (SELECT count(*) FROM "User") AS users,
  (SELECT count(*) FROM "AssetCompanyTracking") AS trackings;
