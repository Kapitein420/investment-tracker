# Data-subject request (DSAR) procedure — Art. 12–22 GDPR

> **Controller:** Dils Netherlands B.V. **Intake:** `privacy.netherlands@dils.com` (the channel already published in the DILS privacy statement — reuse it). **Deadline:** respond without undue delay and **within one month** of receipt; extendable by up to two months for complex/numerous requests if you inform the person (with reasons) within the first month. Normally free of charge. **Last reviewed:** 2026-06-22.

## On receiving a request
1. **Log it** (date received → starts the clock; requester; right(s) invoked).
2. **Verify identity** — confirm the requester is the data subject (e.g. via their known account email); don't disclose to the wrong person.
3. **Locate the data** — by email/user across the database and file storage (see tooling).
4. **Fulfil** per the right (below).
5. **Respond** within the deadline; record the outcome.

## How to fulfil each right (technical)

| Right | How |
|---|---|
| **Access** (Art. 15) | Run the data export for the person (`exportUserData` server action / export script) → returns their account, memberships, comments, signed-document metadata, activity log, invites. Provide a copy. |
| **Portability** (Art. 20) | Provide the same export in the machine-readable **JSON** format. Applies to data processed by consent/contract by automated means. |
| **Rectification** (Art. 16) | Admin edits the user/company record. For data the person can't self-edit, correct on request. |
| **Erasure** (Art. 17) | Use the admin removal flow (hard-delete where no FK; otherwise soft-delete + anonymise email and `isActive=false`). **Apply the legal-hold carve-out** — signed documents / AML records are retained for the statutory period and excluded from erasure; tell the requester what is retained and why. |
| **Restriction** (Art. 18) | Deactivate the account (`isActive=false`) to suspend processing while a dispute is resolved. |
| **Objection** (Art. 21) | For legitimate-interest processing (pipeline/relationship), stop unless we show overriding grounds; for any direct marketing, stop unconditionally. |
| **Withdraw consent** (Art. 7(3)) | Only relevant to non-essential cookies/marketing (none in the portal today). |

## Tooling
- **Export:** `src/actions/data-export-actions.ts` → `exportUserData(userId)` (admin) returns a JSON bundle of all personal data tied to a user. A CLI equivalent can be run via the export script if needed.
- **Erasure:** existing admin "remove investor" flow + retention/anonymisation per the retention schedule.

## Legal-hold note
Where the Wwft or other law requires retention, that period **overrides** an erasure request for the affected records. Always check before deleting signed documents.
