-- Demo investor invites so the admin "Investors" page shows realistic rows.
-- Local screenshot DB only.
WITH adm AS (SELECT id FROM "User" WHERE role = 'ADMIN' LIMIT 1)
INSERT INTO "InvestorInvite" (id, "companyId", "assetId", email, token, "expiresAt", "acceptedAt", "createdById", "createdAt")
VALUES
  ('invite_001', 'test_co_1', 'test_asset_001', 'test.investor@example.com',    'inv_' || md5(random()::text), now() + interval '7 days', now() - interval '2 days', (SELECT id FROM adm), now() - interval '5 days'),
  ('invite_002', 'test_co_2', 'test_asset_001', 'contact@grachtenfonds.example.com', 'inv_' || md5(random()::text), now() + interval '7 days', NULL,                     (SELECT id FROM adm), now() - interval '3 days'),
  ('invite_003', 'test_co_3', 'test_asset_001', 'contact@dutchrealestate.example.com', 'inv_' || md5(random()::text), now() + interval '7 days', NULL,                  (SELECT id FROM adm), now() - interval '1 days')
ON CONFLICT (token) DO NOTHING;

-- Send / delivery events so each invite shows a status icon.
WITH adm AS (SELECT id FROM "User" WHERE role = 'ADMIN' LIMIT 1)
INSERT INTO "ActivityLog" (id, "entityType", "entityId", action, metadata, "userId", "createdAt")
VALUES
  ('al_inv_1a', 'InvestorInvite', 'invite_001', 'INVITE_SENT',     '{}'::jsonb, (SELECT id FROM adm), now() - interval '5 days'),
  ('al_inv_1b', 'InvestorInvite', 'invite_001', 'EMAIL_DELIVERED', '{}'::jsonb, (SELECT id FROM adm), now() - interval '5 days'),
  ('al_inv_1c', 'InvestorInvite', 'invite_001', 'EMAIL_OPENED',    '{}'::jsonb, (SELECT id FROM adm), now() - interval '4 days'),
  ('al_inv_2a', 'InvestorInvite', 'invite_002', 'INVITE_SENT',     '{}'::jsonb, (SELECT id FROM adm), now() - interval '3 days'),
  ('al_inv_2b', 'InvestorInvite', 'invite_002', 'EMAIL_DELIVERED', '{}'::jsonb, (SELECT id FROM adm), now() - interval '3 days'),
  ('al_inv_3a', 'InvestorInvite', 'invite_003', 'INVITE_SENT',     '{}'::jsonb, (SELECT id FROM adm), now() - interval '1 days')
ON CONFLICT (id) DO NOTHING;

SELECT (SELECT count(*) FROM "InvestorInvite") AS invites, (SELECT count(*) FROM "ActivityLog" WHERE "entityType"='InvestorInvite') AS invite_events;
