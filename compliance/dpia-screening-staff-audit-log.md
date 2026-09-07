# DPIA threshold assessment — staff audit log (`ActivityLog` + `StageHistory` + timeline page)

> **Controller:** Dils Netherlands B.V. **Not legal advice.** This is a WP248 rev.01 threshold screening, not a substantive Article 35 DPIA. It exists to answer one question — does this processing require a full DPIA — with evidence, so the answer can be defended to the AP or an OR. **Scope:** the `ActivityLog` and `StageHistory` tables and the per-deal timeline page (`src/app/(protected)/assets/[id]/timeline/[trackingId]/page.tsx`), read together as a *personeelsvolgsysteem* (staff-monitoring facility) under WOR Art. 27(1)(l). **Last reviewed:** 2026-09-07.

## Open items

- [[confirm: does Dils NL have an ondernemingsraad (OR), and has this facility ever been tabled with it?]] — also the subject of [or-instemmingsverzoek-audit-log.md](or-instemmingsverzoek-audit-log.md).
- [[confirm: approximate ADMIN/EDITOR headcount]] — used in criterion 5 below and for the record if this screening is ever revisited.
- [[confirm: assessor name]]
- [[confirm: DPO or privacy-lead name]]

## 1. What is being screened

`ActivityLog` (`prisma/schema.prisma:348-361`) and `StageHistory` (`prisma/schema.prisma:328-341`) record who did what, when, on every deal. Actor is `userId` / `changedByUserId`. The action vocabulary covers essentially every staff-initiated event in the pipeline — `CREATED`, `UPDATED`, `STATUS_UPDATED`, `STAGE_APPROVED`, `DOCUMENT_UPLOADED`, `DOCUMENT_SIGNED`, `INVITE_SENT`, `BULK_INVITE_BATCH_*`, `PASSWORD_RESET`, and more (full list: [code-fact-sheet-2026-09.md §3](code-fact-sheet-2026-09.md)). Since PR #172, signing events are attributed to the person who actually signed (`document-actions.ts:1055-1057`, `html-nda-actions.ts:573-575`) rather than the uploading admin, and also carry `signerIp` / `signerUserAgent` (`prisma/schema.prisma:401-402`).

The timeline page (`src/lib/timeline.ts:18-27`) merges `StageHistory`, `Comment` and `Document` rows into one chronological, per-employee-named view for a single deal. Since PR #173 it is gated by `requireAssetAccess` (`src/lib/permissions.ts:107-121`) instead of a bare login check, and VIEWER users see `"Team member"` instead of the real name (`src/lib/timeline.ts:79`, `canSeeContactDetails` false for VIEWER — `src/lib/permissions.ts:59-62`). INVESTOR is never let through `requireAssetAccess` (`permissions.ts:114-115`: only ADMIN/EDITOR pass, VIEWER needs a grant, every other role throws), so investors cannot reach this page.

Raw `ActivityLog` is additionally surfaced to staff directly: `src/app/(protected)/admin/invites/page.tsx:9` (ADMIN only) and `requireRole("EDITOR")` gates in `src/actions/asset-actions.ts:203`, `src/actions/tracking-actions.ts:630`, `src/actions/content-actions.ts:314` (EDITOR+).

## 2. WP248 rev.01 nine-criteria screening

Per the Art. 29 Working Party's DPIA guidelines (WP248 rev.01, endorsed by the EDPB and used by the AP), meeting **two or more** of the nine criteria is treated as a rule-of-thumb indicator that the processing is likely to result in high risk and a full DPIA is generally required.

