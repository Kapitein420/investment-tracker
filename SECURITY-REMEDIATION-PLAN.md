# Security Remediation — Execution Plan

**Branch:** `claude/codebase-security-mythos-xcjocc`  ·  **PR:** #105
**Status when written:** ~25 of 26 audit findings fixed *in code on the branch*. Nothing merged or deployed. Fixes are hand-reviewed but **not build-verified** (authored in an environment with no deps/network). Do the steps below in order — Step 0 first, it's an active hole.

---

## Step 0 — URGENT: production database account cleanup (do this FIRST)

The audit found seeded accounts with **published passwords**, and `scripts/load-test.mjs` points at the production URL with those exact creds — so they very likely exist in prod **right now**. An ADMIN account with `password123` on the live app is trivially exploitable. No code change touches existing DB rows; this is manual.

Run against the **production** database (Supabase SQL Editor):
```sql
select id, email, role, "isActive" from "User"
where email in ('admin@example.com','editor@example.com','viewer@example.com',
                'anna@test.dils.com','daan@test.dils.com');
```
For each row returned:
- If it's a **real account** that happens to match → force a password rotation immediately.
- If it's a **seed/test account** → delete it (or deactivate + rotate) and confirm nobody depends on it.

Also rotate `NEXTAUTH_SECRET` if there's any chance it ever used the `.env.example` placeholder, and confirm `HEALTH_SECRET` is set in every deployed environment (the hardened `/api/health` now requires it everywhere).

---

## Step 1 — Get the branch and build-verify

```bash
git fetch origin
git checkout claude/codebase-security-mythos-xcjocc
npm ci
npx tsc --noEmit      # type-check
npm run build         # Next.js production build
npm run lint
```
Most-likely-to-need-attention spots if anything fails:
- `src/lib/auth.ts` + `src/types/next-auth.d.ts` — new JWT fields (`pwChangedAt`, `invalidated`) and the `bcrypt.hashSync` dummy hash.
- `src/lib/sanitize-html.ts` — the `isomorphic-dompurify` import (it pulls in jsdom; should resolve on `npm ci`).

---

## Step 2 — Smoke-test the behavior changes (can't be verified from code review)

1. **NDA signing end-to-end** *(highest priority — most likely to break)*: sign an HTML NDA and confirm the **signature image still renders** and table/inline-style formatting is preserved. If the signature vanishes, adjust `ALLOWED_URI_REGEXP` in `src/lib/sanitize-html.ts` (the `data:image` allowance is the suspect).
2. **Password change → forced re-login**: change a password and confirm the user is logged out of existing sessions. This is the new JWT-invalidation behavior; it's intended, but confirm you're OK with the UX (stateless JWT can't revoke selectively — all sessions drop).
3. **Investor login + portal** still works normally.
4. **Admin invite / password reset** still issues working credentials (CSPRNG + bcrypt cost 12 path).
5. **Deactivating a user** cuts off access on their next request (no 8h wait).
6. **Invite email** renders correctly with the new HTML-escaping.

---

## Step 3 — Apply the database / config changes (not deployed by the build)

- **RLS:** run the updated `supabase-rls-policies.sql` in Supabase SQL Editor. Idempotent; ends with a verify block that throws if any public table lacks RLS. Confirms `UserCompanyMembership`, `CompanyContact`, `AssetViewerAccess` are now covered.
- Confirm Dependabot is now opening PRs (config was previously a non-functional stub).

---

## Step 4 — Merge and deploy

Merge PR #105 once Steps 1–3 are green, then deploy. **Only after deploy are the code fixes actually live.**

---

## Step 5 — Deferred items (decisions / larger work — NOT in PR #105)

1. **Forgot-password redesign (HIGH).** `requestPasswordReset` still rotates the password on request and emails it — anyone who knows a user's email can force-reset them. Real fix: tokenized reset link (random crypto token, hashed at rest, single-use, short expiry) that only rotates the password after the user clicks and sets a new one. Architectural — needs its own PR.
2. **Rate limiter fails open (HIGH).** `src/lib/rate-limit.ts` returns `allowed:true` on backend error and silently falls back to per-instance memory in prod. Decision: make the auth path fail **closed** and hard-require a distributed (Upstash/KV) backend in production. Availability tradeoff — your call.
3. **Dependency advisories.** `next` and `next-auth` have known high-severity issues. Do NOT run `npm audit fix --force` (it downgrades next-auth to 3.x). Plan deliberate version bumps and test.
4. **Mailgun webhook replay store.** Timing-safe comparison is in; full replay protection within the 5-min window needs a persisted seen-token store (small schema add).
5. **`SigningToken`/`InvestorInvite` `cuid()` schema defaults.** Now always overridden in code, but remove the `@default(cuid())` from `prisma/schema.prisma` to kill the footgun (needs a migration + `prisma generate`).

---

## "Are we safe?" checkpoint

Safe to claim only when: Step 0 done (prod accounts cleared), Steps 1–2 green (builds + NDA signing works), Step 3 done (RLS applied), Step 4 done (merged + deployed). Steps 1 and 5.1/5.2 are the gap between "fixed in code" and "safe in production."
