# Compliance — Investment Tracker (DILS Investor Portal)

> **Status:** Working drafts prepared 2026-06-22 from the [GDPR/AVG compliance audit](https://github.com/). **Not legal advice.** Every document here must be reviewed and signed off by a qualified Dutch privacy lawyer / DPO before it is relied on. Controller-vs-processor role and Wwft/AFM scope in particular need counsel.

The portal is operated by **Dils Netherlands B.V.** (KvK 33.180.131 · BTW NL0073.12.969.B.01 · Gustav Mahlerplein 72, 1082 MA Amsterdam · `privacy.netherlands@dils.com`). It inherits the company's existing privacy framework ([dils.nl/privacyverklaring](https://dils.nl/privacyverklaring/), Cookiebot consent, the AP complaint route). These documents fill the **portal-specific** gaps that the company statement does not yet cover.

## Index

| # | Document | Obligation | Status |
|---|---|---|---|
| 1 | [privacy-statement-portal-addendum.md](privacy-statement-portal-addendum.md) | Art. 13–14 transparency | ⚖️ Draft → **legal review** |
| 2 | [record-of-processing-activities.md](record-of-processing-activities.md) | Art. 30 RoPA | ✅ Draft (maintain) |
| 3 | [data-retention-schedule.md](data-retention-schedule.md) | Art. 5(1)(e) | ✅ Draft + enforced by purge script |
| 4 | [subprocessors-and-dpa-register.md](subprocessors-and-dpa-register.md) | Art. 28 | ⏳ Sign DPAs (ops) |
| 5 | [lawful-basis-and-LIA.md](lawful-basis-and-LIA.md) | Art. 6 | ⚖️ Draft → legal review |
| 6 | [data-breach-response-runbook.md](data-breach-response-runbook.md) | Art. 33–34 | ✅ Draft (adopt) |
| 7 | [data-subject-request-procedure.md](data-subject-request-procedure.md) | Art. 12–22 | ✅ Draft (adopt) |

## Code shipped alongside these docs

| Area | What | Where |
|---|---|---|
| Retention | Purge of expired/used tokens, expired invites, aged activity logs | `scripts/purge-expired-data.ts` (`npm run purge:dry` / `npm run purge`) |
| Data-subject access/portability | Per-person data export (JSON) | `src/actions/data-export-actions.ts` |
| Security (Art. 32) | PII redacted from server logs | `src/lib/log-redact.ts` + call sites |
| UAVG Art. 46 | BSN / sensitive-data guard on free-text fields | `src/lib/validators.ts` (`assertNoBSN`) |
| Transparency | Privacy + cookie links surfaced in-app | login / invite-accept / portal footer |

## Open ops / human actions (cannot be done in code)

- [ ] **Sign & file the 4 sub-processor DPAs** — see register (doc 4).
- [x] **Supabase region confirmed: EU — Ireland (`eu-west-1`)** ✅ (primary data stays in-EEA).
- [ ] **Confirm remaining regions**: Upstash/KV region (EU); **confirm Vercel DPF** active. Record in the RoPA. See checklist below.
- [ ] **Get docs 1 & 5 reviewed by Dutch counsel**; confirm controller/processor role and Wwft/AFM scope.
- [x] **Admin credential rotated** to a strong hashed password ✅ (no published-credential risk).
- [ ] **Verify the other seeded demo accounts** (`editor@example.com`, `viewer@example.com`, any demo investor) don't still exist in the **production** DB with the default `password123` — delete or deactivate + scramble. Optional: rename the admin login off `admin@example.com`.
- [ ] **MFA** for admin/internal accounts — plan ready in [mfa-implementation-plan.md](mfa-implementation-plan.md); kickstart when ready.

## Transfer-verification checklist (Art. 44–49)

1. **Supabase** → ✅ **confirmed EU — Ireland (`eu-west-1`)**. Remaining: accept the [Supabase DPA](https://supabase.com/legal/dpa) (SCCs).
2. **Upstash / Vercel KV** → confirm the Redis database region is EU; confirm DPA.
3. **Vercel** → confirm the project's functions region is EU (`fra1`/`ams`...) and that Vercel's [EU-US DPF certification](https://vercel.com/changelog/vercel-is-now-certified-under-the-eu-us-data-privacy-framework-dpf) is active at go-live.
4. **Mailgun** → already on the EU endpoint (`api.eu.mailgun.net`); confirm the Mailgun/Sinch DPA is signed.
5. Record each result (region + transfer basis + DPA date) in the RoPA, §Recipients & transfers.
