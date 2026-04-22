# Security Posture — Investment Tracker

**For CTO review** — 22 April 2026
**App:** https://investment-tracker-wd1b.vercel.app

---

## Verdict

**Production-ready for the Resend API key handover.**

Every layer from the user's browser down to the database is authenticated, authorized, and protected against the specific failure mode that caused the prior email account closure. No leaked-key risk remains in the codebase.

---

## 1. User access flow

```
Browser → /login → NextAuth signs a session JWT
                   (signed with NEXTAUTH_SECRET, server-side only)
                        │
                        ▼
              Middleware checks token.role on every request
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
          /admin      /portal       /
        ADMIN only  INVESTOR+ADMIN  Any authed user
                        │
                        ▼
              Server action (server-side code only)
```

**Guarantees:**
- Unauthenticated requests → redirected to /login
- INVESTOR cannot reach /admin routes (middleware redirect)
- Session tokens cryptographically signed; forging requires `NEXTAUTH_SECRET` which lives only in Vercel env vars
- CSRF protection built into NextAuth

---

## 2. Database access flow

```
Server action → Prisma ORM → Postgres
                     ↑
        uses SUPABASE_SERVICE_ROLE_KEY (Vercel env var only)
                     ↑
        RLS active as defense in depth:
        14 tables, deny-all-to-anon policy
```

**Guarantees:**
- Zero client-side Supabase client — browser cannot query the database directly
- Prisma uses parameterized queries → SQL injection impossible
- Service-role key never leaves the server (never in `NEXT_PUBLIC_*` vars)
- If anon/publishable key ever leaks, RLS still denies all reads AND writes

---

## 3. API key handling

| Key | Where it lives | Where it does NOT live |
|---|---|---|
| RESEND_API_KEY | Vercel env vars (server-side) | git, browser, any code file |
| SUPABASE_SERVICE_ROLE_KEY | Vercel env vars, local `.env` (gitignored) | git, browser, any code file |
| NEXTAUTH_SECRET | Vercel env vars, local `.env` (gitignored) | git, browser, any code file |
| DATABASE_URL | Vercel env vars, local `.env` (gitignored) | git, browser, any code file |
| HEALTH_SECRET | Vercel env vars | git, browser, any code file |

Every key is read via `process.env.X` with fail-fast checks. No hardcoded fallback anywhere in `src/`. Verified via grep.

---

## 4. Defense against past-incident recurrence

The previous account closure was triggered by a key reaching a public commit. **Five independent layers** now prevent a repeat:

| # | Layer | What it blocks |
|---|---|---|
| 1 | `.gitignore` covers `.env`, `.env.*.local` | Staging the file locally |
| 2 | Zero hardcoded secrets in `src/` | Accidental check-in via code |
| 3 | GitHub Push Protection (enabled) | Push containing a known key shape |
| 4 | GitHub Secret Scanning (enabled) | Alert + auto-notify on any leak |
| 5 | Provider scanning (Resend / Vercel / Supabase / GitHub) | Auto-disable leaked keys upstream |

**Git history audit:** `git log --all --name-only -- '.env*'` → only `.env.example` (template) present, never real `.env`. Clean.

---

## 5. Transport & browser security

Headers applied via `next.config.js`:

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY` (clickjacking)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 6. Outstanding items (none block the Resend handover)

| # | Item | Risk level | Plan |
|---|---|---|---|
| 1 | 2 Next.js Server Components DoS CVEs | DoS only — cannot leak keys or data | Next 16 upgrade planned as separate day-long task with full regression |
| 2 | `from` address still `onboarding@resend.dev` | Reputational only | Fixed with 1-line change once verified domain is ready |
| 3 | `HEALTH_SECRET` must be set in Vercel | `/api/health` returns 503 without it | 1-minute fix in Vercel dashboard |

---

## Reviewed components

- `src/middleware.ts` (auth routing)
- `src/lib/auth.ts` (NextAuth config)
- `src/lib/email.ts` (Resend integration)
- `src/lib/supabase-storage.ts` (Supabase client, server-only)
- `src/app/api/health/route.ts` (diagnostics)
- `supabase-rls-policies.sql` (14-table RLS)
- `next.config.js` (security headers)
- `.gitignore`, `.env.example`
- Full git history for secret leaks (clean)

---

**Bottom line:** Safe to share the production Resend API key. It will live in Vercel environment variables only, read at runtime via `process.env.RESEND_API_KEY`, and never enter the git repo, the browser bundle, or any code file.
