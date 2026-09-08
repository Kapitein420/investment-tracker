---
name: verify-as-viewer
description: Verify a branch's VIEWER-role behaviour (asset access gating, hidden contact details) by running the app locally and quick-logging as each role. TRIGGER on "verify as viewer", "check it as a client", "check the 404 as a viewer", "test the VIEWER gate", "/verify-as-viewer", or whenever a change touches `requireAssetAccess`, `AssetViewerAccess`, `canSeeContactDetails`, or any page under `src/app/(protected)/assets/`.
---

# Verify as viewer

## Why local

The Browser pane refuses `*.vercel.app` URLs by policy, and the Claude in
Chrome extension is often not connected — so a PR preview cannot reliably be
opened from here. Run the branch locally instead: the local Postgres is
seeded with admin/editor/viewer/investor demo accounts, and the login page
shows dev-only quick-login buttons (gated by `NODE_ENV === "development"`).

## Routing

This is browser-driving plus DB lookups, not judgment work. Run it on
Sonnet 5 — or delegate to a Sonnet subagent when the main loop is Fable. The
main loop should only read back the three-line result.

## Steps

1. Confirm `git status` is clean. Note that `next dev` rewrites
   `tsconfig.json` on startup — it must be reverted with
   `git checkout -- tsconfig.json` before any commit.
2. Start the server with the Browser pane tool `preview_start {name: "dev"}`
   — never Bash.
3. Run `lookup` via the script (see below) and pick a tracking with nonzero
   `stageHistoryCount` / `commentCount` / `documentCount`. Never reuse ids
   from an earlier session — the shared local DB gets re-seeded and ids
   change.
4. Sign out via `/api/auth/signout` (click its button), go to `/login`,
   click **Viewer**. Confirm the role with javascript_tool:
   `(await fetch("/api/auth/session").then(r=>r.json()))?.user?.role` — don't
   trust the click alone.
5. Denied path: open `/assets/<assetId>/...` (the page under test). Expect
   the 404 page, not a login redirect.
6. Granted path: `grant <assetId>`, reload the page. Expect it to render
   with "Team member" / "Counterparty" instead of staff or signer names —
   `canSeeContactDetails` is false for VIEWER.
7. Control: sign out, quick-login **Editor**, load the same URL. Expect real
   names to show.
8. `revoke <assetId>` to leave the DB as found. `preview_stop`. Revert
   `tsconfig.json` if it changed.
9. Report as three lines — VIEWER denied / VIEWER granted / EDITOR — each
   with the observed role and outcome. Attach a screenshot only if something
   looks off.

### `scripts/viewer-access.ts`

```
DATABASE_URL="$(grep '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')" \
  npx tsx .claude/skills/verify-as-viewer/scripts/viewer-access.ts <command>
```

(`tsx` does not auto-load `.env`; run from the worktree root.)

- `lookup` — VIEWER users, their `AssetViewerAccess` rows, and up to 10
  trackings (id, assetId, asset title, company name, and stageHistory /
  comment / document counts) to help you pick one with history.
- `grant <assetId> [email]` — upserts an `AssetViewerAccess` row (default
  `viewer@example.com`), prints the row id.
- `revoke <assetId> [email]` — deletes that row, prints the count deleted.

## Traps

- Stale worktree `node_modules` — run `npm ci` in the worktree. The global
  worktree-guard hook allows `ci` there since 2026-09-07; `install`/`add`/`remove`
  are still denied.
- Run `npx prisma generate` after merging in schema changes, before `tsc`.
- `psql` is not on PATH — use the script above for all DB lookups.
- The permission classifier denies prod DB queries. Never plan a
  verification flow around live prod DB lookups — local only.
