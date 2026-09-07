# DPIA threshold assessment — investor portal

> **Controller:** Dils Netherlands B.V. **Not legal advice.** WP248 rev.01 threshold screening for the investor-facing side of the portal, covering: invites (`InvestorInvite`), NDA signing (PDF and HTML flows, incl. `signerIp`/`signerUserAgent`/`pdfSha256` since PR #172), document access, consent-based email open/click tracking (`EmailTrackingConsent`, since PR #177), viewing requests (`requestViewing`) and offers/bids (`AssetCompanyTracking.bidAmount` etc.). **Last reviewed:** 2026-09-07.

## Open items

- [[confirm: total number of active investor/broker/advisor accounts and approximate documents/emails processed per year]] — needed to settle criterion 5 (large scale) below.
- [[confirm: assessor name]]
- [[confirm: DPO or privacy-lead name]]

## 1. What is being screened

| Feature | What is recorded | Where |
|---|---|---|
| Invites | Email, token, expiry; plaintext password in the invite email | `InvestorInvite` (`prisma/schema.prisma`), `src/actions/invite-actions.ts` |
| NDA signing (PDF + HTML) | Signer name/email, drawn signature image, `signedAt`, consumed token, and — since PR #172 — `signerIp`, `signerUserAgent`, `pdfSha256` (`prisma/schema.prisma:398-405`); the `ActivityLog` actor is now the signer, not the uploading admin (`document-actions.ts:1055-1057`, `html-nda-actions.ts:573-575`) | `Document`, `SigningToken`; `src/actions/document-actions.ts`, `src/actions/html-nda-actions.ts` |
| Document access | Portal content views logged for `INVESTOR` only (`CONTENT_ACCESSED`, `src/actions/content-actions.ts:279`). Signed-document/HTML-NDA **downloads are not logged** — `getSignedDocumentUrl` (`document-actions.ts:612-667`) and `getSignedHtmlNda` (`html-nda-actions.ts:610+`) authorise but write no `ActivityLog` row (open gap, tracked as G10 in the gap analysis; out of scope to fix here) | `src/actions/content-actions.ts`, `src/actions/document-actions.ts` |
| Email open/click tracking | Off by default; sent only when `EmailTrackingConsent` has an active (non-revoked) row for the recipient's email — `hasTrackingConsent()` / `trackingOptions()` (`src/lib/email-tracking.ts:15-20, 66-71`). Consent row stores `email`, `userId?`, `grantedAt`, `revokedAt`, `noticeVersion`, `source`, `ip?` (`prisma/schema.prisma:510-521`) | `EmailTrackingConsent`, `src/lib/email-tracking.ts` |
| Viewing requests | `VIEWING_REQUESTED` activity + `StageHistory` note, actor = requesting investor | `src/actions/portal-actions.ts:249-349` |
| Offers / bids | `bidAmount`, `bidCurrency`, `bidSubmittedAt` on the tracking row | `AssetCompanyTracking` (`prisma/schema.prisma`) |

## 2. WP248 rev.01 nine-criteria screening

| # | Criterion | Answer | Evidence |
|---|---|---|---|
| 1 | Evaluation or scoring | **No** | `InterestLevel`/bid data reflect a manually-recorded business state (an offer amount, a viewing request), not an automated score or profile computed about an investor. No profiling code exists (code-fact-sheet §10: "No automated decision-making"). |
| 2 | Automated decision-making with legal or similarly significant effect | **No** | Stage approvals, offer acceptance and NDA countersigning are all manual, staff-driven actions. Nothing in the pipeline auto-advances or auto-rejects a deal from logged behaviour. |
| 3 | Systematic monitoring | **Yes** | Document/content access is logged per investor (`CONTENT_ACCESSED`), signing events capture IP/user-agent, and — where consented — email opens and clicks are tracked. Together these systematically observe an investor's engagement with the portal over the life of a deal. This is the honest answer even though tracking is now consent-gated and off by default: consent changes the *lawful basis*, not whether the criterion is met. |
| 4 | Sensitive data or data of a highly personal nature | **No** | Data is business-contact and transaction data (name, email, bid amount, IP/UA at signing) — not Art. 9 special-category data. A drawn signature image is stored, but as a plain PNG, not processed by any technical means to uniquely identify a person, so it is not "biometric data" under Art. 4(14). The BSN elfproef guard (`src/lib/validators.ts`, `assertNoBSN`) further blocks Dutch national ID numbers from free-text fields. |
| 5 | Data processed on a large scale | **Not established — placeholder** | Scale depends on the number of active investor/broker/advisor accounts and yearly document/email volume, which is not derivable from the code. [[confirm: total number of active investor/broker/advisor accounts and approximate documents/emails processed per year]]. Provisionally treated as **No** given this is a boutique B2B deal portal, not a consumer-facing service — revisit if the confirmed numbers say otherwise. |
| 6 | Matching or combining datasets | **No** | Mailgun webhook events are correlated to the same app's own `ActivityLog`/`EmailTrackingConsent` rows by email/`messageId` — within one controller, one purpose. Nothing combines investor data with an external or differently-purposed dataset. |
| 7 | Data concerning vulnerable data subjects | **No** | Data subjects are investors, brokers and advisors acting in a professional capacity, not in a position of dependency on Dils comparable to an employee or a consumer — consistent with the existing LIA's finding that these are "business contacts... operating in a professional capacity" ([lawful-basis-and-LIA.md](lawful-basis-and-LIA.md)). |
| 8 | Innovative use or new technological/organisational solution | **No** | Standard signed-URL document delivery, transactional email, and a consent-gated tracking pixel — no novel technology. |
| 9 | Prevents data subjects from exercising a right or using a service/contract | **No** | Declining or revoking email-tracking consent does not block portal access or deal participation — tracking is opt-in and independent of the underlying contract-basis processing (invite, NDA, deal access). Investors can also request access/rectification/objection via `privacy.netherlands@dils.com` without losing service. |

**Criteria met: 1 of 9 confirmed** (systematic monitoring); **criterion 5 (large scale) unresolved pending the placeholder above** — if confirmed scale turns out to be large (e.g. hundreds of concurrent investors across many funds, high email volume), the count would rise to 2 and the recommendation in §3 would strengthen to "full DPIA required" under the same rule-of-thumb used in [dpia-screening-staff-audit-log.md](dpia-screening-staff-audit-log.md).

## 3. Conclusion

**One criterion is confirmed met (systematic monitoring); a second (large scale) is undetermined.** On the current evidence this falls **below** the WP248 two-criteria rule-of-thumb, so **a full Article 35 DPIA is not automatically required** for the investor portal as it stands today. This is a lower-risk profile than the staff audit log (which meets two criteria outright) because tracking here is consent-based and off by default, document access logging is currently the only unlogged surface investors interact with (signed-document downloads, tracked separately as G10), and investors are not a vulnerable class.

**Recommendation:**
1. Confirm the placeholder above (account count / volume) and record the answer here; if it pushes criterion 5 to "Yes", commission a full DPIA.
2. Re-run this screening if the portal adds automated scoring/profiling of investors, expands tracking beyond email opens/clicks (e.g. in-document analytics), or the investor base grows materially.
3. Independent of this screening's outcome, close **G10** (log signed-document/HTML-NDA downloads) — it is a security/evidentiary gap, not a DPIA trigger, but it directly affects how completely criterion 3 (systematic monitoring) can be answered next time this is reviewed.

### Residual measures

- **Consent-based tracking stays off by default**, per-recipient, and is checked at send time (`trackingOptions()`), not just at the Mailgun domain level.
- **Signing evidence** (`signerIp`, `signerUserAgent`, `pdfSha256`) is collected only at the moment of signing, for the person doing the signing, and serves an evidentiary purpose (BW 3:15a "sufficiently reliable" signature), not behavioural profiling.
- **Access logging honesty**: this document does not overstate what is logged — signed-document downloads are not currently logged for any role; that gap is tracked (G10) rather than assumed fixed.

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Assessor | [[confirm: assessor name]] | | |
| DPO / privacy lead | [[confirm: DPO or privacy-lead name]] | | |