| # | Criterion | Answer | Evidence |
|---|---|---|---|
| 1 | Evaluation or scoring | **No** | The log records discrete actions (who changed what, when); there is no scoring, ranking or performance-index field or computation over staff behaviour. `InterestLevel` (`schema.prisma`) scores a *company's* interest in a deal, not an employee. |
| 2 | Automated decision-making with legal or similarly significant effect | **No** | The log and timeline are read-only historical records. No code path takes an automated action (e.g. access revocation, discipline flag) based on log content — confirmed by the code-fact-sheet's "No automated decision-making" finding (§10). |
| 3 | Systematic monitoring | **Yes** | Every staff-initiated action across the deal pipeline is captured automatically and continuously (§1 above), and the timeline page presents it as a per-employee, chronological account. This is the textbook case WP248 gives for systematic monitoring in an employment context. |
| 4 | Sensitive data / data of a highly personal nature | **No** | Logged fields are operational: `userId`, `action`, and `metadata` such as `email`, `signedByName`, `recipient`, `companyName`, `storagePath` (code-fact-sheet §3). No Art. 9 special-category data (health, political, religious, biometric, etc.) is logged about staff. |
| 5 | Data processed on a large scale | **No** | Data subjects are limited to Dils NL's own ADMIN/EDITOR user base — an internal team, not a customer or public population — and processing is confined to one company's deal pipeline, not aggregated across organisations. [[confirm: approximate ADMIN/EDITOR headcount]] would only harden this answer, not overturn it at any plausible size for this team. |
| 6 | Matching or combining datasets | **No** | `ActivityLog`/`StageHistory` are populated from the app's own actions only; nothing in the codebase merges them with an external dataset or a dataset collected for a different, incompatible purpose. |
| 7 | Data concerning vulnerable data subjects | **Yes** | WP248 explicitly treats **employees** as vulnerable data subjects for this criterion, because of the power imbalance between employee and employer: staff cannot meaningfully object to or opt out of a monitoring facility their employer operates as a condition of doing their job. That applies directly here — the users being logged are Dils NL staff, not third parties. |
| 8 | Innovative use or new technological/organisational solution | **No** | Standard relational audit-log pattern (append-only rows keyed by actor and action) — no novel technology, profiling technique or organisational model. |
| 9 | Prevents data subjects from exercising a right or using a service/contract | **No** | Staff cannot decline to be logged and still do their job, but the processing itself does not block them from a right, a service, or a contract in the WP248 sense (e.g. it is not a precondition gate like a credit check). |

**Criteria met: 2 of 9** (systematic monitoring; vulnerable data subjects / power imbalance).

## 3. Conclusion

**Two WP248 criteria are met.** Under the rule-of-thumb the Working Party guidelines and the AP apply, that is enough on its own to treat this processing as likely high-risk and **a full Article 35 DPIA is recommended**, even though no single criterion is extreme (the log is not large-scale, not automated-decisioning, not sensitive-data). Because the facility is already live in production without either a prior DPIA or OR *instemming*, the recommendation is to:

1. **Complete a full Art. 35 DPIA retrospectively** — necessity/proportionality test, risk-to-individuals assessment, and documented mitigating measures — before any further expansion of what is logged, who can view it, or how long it is kept.
2. **Table the facility for OR *instemming*** in parallel — see [or-instemmingsverzoek-audit-log.md](or-instemmingsverzoek-audit-log.md) — since WP248 criterion 7 and WOR Art. 27(1)(l) are triggered by the same underlying fact (systematic monitoring of staff).
3. Apply the residual measures below **now**, without waiting for the full DPIA, since they are already achievable and reduce risk immediately.

### Residual measures (in place or committed now)

- **Role restriction.** Raw `ActivityLog` access is EDITOR+ only (`requireRole("EDITOR")` at the call sites listed in §1); the per-deal timeline additionally requires `requireAssetAccess`, strips staff names to `"Team member"` for VIEWER, and is unreachable by INVESTOR.
- **Retention.** 24 months from `createdAt`, per [data-retention-schedule.md](data-retention-schedule.md) and enforced by `scripts/purge-expired-data.ts` (`activityLogCutoff`, ~24 months) — except rows tied to a document under legal hold, which follow that document's 7-year retention (see [legal-landscape-and-gap-analysis-2026-09.md §4](legal-landscape-and-gap-analysis-2026-09.md)). **Not yet wired to a schedule** (G1/G3 in the gap analysis) — the purge script must be scheduled (Vercel Cron or equivalent) for this measure to be real rather than aspirational.
- **No HR use without a fresh decision.** This log exists for deal governance, security and evidentiary purposes — not performance appraisal. It must not be used to inform a hiring, disciplinary, appraisal or termination decision unless a case-specific proportionality check and a new decision are made first (see [staff-monitoring-protocol.md](staff-monitoring-protocol.md), "When it may be used in an HR context").

## Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Assessor | [[confirm: assessor name]] | | |
| DPO / privacy lead | [[confirm: DPO or privacy-lead name]] | | |
