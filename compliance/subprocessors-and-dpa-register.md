# Sub-processor & DPA register — Art. 28 GDPR

> **Controller:** Dils Netherlands B.V. Every party below processes personal data on our behalf and **must** be covered by a signed data-processing agreement (verwerkersovereenkomst). Operating without one is a breach by both parties. Keep this register current; review on any vendor change.
> **Last reviewed:** 2026-06-22.

| # | Sub-processor | Legal entity / parent | Purpose | Data processed | Region (verify) | Transfer basis | DPA link | DPA status |
|---|---|---|---|---|---|---|---|---|
| 1 | **Supabase** | Supabase Inc. (US) | Postgres database + document storage | All portal personal data; signed PDFs; signature images | ✅ EU — Ireland (`eu-west-1`) | SCCs (in DPA) | https://supabase.com/legal/dpa | ☐ accept & file |
| 2 | **Vercel** | Vercel Inc. (US) | Application hosting / serverless functions | Request data, platform logs, all data in transit | ☐ confirm EU function region | EU-US DPF (+ SCCs) | https://vercel.com/legal/dpa | ☐ accept & file |
| 3 | **Mailgun** | Sinch / Mailgun (US parent, EU region) | Transactional email delivery | Recipient name & email; email content | EU (`api.eu.mailgun.net`) | DPA / SCCs | https://www.mailgun.com/legal/dpa/ | ☐ sign & file |
| 4 | **Upstash / Vercel KV** | Upstash Inc. (US) | Rate-limit counters (security) | Email + IP (short-lived keys) | ☐ confirm EU region | DPA / SCCs | https://upstash.com/trust/dpa.pdf | ☐ sign & file |

## Required DPA clauses (Art. 28(3)) — verify each vendor's DPA contains them
- Process only on the controller's documented instructions.
- Confidentiality commitments for personnel.
- Art. 32 security measures.
- Sub-processor controls: prior authorisation + flow-down of equivalent terms.
- Assistance with data-subject-rights requests.
- Assistance with breach notification and DPIAs.
- Delete or return all personal data at end of service.
- Submit to audits / provide compliance evidence.

## Actions
- [ ] Accept the Supabase DPA (online) and download a copy to this folder / DMS.
- [ ] Accept the Vercel DPA and record DPF confirmation.
- [ ] Sign the Mailgun/Sinch DPA.
- [ ] Sign the Upstash DPA.
- [ ] Note each signed date in the table; re-link from the privacy-statement addendum ("available on request").
