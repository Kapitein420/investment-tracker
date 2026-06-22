# Admin MFA — implementation plan (Art. 32)

> **Status: NOT IMPLEMENTED (planned).** Authentication today is NextAuth Credentials (email + bcrypt-12 password, JWT sessions, login rate-limiting, session rotation/invalidation). There is no second factor. MFA for privileged accounts is the top open Art. 32 hardening item. This plan lets you kickstart it when ready. **Estimated effort: ~2–3 focused days.**

## Goal
TOTP (authenticator-app) two-factor auth, **mandatory for ADMIN & EDITOR**, optional for VIEWER/INVESTOR. TOTP is the simplest fit for the existing Credentials provider; passkeys/WebAuthn is a stronger future option (noted at the end).

## Recommended approach — TOTP integrated into the Credentials flow

### Phase 1 — Schema & secret storage (~0.5 day)
- Add to `User` in `prisma/schema.prisma`:
  - `totpSecret String?` — **stored encrypted**, never plaintext.
  - `totpEnabled Boolean @default(false)`
  - `mfaEnrolledAt DateTime?`
  - `backupCodes String[]` — store **hashes** of single-use recovery codes (bcrypt/sha256).
- `npx prisma migrate dev` (or the manual-migration pattern in `prisma/migrations-manual/`).
- Add `src/lib/mfa-crypto.ts`: AES-256-GCM encrypt/decrypt of the TOTP secret using a new env key `MFA_ENCRYPTION_KEY` (32-byte, base64). Add to Vercel env + `.env.example`.

### Phase 2 — Enrollment UI (~0.75 day)
- Deps: `otplib` (TOTP) + `qrcode` (QR data-URL). `npm i otplib qrcode && npm i -D @types/qrcode`.
- New settings page (e.g. `/portal/security` or an admin profile section):
  - Generate secret → render `otpauth://` QR + manual key.
  - User enters a 6-digit code to **verify before enabling** (`totpEnabled=true`, stamp `mfaEnrolledAt`).
  - Generate + show **backup codes once**; store hashes.
- Server actions: `beginMfaEnrollment()`, `confirmMfaEnrollment(code)`, `disableMfa(code)` (self), all behind `requireUser()`.

### Phase 3 — Login integration (~0.5 day)
- Add an optional `totp` field to the Credentials `authorize()` input (`src/lib/auth.ts`).
- After the password check, if `user.totpEnabled`:
  - If `totp` missing → return `null` with a distinct signal so the login UI reveals the 6-digit field on the second submit.
  - Verify with `authenticator.verify({ token, secret })` (small window for clock drift). Accept a valid **backup code** as an alternative (consume it).
- Update `src/app/login/page.tsx` to show the code field when prompted.

### Phase 4 — Enforcement & recovery (~0.5 day)
- **Force-enrollment** for ADMIN/EDITOR: reuse the existing first-login gate pattern (like `passwordChangedAt` in `middleware.ts`) — redirect privileged users without `totpEnabled` to the enrollment page before any other route.
- **Admin reset:** `resetUserMfa(userId)` (ADMIN only) clears `totpSecret`/`totpEnabled` so a locked-out user can re-enroll; log to `ActivityLog`.
- Rate-limit TOTP attempts (reuse `checkRateLimit`, e.g. key `mfa:userId`).

### Phase 5 — Tests & docs (~0.25 day)
- Unit tests: secret encrypt/decrypt round-trip; TOTP verify (valid/expired/drift); backup-code single-use.
- Update `compliance/record-of-processing-activities.md` §C and the audit (Art. 32) to mark MFA done.

## Dependencies
`otplib`, `qrcode`, `@types/qrcode`; one new env var `MFA_ENCRYPTION_KEY`.

## Risks / notes
- **Edge runtime:** `authorize()` runs server-side (Node), so `otplib`/`crypto` are fine; keep MFA code out of any edge middleware bundle.
- **Account lockout:** backup codes + admin reset are essential before enforcing.
- **Alternative — WebAuthn/passkeys:** phishing-resistant and increasingly expected; larger lift and a different UX. Reasonable as a v2 once TOTP ships.

## Kickstart checklist
- [ ] Add schema fields + migration (Phase 1)
- [ ] `MFA_ENCRYPTION_KEY` in Vercel + `.env.example`
- [ ] Install `otplib` + `qrcode`
- [ ] Enrollment page + actions (Phase 2)
- [ ] Login `totp` field + verify (Phase 3)
- [ ] Force-enroll ADMIN/EDITOR + admin reset (Phase 4)
- [ ] Tests + update RoPA/audit (Phase 5)
