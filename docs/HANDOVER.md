# Handover — Investment Tracker (DILS Investor Portal)

> **Status:** Bridging period. Ownership sits with **Dils Netherlands B.V.**; the accounts
> that run the app are still held by the original developer on Dils's behalf until the
> structural migration in §7. The formal arrangement is
> [compliance/bridging-arrangement-2026-09.md](../compliance/bridging-arrangement-2026-09.md).
> **Last updated:** 2026-09-29.
>
> **This repository is currently public.** Nothing in this file may contain secrets,
> credentials, record ids or personal data. Secrets live in Vercel → Settings →
> Environment Variables only.

## 1. What this is

An internal deal-pipeline tracker for Dils capital-markets teams plus an investor-facing
portal (NDA and document e-signing, deal-room access, offer submission). It is a
deliberately lightweight **"0.5" bridge app**: it closes a day-to-day gap until **DILS Next**
can deliver the same, and is built to be absorbed by DILS Next. It is **not** a CRM and must
not compete with the main CRM. Keep that framing in any stakeholder material.

## 2. Roles

| Role | Who | Responsibility |
|---|---|---|
| Controller (verwerkingsverantwoordelijke) | Dils Netherlands B.V. | Owns the code, the data and the processing |
| Technical owner (from handover) | Captain-1000 — *name, role to fill in* | Deploys, access management, incident first response |
| Bridging account holder | Original developer (GitHub `Kapitein420`) | Holds GitHub/Vercel/Supabase accounts on instruction of Dils until §7 is done |
| Privacy contact | `privacy.netherlands@dils.com` | DSARs, breach intake — the existing company channel |

## 3. Stack and where things run

| Layer | Service | Notes |
|---|---|---|
| Code | GitHub `Kapitein420/investment-tracker` | Branch `master` = production. PR-only workflow; nothing is pushed to master directly |
| Hosting | Vercel | Deploys on merge to `master`. Functions pinned to `fra1` (`vercel.json`) |
| Database + file storage | Supabase project **"IM Tool 1.0"**, EU — Ireland (`eu-west-1`) | Postgres via the **Transaction Pooler (port 6543)** — session mode caps at 15 clients and breaks under load |
| Email | Mailgun, EU endpoint | Invites, NDA approvals, password-set links, receipts |
| Rate limiting | Upstash / Vercel KV | Region still to confirm (see compliance) |
| CI | GitHub Actions `.github/workflows/ci.yml` | `verify` (db push, seed, tests, PDF smoke, build) + weekly `npm audit` |

Framework: Next.js 16 (App Router), React 19, TypeScript, Prisma, NextAuth v4 (credentials),
Tailwind + shadcn/ui, Vitest. See [README.md](../README.md) for local setup and
[.env.example](../.env.example) for every environment variable and what it is for.

## 4. Access model (read before changing auth)

- Roles: `ADMIN`, `EDITOR`, `VIEWER`, `INVESTOR`.
- ADMIN and EDITOR are **global by design** — no per-asset scoping. Security scanners flag
  this as IDOR; it is intended.
- VIEWER is gated per asset through `AssetViewerAccess` (`requireAssetAccess`).
- INVESTOR sees only the portal, scoped by company. Investors can belong to several companies
  via `UserCompanyMembership` (`src/lib/user-companies.ts`).
- Login lockout: 10 failed attempts → 15 min, admin can unlock. No MFA yet.

## 5. Running it

- **Deploy:** merge a PR into `master`; Vercel builds and deploys. There is no manual step.
- **Schema changes:** the repo has manual SQL migrations in `prisma/migrations-manual/`. Apply
  the migration to production **before** merging the code that needs it.
- **Launch window:** the `launch-mode` skill (`.claude/skills/launch-mode/`) temporarily
  triples login/reset rate limits for an investor onboarding burst. Turn it off afterwards.
- **Verifying a change as a client:** `.claude/skills/verify-as-viewer/` runs the branch
  locally and logs in per role.
- **Local dev:** local Postgres + `npx prisma db push` + `npm run db:seed` + `npm run dev`.
  The seed wipes core tables and creates known-password demo accounts; it refuses to run
  with `NODE_ENV=production`. `tsx` and Vitest don't auto-load `.env` — pass
  `DATABASE_URL` inline.

## 6. Known issues and traps

| Item | Impact | State |
|---|---|---|
| Duplicate company names in production (two companies called "DRC") | Signed-document access can be denied when an investor's legacy `User.companyId` differs from the tracking's company. `src/actions/document-actions.ts` still checks the legacy single company, not `getUserCompanyIds()` | Open — migrate the check, reconcile the rows |
| `npm run lint` is broken | `next lint` was removed in Next 16 and there is no ESLint config; linting has never run | Open |
| `revalidatePath` → tag-based revalidation | ~60 call sites in `src/actions/*`; performance only | Open, needs a plan |
| `next build` needs `DATABASE_URL` set | Prisma is constructed at module scope; any dummy value works | By design; the `Dockerfile` does not account for it |
| One test file is DB-backed and self-skips without `DATABASE_URL` | "All tests pass" locally may not include it; CI runs it for real | By design |
| CSP and PDF viewers | `object-src` also governs `<embed>`; `'none'` blanked every PDF viewer in prod for a month (fixed #133). Test CSP changes in a real browser | Resolved; keep in mind |
| Stale branches | Old PRs conflicted with later security fixes every time. Never resolve a conflict by picking a side | Process rule |

## 7. Compliance

Everything lives in [compliance/](../compliance/README.md) — start with its index and the
"Open ops / human actions" list. Summary at handover:

- GDPR/AVG, Telecommunicatiewet, Wwft (Dils is a Wwft institution), e-signature evidence,
  trade secrets, WOR and retention all apply; the 15 gaps (G1–G15) all have code or
  documents in production.
- **Still open, owned by Dils:** sign the 4 sub-processor DPAs, confirm the Upstash region,
  arm the retention purge (`PURGE_ENABLED`) after sign-off, MFA for internal accounts,
  counsel review of the privacy addendum, LIA, portal terms and Wwft scope, and the works
  council (OR) consent for the audit log.

## 8. Migration to Dils-owned accounts (after go-live)

Not done during the bridging period on purpose — no structural change right before launch.
Order, once the launch is stable:

1. Make the repository **private** (no code change; costs GitHub Actions minutes).
2. Create a Dils-owned GitHub Organization with at least two Owners (Captain-1000 + one more).
3. Transfer the repository into it; reconnect the Vercel Git integration; check Actions
   secrets and Dependabot.
4. Transfer the Vercel project to a Dils team and the Supabase project to a Dils organization;
   move billing to Dils.
5. Rotate every secret in `.env.example` (`NEXTAUTH_SECRET` signs everyone out — plan it).
6. Update the sub-processor register and RoPA with the new account owners.
7. Reduce the bridging account holder to member or remove them; close the bridging
   arrangement in writing.

## 9. History worth knowing

| Date | Event |
|---|---|
| 2026-06-21 | Next 14 → 16, React 19 security upgrade (#125), perf + security pass (#127) |
| 2026-06-22 | GDPR/AVG audit; remediation merged only on 2026-09-07 (#170) after sitting unmerged 11 weeks |
| 2026-07-22 | CSP outage on the signing route fixed (#133) |
| 2026-08-26 | First CI workflow (#160/#161) |
| 2026-09-07 | EU/NL legal landscape research; G1–G15 remediation shipped (#172–#199) |
