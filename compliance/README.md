# Compliance — Investment Tracker (DILS Investor Portal)

> **Status:** Working drafts prepared 2026-06-22 from the [GDPR/AVG compliance audit](https://github.com/). **Not legal advice.** Every document here must be reviewed and signed off by a qualified Dutch privacy lawyer / DPO before it is relied on. Controller-vs-processor role and Wwft/AFM scope in particular need counsel.

The portal is operated by **Dils Netherlands B.V.** (KvK 33.180.131 · BTW NL0073.12.969.B.01 · Gustav Mahlerplein 72, 1082 MA Amsterdam · `privacy.netherlands@dils.com`). It inherits the company's existing privacy framework ([dils.nl/privacyverklaring](https://dils.nl/privacyverklaring/), Cookiebot consent, the AP complaint route). These documents fill the **portal-specific** gaps that the company statement does not yet cover.

## Index

| # | Document | Obligation | Status |
|---|---|---|---|
| 1 | [privacy-statement-portal-addendum.md](privacy-statement-portal-addendum.md) | Art. 13–14 transparency | ⚖️ Draft → **legal review** |
| 2 | [record-of-processing-activities.md](record-of-processing-activities.md) | Art. 30 RoPA | ✅ Draft (maintain) |
| 3 | [data-retention-schedule.md](data-retention-schedule.md) | Art. 5(1)(e) | ✅ Draft + purge scheduled daily (dry-run; armed via `PURGE_ENABLED=true`) |
| 4 | [subprocessors-and-dpa-register.md](subprocessors-and-dpa-register.md) | Art. 28 | ⏳ Sign DPAs (ops) |
| 5 | [lawful-basis-and-LIA.md](lawful-basis-and-LIA.md) | Art. 6 | ⚖️ Draft → legal review |
| 6 | [data-breach-response-runbook.md](data-breach-response-runbook.md) | Art. 33–34 | ✅ Draft (adopt) |
| 7 | [data-subject-request-procedure.md](data-subject-request-procedure.md) | Art. 12–22 | ✅ Draft (adopt) |
| 8 | [legal-landscape-and-gap-analysis-2026-09.md](legal-landscape-and-gap-analysis-2026-09.md) | All regimes beyond GDPR (Telecommunicatiewet, Wwft, e-sign, trade secrets, WOR, retention) + 15 ranked gaps | 📋 Research (Sept 2026) → §9 status table |
| 9 | [code-fact-sheet-2026-09.md](code-fact-sheet-2026-09.md) | Evidence base with path:line refs and explicit NOT FOUND items | 📋 Evidence (partly superseded, see §14) |
| 10 | [dpia-screening-staff-audit-log.md](dpia-screening-staff-audit-log.md) | Art. 35 GDPR / WP248 | 📋 Draft → Noah/OR |
| 11 | [dpia-screening-investor-portal.md](dpia-screening-investor-portal.md) | Art. 35 GDPR / WP248 | 📋 Draft → Noah/OR |
| 12 | [staff-monitoring-protocol.md](staff-monitoring-protocol.md) | WOR art. 27 lid 1 k+l; AP OR-privacyboekje | 📋 Draft → Noah/OR |
| 13 | [or-instemmingsverzoek-audit-log.md](or-instemmingsverzoek-audit-log.md) | WOR art. 27 lid 1 k+l | 📋 Draft → Noah/OR |

## Code shipped alongside these docs

| Area | What | Where |
|---|---|---|
| Retention | Purge of expired/used tokens, expired invites, aged activity logs | `src/lib/purge.ts`, run manually (`npm run purge:dry` / `npm run purge`) or daily via Vercel Cron (`src/app/api/cron/purge/route.ts`, `vercel.json`, 03:30 UTC) |
| Data-subject access/portability | Per-person data export (JSON) | `src/actions/data-export-actions.ts` |
| Security (Art. 32) | PII redacted from server logs | `src/lib/log-redact.ts` + call sites |
| Security (Art. 32) | One-time set-password links replace emailed plaintext passwords; 15-min lockout after 10 failed logins (G9, MFA still open) | `src/lib/password-set-token.ts`, `src/lib/login-lockout.ts` |
| UAVG Art. 46 | BSN / IBAN / identity-document guard on free-text fields (G14) | `src/lib/validators.ts` (`noBsn`, `noSensitiveIds`) |
| Transparency | Privacy + cookie links surfaced in-app | login / invite-accept / portal footer |
| Telecommunicatiewet 11.7 | Unsubscribe link + `List-Unsubscribe` header + suppression on commercial email | `src/lib/unsubscribe.ts` |
| Telecommunicatiewet 11.7a | Open/click tracking off by default, opt-in via portal preferences, consent evidence in `EmailTrackingConsent` | `src/lib/email-tracking.ts` |
| Wet bescherming bedrijfsgeheimen / Art. 15 | Download logging — every signed-URL issuance for documents and content, all roles | `src/lib/activity-log.ts`, `src/actions/document-actions.ts`, `src/actions/html-nda-actions.ts`, `src/actions/content-actions.ts` |
| NCSC coordinated vulnerability disclosure | `security.txt` + reporting policy | `public/.well-known/security.txt`, `.github/SECURITY.md` |
| Art. 13/14 | In-app `/privacy` notice + shared `PrivacyNotice` component + `CompanyContact.source`/`collectedAt` | `src/components/privacy-notice.tsx` |
| Wwft Art. 3/33 | Buyer-side CDD attestation + NBO soft-gate warning | `src/actions/cdd-actions.ts`, `src/lib/validators.ts`, `src/actions/tracking-actions.ts`, `src/components/asset/tracking-detail-drawer.tsx` |
| BW 3:15a / eIDAS | Signature certificate page, signer copy email, intent confirmation checkbox | `src/lib/pdf-signing.ts`, `src/actions/document-actions.ts`, `src/actions/html-nda-actions.ts`, `src/components/investor/printable-signed-nda.tsx`, `src/components/signing/*` |
| BW 6:234 | Portal terms-of-use click-accept with version/timestamp/IP evidence (G13) | `src/lib/terms.ts`, `src/actions/terms-actions.ts`, `src/app/(investor)/portal/terms/page.tsx`, `src/app/(investor)/portal/(gated)/layout.tsx` |

## Open ops / human actions (cannot be done in code)

- [ ] **Sign & file the 4 sub-processor DPAs** — see register (doc 4).
- [x] **Supabase region confirmed: EU — Ireland (`eu-west-1`)** ✅ (primary data stays in-EEA).
- [ ] **Confirm remaining regions**: Upstash/KV region (EU); **confirm Vercel DPF** active. Record in the RoPA. See checklist below.
- [ ] **Get docs 1 & 5 reviewed by Dutch counsel**; confirm controller/processor role and Wwft/AFM scope.
- [ ] ⚖️ **Portal privacy addendum must describe consent-based open/click tracking** (purpose, Mailgun EU as recipient, withdrawal via `/portal/preferences`).
- [x] **Admin credential rotated** to a strong hashed password ✅ (no published-credential risk).
- [ ] **Verify the other seeded demo accounts** (`editor@example.com`, `viewer@example.com`, any demo investor) don't still exist in the **production** DB with the default `password123` — delete or deactivate + scramble. Optional: rename the admin login off `admin@example.com`.
- [ ] **MFA** for admin/internal accounts — plan ready in [mfa-implementation-plan.md](mfa-implementation-plan.md); kickstart when ready.
- [ ] **Table the audit log for OR instemming; complete the placeholders** in docs 10–13 (OR status, assessor/DPO names, account volume) — see [or-instemmingsverzoek-audit-log.md](or-instemmingsverzoek-audit-log.md).
- [ ] **Set `CRON_SECRET` in Vercel; flip `PURGE_ENABLED` after sign-off; confirm `fra1` region after first deploy.**
- [ ] ⚖️ **Counsel to confirm buy-side CDD scope per pipeline stage** (identity + UBO + sanctions only, or full CDD, and at which stage) — see [legal-landscape-and-gap-analysis-2026-09.md](legal-landscape-and-gap-analysis-2026-09.md) §6 Q2.
- [ ] ⚖️ **Counsel: confirm dils.nl algemene voorwaarden cover portal use, or supply portal-specific terms** → bump `TERMS_VERSION` in `src/lib/terms.ts` (re-prompts every investor for a fresh click-accept).

## Transfer-verification checklist (Art. 44–49)

1. **Supabase** → ✅ **confirmed EU — Ireland (`eu-west-1`)**. Remaining: accept the [Supabase DPA](https://supabase.com/legal/dpa) (SCCs).
2. **Upstash / Vercel KV** → confirm the Redis database region is EU; confirm DPA.
3. **Vercel** → region pinned to `fra1` in `vercel.json` (functions previously ran in Vercel's default US region); confirm the pin took effect after the first deploy. Also confirm Vercel's [EU-US DPF certification](https://vercel.com/changelog/vercel-is-now-certified-under-the-eu-us-data-privacy-framework-dpf) is active at go-live.
4. **Mailgun** → already on the EU endpoint (`api.eu.mailgun.net`); confirm the Mailgun/Sinch DPA is signed.
5. Record each result (region + transfer basis + DPA date) in the RoPA, §Recipients & transfers.
