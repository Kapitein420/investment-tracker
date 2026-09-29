# Bridging arrangement (overbruggingsregeling) — Investment Tracker accounts

> **Status:** Draft 2026-09-29. **Not legal advice** — review with Dutch counsel before
> signing. Fill in every *[placeholder]*. Once signed, store the signed copy in the Dils DMS,
> not in this (public) repository.

## 1. Parties

- **Dils Netherlands B.V.** (KvK 33.180.131), Gustav Mahlerplein 72, 1082 MA Amsterdam —
  "**Dils**", represented by *[name, function]*.
- *[Full name of the developer]*, employee of Dils — "**Account Holder**".
- *[Full name]* (GitHub `Captain-1000`), *[function]* — "**Technical Owner**".

## 2. Background

The Investment Tracker / DILS Investor Portal ("**the Application**") was developed for Dils.
Its source code, hosting and database currently run under accounts registered to the Account
Holder personally:

| Service | Account | Holds |
|---|---|---|
| GitHub | `Kapitein420` (personal) | Source code, CI, issue history |
| Vercel | *[account / team name]* | Hosting, environment variables (secrets) |
| Supabase | *[organization name]*, project "IM Tool 1.0" | Database and document storage (personal data) |
| Mailgun | *[account]* | Email delivery |
| Upstash / Vercel KV | *[account]* | Rate-limit counters |

To avoid disruption around the go-live of *[date]*, these accounts will not be moved until
after that date. This arrangement records who is responsible in the meantime.

## 3. Agreements

1. **Ownership.** All intellectual property in the Application, including source code,
   documentation and data, belongs to Dils. The Account Holder holds the accounts in §2
   solely on behalf of and on the instruction of Dils.
2. **Controller.** Dils is the controller (verwerkingsverantwoordelijke) under the GDPR for
   all personal data processed in the Application. The service providers in §2 are Dils's
   processors and are recorded as such in the
   [sub-processor register](subprocessors-and-dpa-register.md) and the
   [record of processing activities](record-of-processing-activities.md).
3. **Instructions.** The Account Holder acts only on instructions from Dils, through the
   Technical Owner or *[name/function]*. The Account Holder does not use the accounts or the
   data for any other purpose.
4. **Access.** Access to production during the bridging period is limited to the persons in
   Annex A. Any change to that list is recorded in Annex A with date and reason.
5. **Security.** The Account Holder keeps the accounts secured with strong unique passwords
   and two-factor authentication, and does not share credentials outside Annex A.
6. **Incidents.** Any (suspected) data breach is reported without delay to
   `privacy.netherlands@dils.com` and handled under the
   [data breach response runbook](data-breach-response-runbook.md).
7. **Confidentiality.** The Account Holder's existing confidentiality obligations under the
   employment contract apply to everything in the accounts.
8. **Handover.** The technical handover is documented in [docs/HANDOVER.md](../docs/HANDOVER.md).
   The Account Holder remains available to the Technical Owner for questions during the
   bridging period.
9. **Migration.** No later than **[end date — suggested 2026-11-30]**, the accounts in §2 are
   transferred to accounts owned by Dils (steps in `docs/HANDOVER.md` §8), all secrets are
   rotated, and the Account Holder's access is reduced to what Dils decides.
10. **End.** This arrangement ends when Dils confirms in writing that the migration in point 9
    is complete. If the Account Holder leaves Dils before then, the migration is completed
    before their last working day.

## 4. Signatures

| Party | Name | Date | Signature |
|---|---|---|---|
| Dils Netherlands B.V. | | | |
| Account Holder | | | |
| Technical Owner | | | |

## Annex A — Production access list

| Person | Role | Services | Since | Reason |
|---|---|---|---|---|
| *[Account Holder]* | Account Holder | GitHub, Vercel, Supabase, Mailgun, Upstash | *[date]* | Developer |
| *[Technical Owner]* | Technical Owner | *[services]* | *[date]* | Handover |
