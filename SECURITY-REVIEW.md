# Security Review — Investment Tracker

**App:** https://investment-tracker-wd1b.vercel.app
**Supabase project:** `uyxualynbqmchugzvdpc` (IM Tool 1.0)
**Email provider:** Resend
**Date:** 2026-04-22
**Purpose:** Pre-clearance check before granting access to the production domain email API key.

---

## TL;DR for the CTO

The investment-tracker is the strongest-security app in the repo — NextAuth + role-based middleware + 14-table RLS with deny-all policy + server-only key handling. The pattern for holding a production email API key is **already correct**. Main outstanding work is fixing 4 Next.js CVEs and documenting the missing env vars.

| Area | Status |
|---|---|
| Secrets in git history | ✅ Clean — only `.env.example` (template), never real `.env` |
| `.env` gitignore | ✅ Covered by `.env` and `.env*.local` patterns |
| Resend key handling | ✅ `process.env.RESEND_API_KEY`, server-side only, never in client bundle |
| Supabase service-role key | ✅ Server-side only, used by `supabase-storage.ts` |
| Publishable / anon key in browser | ✅ None — app has zero client-side Supabase client |
| Row-Level Security | ✅ Enabled on all 14 tables with "deny all to anon" policy |
| Auth layer | ✅ NextAuth + JWT middleware, role-based (ADMIN / INVESTOR) |
| Route protection | ✅ `/admin/*`, `/portal/*`, `/` gated at middleware |
| Health endpoint | ✅ Protected by `HEALTH_SECRET`, returns booleans not values |
| Next.js version | 🔴 **v14.2.23** — 4 high-severity CVEs, upgrade to v15+ recommended |
| `.env.example` completeness | ⚠️ Missing `RESEND_API_KEY` and `HEALTH_SECRET` |
| Production email "from" | ⚠️ Currently `onboarding@resend.dev` (Resend sandbox) — needs verified domain |
| CI secret scanning | ⚠️ No GitHub Actions workflow in this repo |

**Recommendation:** Safe to hand over the production Resend API key. The handling pattern is correct. Fix the 4 Next.js CVEs in parallel — they're DoS-only (not RCE), so they don't block the key handover.

---

## Findings

### ⚠️ 1. Next.js patched from 14.2.23 → 14.2.35 (latest backport); 2 CVEs require Next 16

`npm audit` initially flagged 5 advisories. I bumped to **`next@14.2.35`** (latest patch in the `next-14` backport branch, no breaking changes) and checked each advisory against actual usage:

| Advisory | Type | This app affected? |
|---|---|---|
| GHSA-9g9p-9gw9-jx7f | DoS via Image Optimizer `remotePatterns` | ❌ No — app has no `remotePatterns` config; also Vercel-hosted (CVE targets self-hosted) |
| GHSA-3x4c-7xq6-9pq8 | next/image disk cache growth | ❌ No — Vercel manages image caches |
| GHSA-ggv3-7p47-pfv8 | HTTP request smuggling in `rewrites` | ❌ No — app doesn't use `rewrites` |
| GHSA-h25m-26qc-wcjf | Server Components deserialization DoS | ⚠️ Yes — app uses Server Components |
| GHSA-q4gf-8mx6-v5v3 | DoS with Server Components | ⚠️ Yes — same |

**Net exposure:** 2 Server Components DoS advisories. These let an attacker **waste server resources**, not steal keys or data. The Resend key and Supabase service-role key are completely unaffected — these CVEs can't reach `process.env`.

**Full fix** requires Next 16, which needs React 19 and async `cookies()` / `headers()` / `params` / `searchParams` migration — a deliberate upgrade effort, not a drive-by. Plan it as a separate 1-day task with end-to-end testing of the 14 RLS tables' server actions.

**Also added HSTS header** to `next.config.js` (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`) for HTTPS enforcement.

---

### ⚠️ 2. Production email uses Resend's sandbox domain

[`src/lib/email.ts:20`](src/lib/email.ts):
```ts
from: "Investment Tracker <onboarding@resend.dev>",
```

`onboarding@resend.dev` is Resend's shared test domain. It's rate-limited, has poor deliverability, and looks unprofessional to investors opening invites. This is probably why the CTO is gatekeeping — the domain needs to be verified in Resend and the `from` address switched over.

**Fix (once the domain is verified):**
```ts
from: "Investment Tracker <noreply@yourdomain.com>",
```
Keep the display name in angle brackets — most email clients render it nicely.

---

### ⚠️ 3. `.env.example` is missing variables the code actually uses

Code references these env vars but `.env.example` doesn't list them:

- `RESEND_API_KEY` — without this, `sendEmail()` silently skips sending (with a console log)
- `HEALTH_SECRET` — without this, `/api/health` returns 503 in production

**Fix:** add them to `.env.example` with placeholder values so new devs / CI know they exist.

---

### ⚠️ 4. No CI secret scanning workflow in this repo

Investment-tracker has its own git repo and doesn't inherit the GitHub Actions I set up on `my-projects`. Relies purely on GitHub's built-in Push Protection + Secret Scanning (which I assume are on — verify at Settings → Code security and analysis).

**Fix:** copy `.github/workflows/secret-scan.yml` from `my-projects` into this repo, or confirm GitHub push protection is enabled (simpler, same protection for common patterns).

---

## What's done right (the big green checks)

| Layer | Evidence |
|---|---|
| **NextAuth with middleware** | [`src/middleware.ts`](src/middleware.ts) — `withAuth` + role-based redirects (`INVESTOR`, `ADMIN`). Routes `/admin`, `/portal`, `/`, `/assets` all gated. |
| **No client-side Supabase** | Only [`src/lib/supabase-storage.ts`](src/lib/supabase-storage.ts) creates a Supabase client, and it uses `SUPABASE_SERVICE_ROLE_KEY` — pure server-side. No publishable/anon key is ever sent to the browser. |
| **RLS as defense in depth** | [`supabase-rls-policies.sql`](supabase-rls-policies.sql) enables RLS on all 14 tables (`User`, `Asset`, `Company`, `PipelineStage`, `AssetCompanyTracking`, `StageStatus`, `Comment`, `StageHistory`, `ActivityLog`, `SavedView`, `Document`, `SigningToken`, `InvestorInvite`, `AssetContent`) with explicit deny-to-anon. Service role bypasses, as designed. |
| **Secrets in env only** | All 10 referenced env vars read via `process.env.X`, no hardcoded fallbacks anywhere in `src/`. |
| **Resend key handling** | [`src/lib/email.ts`](src/lib/email.ts) initialises `new Resend(process.env.RESEND_API_KEY)` at module scope, and `sendEmail()` falls back to a log-skip if missing — fails safe, not fails loud. |
| **Health endpoint** | [`src/app/api/health/route.ts`](src/app/api/health/route.ts) gated by `HEALTH_SECRET`, returns `Boolean(process.env.X)` only — never surfaces values. |
| **Git hygiene** | Real `.env` never committed; only `.env.example` (template with placeholders). Verified via `git log --all --name-only -- .env*`. |

---

## Email API key handover checklist

Hand these steps to whoever holds the key:

1. **Verify the domain in Resend dashboard** (https://resend.com/domains)
   - Add your domain, paste the DNS records into your DNS provider, wait for verification
2. **Generate the production API key** tied to that verified domain
3. **Add to Vercel env vars** — Production + Preview environments:
   - `RESEND_API_KEY` = `re_...`
4. **Update `src/lib/email.ts` line 20** — change `from` to use the verified domain
5. **Redeploy** — Vercel rebuilds automatically on next push, or trigger via dashboard
6. **Smoke test:** use the invite flow to send a test email to yourself, confirm it lands and "from" shows the verified domain
7. **Verify the key is NOT present locally** — `grep -r "re_" src/` should return nothing

**Never:**
- Paste the key into `src/lib/email.ts` directly
- Commit a `.env` file containing it
- Send it in Slack / email / any chat
- Add it to any `NEXT_PUBLIC_*` variable (that would inline it into the browser bundle)

---

## Files reviewed

- [src/middleware.ts](src/middleware.ts) — NextAuth route protection
- [src/lib/email.ts](src/lib/email.ts) — Resend integration
- [src/lib/supabase-storage.ts](src/lib/supabase-storage.ts) — Supabase client (server-only)
- [src/lib/auth.ts](src/lib/auth.ts) — NextAuth config
- [src/app/api/health/route.ts](src/app/api/health/route.ts) — health diagnostics
- [supabase-rls-policies.sql](supabase-rls-policies.sql) — 14-table RLS
- [supabase-setup.sql](supabase-setup.sql) — schema
- [.env.example](.env.example) — env template
- [.gitignore](.gitignore) — env file coverage
- git history for `.env*` leaks — clean
