# EU & Dutch legal landscape for the Investment Tracker — gap analysis (September 2026)

**Date:** 2026-09-07 · **Subject:** Investment Tracker / DILS Investor Portal, `master` @ `6017154` · **Operator:** Dils Netherlands B.V. · **Evidence base:** [code-fact-sheet-2026-09.md](code-fact-sheet-2026-09.md)

**Not legal advice.** This is an engineering-grade mapping of which EU and Dutch laws touch the app, what each one expects to find, and where the code falls short. It extends the June 2026 GDPR/AVG audit (agent-hq report `gdpr-avg-compliance-audit`) to every other regime that applies, and re-checks the GDPR items against the code as it is today. Items marked ⚖️ need a Dutch lawyer to decide.

> **Status update 2026-09-07 (evening):** the code sections below describe master @ `6017154`; see §9 for what has shipped since.

---

## 1. Verdict in five lines

1. **The June remediation sat unmerged for 11 weeks.** The 19-file GDPR fix (RoPA, retention schedule, purge script, data export, log redaction, BSN guard) was found still on branch `claude/trusting-elion-63a5ed` during this research and was merged to master on 2026-09-07 (#170). The purge script is not yet scheduled.
2. **Nine regimes apply, not one.** Beyond GDPR/UAVG: the Dutch Telecommunicatiewet (spam + tracking), the Wwft anti-money-laundering act (Dils *is* a Wwft institution), EU sanctions law, Dutch e-signature and e-contract law (BW 3:15a, 6:227a), the Trade Secrets Act, the Works Councils Act (WOR Art. 27), Dutch record-retention law (AWR 52, BW 2:10), and organisation-level duties under the Whistleblower Act and AI Act Art. 4.
3. **Eight regimes do not apply** and can be documented as out of scope: NIS2/Cyberbeveiligingswet, Cyber Resilience Act, Product Liability Directive (likely), European Accessibility Act, DSA and P2B, Wft/AFM licensing (for asset deals), Bibob, and the eIDAS wallet-acceptance duty. The Data Act applies only as a benefit to Dils as a cloud customer.
4. **Three gaps are live legal exposure today**, independent of the June work: email open/click tracking without consent and no opt-out link (Telecommunicatiewet 11.7 and 11.7a, an AP and ACM 2026 enforcement priority); the staff audit log deployed without works-council consent (WOR 27); and no Wwft/sanctions gate anywhere in the deal pipeline.
5. **The e-signature is weaker than everyone assumed.** No IP, no user agent, no hash, no certificate, no copy to the signer, no consent checkbox, and the audit row credits the signing to the admin who uploaded the document. It is a valid simple electronic signature, but if an investor denies signing, Dils has little to prove it.

---

## 2. Applicability matrix

| Regime | Applies? | Why (for this app) | What it expects to find | In code today |
|---|---|---|---|---|
| **GDPR + UAVG** | Yes | Staff and investor-contact personal data; signatures; audit log | Art. 13/14 notices, RoPA, retention, DPAs, DPIA screening, LIAs, DSAR path, breach register | Partly — Art. 13/14 notice shipped (#185); purge cron wired but dry-run by default, DPAs unsigned (#187) — §9 G1–G4 |
| **Telecommunicatiewet Art. 11.7** (spam) | Yes | Invite emails carry a deal teaser = commercial communication; B2B exception allows sending, but an opt-out is mandatory in every message | Unsubscribe in every commercial email; honour unsubscribes | **Shipped** — `List-Unsubscribe` header + `EmailSuppression` list (#176) — §9 G5 |
| **Telecommunicatiewet Art. 11.7a** (cookies/tracking) | Yes | Auth cookie is exempt (strictly necessary). Mailgun open pixel reads the recipient's device → consent | Tracking off, or consent | **Shipped as consent** — off by default, opt-in via `/portal/preferences` (#177) — §9 G6 |
| **Wwft** (AML) | Yes | Dils mediates real-estate sales → Wwft institution, Art. 1a lid 4 sub h (verified on wetten.overheid.nl, version 2026-01-01). Supervisor: Bureau Toezicht Wwft | CDD on client (seller) and, lighter, on buyer before the transaction completes; UBO/PEP; unusual-transaction reporting; 5-year retention (Art. 33) | **Shipped** — `cddStatus`/`sanctionsScreenedAt` + NBO soft gate (#188); ⚖️ scope still open — §9 G7 |
| **Sanctiewet 1977 / EU sanctions** | Yes | Sector-agnostic ban on making assets available to listed persons; screening of buyer + UBO is de facto mandatory | Screening evidence: date, list version, result | **Shipped** alongside the Wwft CDD fields (#188) — §9 G7 |
| **BW 3:15a / 6:227a + eIDAS Art. 25** (e-sign, e-contract) | Yes | NDA signed in-app; NBO offer letter uploaded externally signed (#196) with upload evidence | "Sufficiently reliable" method; provable identity, integrity, moment of conclusion | Partly — signer IP/UA + PDF hash persisted (#172); certificate, copy-to-signer, intent checkbox still open — §9 G8 |
| **Wet bescherming bedrijfsgeheimen** (trade secrets) | Yes | IM / rent roll are sellers' trade secrets; Dils must show "reasonable measures" | NDA gate, access control, download logging, ideally watermark + expiry | NDA gate ✅, signed URLs ✅, **download logging shipped for all roles** (#189); watermark/expiry still open — §9 G10 |
| **WOR Art. 27(1)(k)(l)** (works council) | Likely yes | Audit log is "suitable for" monitoring staff behaviour → OR consent required before introduction/change | OR instemming record, staff monitoring notice, purpose + retention | Docs drafted (DPIA screenings, staff monitoring protocol, OR instemmingsverzoek, #186); OR instemming itself (organisational) still outstanding — §9 G4 |
| **AWR Art. 52, BW 2:10 / 3:15i** (retention) | Yes | Signed NDAs, offers, approval emails are deal administration → 7 years | Retention table with legal basis; legal hold beats erasure | Purge cron wired, dry-run by default (#187); `removeInvestor` still only obfuscates, no anonymisation — §9 G3 |
| **Wet bescherming klokkenluiders** | Org-level | Dils NL >50 staff → internal reporting channel exists company-wide; app only needs to point misuse reports to it | Cross-reference in staff notice | n/a |
| **AI Act Art. 4** (AI literacy) | Org-level | Staff use AI coding tools; no AI in the product | Literacy note/training record; Annex III + Art. 50 screen before any AI feature | No AI in runtime ✅ |
| **Data Act** | As customer | Vercel/Supabase/Upstash must offer switching; zero egress fees from 12 Jan 2027 | Contract check at renewal | n/a |
| **NIS2 / Cyberbeveiligingswet** (in force 15 Aug 2026) | **No** | Real estate is in neither Annex I nor II; group membership does not change that | NCSC Art. 21 list as voluntary baseline (MFA!) | Out of scope; MFA still missing — G9 |
| **Cyber Resilience Act** | **No** | Internal SaaS, not a product placed on the market | — | — |
| **Product Liability Directive 2024/2853** (NL transposition 9 Dec 2026) | Likely no ⚖️ | Not placed on the market; ordinary contract/tort liability still applies | Version/change documentation for signing code | CI + git history ✅ |
| **European Accessibility Act** (since 28 Jun 2025) | **No** | B2B only; consumers never use it. Wgbh/cz employer accommodation duty remains case-by-case | WCAG 2.2 AA as voluntary benchmark | Not assessed |
| **DSA / P2B** | **No** | Not an intermediary or marketplace | — | — |
| **Wft / AFM** | **No** for asset deals ⚖️ | Direct real estate is not a financial instrument. **Edge:** SPV share deals are; fractional "beleggingsobjecten" (Art. 2:55) would be | Flag share deals for reclassification | — |
| **Wet Bibob** | **No** | Power of public bodies, not a broker duty | — | — |
| **eIDAS 2.0 wallet acceptance (Art. 5f)** | **No** | Only sectors with a statutory strong-authentication duty | Revisit if sector rules change | — |

---

## 3. Gaps, ranked

Priority: **P0** = legal exposure today or a regulator's named 2026 priority · **P1** = evidentiary / security weakness that becomes a problem the day something goes wrong · **P2** = hygiene and hardening.

### P0

**G1 · The June GDPR remediation was unmerged for 11 weeks — merged 2026-09-07 (#170).** RoPA, retention schedule, DSAR procedure, breach runbook, LIA, sub-processor register, purge script, ADMIN data export, log redaction and the BSN guard are now on master. What remains from that package: `scripts/purge-expired-data.ts` runs only by hand (`npm run purge:dry`), the four DPAs are unsigned, and the docs still carry ⚖️ legal-review markers.
*Fix:* wire the purge to a Vercel Cron (needs a `vercel.json`, which also lets you pin the function region — see G11); sign the DPAs; get the addendum and LIA reviewed.

**G2 · Wrong controller identity and no Art. 13/14 notice at collection.** The only in-app notice (`signing-page.tsx:339-348`, duplicated in `signing-modal.tsx:363-372`) names **"DILS Group B.V."** and `privacy@dils.com`; the portal footer shows an **Italian VAT number** (`investor-shell.tsx:55`). The controller is Dils Netherlands B.V. and the working DSAR channel is `privacy.netherlands@dils.com`. The HTML-NDA page has no notice; login, request-access, forgot-password and `/sign/[token]` have no privacy link on master. Most contacts arrive via CSV or staff entry (`bulk-invite-actions.ts`, `reimport-csvs-to-asset.ts`), which is **Art. 14** data: the notice must state the *source* and reach the person at first contact or within one month. Transparency (Art. 12–14) is a named AP 2026 enforcement pillar.
*Fix:* one shared `<PrivacyNotice>` component with the correct entity, address, DSAR mailbox, purposes, bases, recipients (Supabase, Vercel, Mailgun, Upstash), retention and rights; render it on every public page and inside the invite email; add a `source` and `collectedAt` column on `CompanyContact` so the Art. 14 clock is provable.

**G3 · Nothing is purged automatically, and deletion is obfuscation.** The purge script exists (#170) but no cron runs it, and no anonymisation exists. `removeInvestor` (`invite-actions.ts:453-505`) can only rewrite the email to `<email>.removed-<ts>` because `ActivityLog`, `Comment`, `StageHistory`, `Document` have no cascade; signature PNGs, signed PDFs and `ActivityLog.metadata.email` survive; storage objects are never removed. Meanwhile signed NDAs and offers *must* be kept 7 years (BW 2:10 / AWR 52) and Wwft CDD records 5 years — so the same system both over-retains and cannot guarantee the legal minimums.
*Fix:* schedule the purge (G1), then implement the retention table in §4 as a scheduled job with a `legalHoldUntil` on `Document`, a real anonymise routine for users, and storage-object deletion.

**G4 · Staff audit log deployed without works-council consent or DPIA screening.** `ActivityLog` + `StageHistory` record every staff action and the timeline page names the employee behind each change. Under WOR Art. 27(1)(l) a facility "suitable for" monitoring behaviour needs OR *instemming* before introduction or material change; a decision taken without it is voidable for a month after the OR learns of it. The same facts meet two WP248 DPIA criteria (systematic monitoring + power imbalance), so a documented DPIA threshold assessment is owed even if the answer is "no full DPIA". The AP's OR-privacyboekje expects a written purpose, viewer list and retention.
*Fix (organisational):* confirm whether Dils NL has an OR; table the log for instemming with a one-page monitoring protocol (purpose = deal governance and evidence, not performance; ADMIN/EDITOR view only; 24-month retention; never used for HR without a fresh decision). Write the DPIA screening memo for the log and for the portal. Add a staff-facing notice in Dutch.

**G5 · No opt-out in any email; unsubscribe events are recorded but not honoured.** Invite emails carry the asset teaser and hero image, which makes them commercial communications under Telecommunicatiewet 11.7. The B2B exception permits sending to business addresses, but lid 4 still requires a free, easy opt-out in every message. `email-template.ts:36-54` has none; there is no `List-Unsubscribe` header; `EMAIL_UNSUBSCRIBED` / `EMAIL_COMPLAINED` are shown in the admin UI (`admin/invites/page.tsx:64-65`) but nothing suppresses the next send. ACM enforces this, separately from the AP.
*Fix:* add `h:List-Unsubscribe` + `List-Unsubscribe-Post` and a footer link to a tokenised `/unsubscribe` route that sets `CompanyContact.optedOutAt`; check it in `sendInvestorInvite` and bulk invite. Credential and password-reset emails are transactional and exempt, but keep the link anyway.

**G6 · Email open and click tracking runs without consent.** No `o:tracking-opens=no` / `o:tracking-clicks=no` is sent (`email.ts:90` sends only the actor tag); the webhook expects `opened, clicked` (`webhook/route.ts:8-10`) and the admin invites page renders them (`:60-61`). An open pixel reads information from the recipient's device — Telecommunicatiewet 11.7a / ePrivacy Art. 5(3), and EDPB Guidelines 2/2023 treat it exactly like a cookie. Link rewriting adds per-person behavioural profiling that needs a basis and a notice. "Pre-consent tracking" is an explicit AP 2026 pillar; CNIL and Garante issued pixel guidance in 2026.
*Fix:* disable opens/clicks at the Mailgun domain level **and** send `o:tracking=no` per message (belt and braces, since one env flip moves the domain); drop `EMAIL_OPENED`/`EMAIL_CLICKED` from the UI and webhook classifier. Keep delivery/bounce events (operational, no device access). The `CONTENT_ACCESSED` log inside the portal is fine: it is a server-side access record, disclosed in the notice.

**G7 · No Wwft / sanctions gate in the pipeline.** Dils is a Wwft institution (Art. 1a lid 4 sub h). The app carries a deal from teaser to non-binding offer with no field for "CDD done", "UBO identified", "sanctions screened", and no legal hold tied to it. KYC done in another system is lawful, but nothing stops a deal reaching NBO before it happens, and the app's 5-year retention duty for anything that becomes CDD evidence is unenforced. The EU AML Regulation 2024/1624 replaces the Wwft from 10 July 2027 with the same core duties.
*Fix (product):* add `cddStatus` (NOT_STARTED / IN_PROGRESS / CLEARED / ESCALATED), `cddClearedAt`, `cddClearedByUserId`, `sanctionsScreenedAt` on `Company` (or per tracking), a manual attestation UI for EDITOR+, and a soft gate that warns when advancing to NBO without CLEARED. Log to `ActivityLog`. Do **not** store ID copies or UBO documents in this app unless counsel confirms Dils performs buy-side CDD itself (⚖️).

### P1

**G8 · E-signature evidence is thin.** What is stored: name, email, drawn signature PNG, server timestamp, consumed token. What is missing: signer IP and user agent, a SHA-256 of the final PDF, a completion certificate, a copy to the signer, an explicit "I intend this as my legally binding signature" checkbox, and a byte-stable original (`ensureSignedPdf` re-renders lazily). The audit row credits `document.uploadedByUserId`, i.e. the admin, as the actor of `DOCUMENT_SIGNED` / `HTML_NDA_SIGNED` (`document-actions.ts:1041`, `html-nda-actions.ts:562`). Under BW 3:15a a simple e-signature is valid if "sufficiently reliable", but Rechtbank Amsterdam (ECLI:NL:RBAMS:2022:793) shows a denied signature with no corroborating metadata loses. Case law on Adobe Sign / DocuSign splits on exactly these facts.
*Fix:* at signing persist `signerIp`, `signerUserAgent`, `pdfSha256`, `tokenId`; hash the rendered PDF once and store it immutably (render synchronously or mark "pending" until hashed); append an audit page to the PDF; email the signer a copy; add the intent checkbox; record the signer's `userId` (or the token) as actor. Optional: RFC 3161 timestamp. Reaching "advanced" signature level would need identity-proofed credentials — not worth it for NDAs, worth it for SPAs.

**G9 · Authentication below the 2026 baseline.** No MFA for any role including ADMIN; plaintext passwords in invite, welcome, reset and admin-reset emails (`email-template.ts:194-210`); reset rotates the live password on request (`auth-actions.ts:169-176`); no lockout; admin-created passwords min 6 chars (`validators.ts:96`). Not a statutory mandate (Cbw does not apply), but MFA is NIS2 Art. 21(2)(j) and the NCSC baseline that an AP breach inquiry, an insurer, or an institutional investor's security questionnaire will measure against. Credential stuffing against a password-only portal holding IMs and rent rolls is the most likely reportable breach.
*Fix:* execute the existing `mfa-implementation-plan.md` (TOTP or passkeys) starting with ADMIN/EDITOR; replace emailed passwords with a one-time set-password link; lockout after N failures; raise admin-set minimum to 12.

**G10 · No document download log, and one unguarded page.** `getSignedDocumentUrl` and `getSignedHtmlNda` write no `ActivityLog` row; only INVESTOR content access is logged. "Who downloaded the rent roll" is unanswerable for staff and VIEWER clients — bad for trade-secret "reasonable measures" and for answering an Art. 15 request. Separately, `assets/[id]/timeline/[trackingId]/page.tsx:14` checks only that a user is logged in: a VIEWER with a `trackingId` sees staff identities and stage history, contrary to `permissions.ts:54-62`.
*Fix:* log every signed-URL issuance (user, role, document, IP) and add `requireAssetAccess` to the timeline page. Then: per-user watermark on IM/rent-roll PDFs and access expiry on deal close.

**G11 · Hosting region and sub-processor paperwork.** No `vercel.json` → functions run in Vercel's default region (often `iad1`, US). Upstash region is undocumented. Mailgun EU is only a default env value. The DPAs with Supabase, Vercel, Mailgun (Sinch) and Upstash are unsigned per the June register, and the Italian parent's access (if any) is unclassified (controller / processor / none). The EU-US DPF survived *Latombe* (General Court, 3 Sep 2025; appeal C-703/25 P pending) — still usable, but keep SCCs as backstop.
*Fix:* add `vercel.json` with `"regions": ["fra1"]` (also carries the cron for G1); confirm Upstash EU region; sign the four DPAs; write a one-page intra-group data memo (⚖️).

### P2

**G12 · Vulnerability disclosure.** No `/.well-known/security.txt`, no `SECURITY.md`. NCSC-recommended, not mandatory; the public `/sign/[token]` surface makes it worth 10 minutes.

**G13 · Portal terms of use.** Only an external "Algemene voorwaarden" link in the investor footer. BW 6:234 wants terms presented before contracting and retrievable afterwards; a click-accept on first login is routine and binding on business users. Low risk, cheap.

**G14 · Free-text PII risk.** `Company.notes`, `CompanyContact.notes`, `Comment.body` accept anything beyond the BSN elfproef guard merged in #170 (UAVG Art. 46). Consider IBAN/passport patterns and a staff notice on what not to type.

**G15 · Calendar items.** AI Act Art. 4 literacy note for the team; screen any future summarisation/scoring feature against Annex III and Art. 50 (in force 2 Aug 2026; high-risk deadline moved to 2 Dec 2027 by Regulation (EU) 2026/1744); Data Act zero egress fees from 12 Jan 2027 (check cloud contracts); PLD transposition 9 Dec 2026 (documentation hygiene only); EUDI wallet available end-2026 (no acceptance duty).

---

## 4. Retention table (proposed, per data category)

Longest applicable regime wins. "Legal hold" means the purge job must skip the row.

| Data | Where | Legal driver | Keep | Then |
|---|---|---|---|---|
| Signed NDA / offer PDF, `signatureData`, signing metadata | `Document`, storage | BW 2:10, AWR 52 (7 y); Wwft 33 (5 y); BW 3:307 (5 y claims) | **7 years** from deal close — legal hold | delete object + row |
| NDA approval / invite emails proving formation | Mailgun + `ActivityLog` | BW 6:227a evidence | as long as the NDA | — |
| Company + contact records (prospects) | `Company`, `CompanyContact` | GDPR 5(1)(e); LI ends when interest ends | active + **24 months** after last activity | anonymise |
| CDD / sanctions attestation fields (G7) | `Company` | Wwft 33 | **5 years** after transaction/relationship end | delete |
| Staff `ActivityLog`, `StageHistory` | tables | GDPR; WOR protocol; evidence | **24 months** (June schedule), 7 y for rows tied to a held document | delete / detach |
| Viewing requests, bids, comments | tracking tables | GDPR only | with the tracking; deal + 24 months | delete |
| Users | `User` | GDPR | active + 12 months after deactivation | anonymise (name, email → hash) |
| `SigningToken`, unaccepted `InvestorInvite` | tables | GDPR | 30 days after expiry | delete |
| Upstash rate-limit keys (IP, email) | Redis | GDPR 6(1)(f) security | 15–60 min TTL ✅ | — |
| Vercel function logs with IP/email | Vercel | GDPR | Vercel default; redaction merged #170 | — |
| Password-reset / credential emails | Mailgun | none | Mailgun default 3–7 days ✅ | — |

---

## 5. Dates to calendar

| Date | What | Us? |
|---|---|---|
| 15 Aug 2026 (passed) | Cyberbeveiligingswet in force, Wbni withdrawn | No — out of sector; use Art. 21 list as baseline |
| 2 Aug 2026 (passed) | AI Act Art. 50 transparency | Only if an AI feature ships |
| 9 Dec 2026 | Product Liability Directive NL transposition | Likely no |
| ~24 Dec 2026 | EUDI wallets available in member states | No acceptance duty |
| 12 Jan 2027 | Data Act: zero cloud egress/switching fees | Yes, as customer |
| 2 Apr 2027 | GDPR Procedural Regulation 2025/2518 applies | Background |
| 10 Jul 2027 | EU AML Regulation 2024/1624 replaces Wwft core | Yes — G7 fields carry over |
| 2 Dec 2027 | AI Act high-risk (Annex III) deadline | Only for investor-scoring-type features |
| mid-2027+ | Digital Omnibus (GDPR/ePrivacy simplification, 96 h breach clock) | Not law yet; build to current rules |

---

## 6. Questions for Dutch counsel ⚖️

1. Does Dils NL have an ondernemingsraad, and was the audit log ever tabled? (G4)
2. Buy-side Wwft scope: identity + UBO + sanctions only, or full CDD, and at which pipeline stage? Is Dils registered with Bureau Toezicht Wwft and does its risicobeleid cover the portal? (G7)
3. Controller vs processor when circulating seller tenant data (rent rolls) to buyers; does the seller's lease-time privacy notice cover Art. 14 for tenants? (G10, June audit)
4. Italian parent: any access to NL data, and under which Art. 26/28 arrangement? (G11)
5. Does Dils ever broker SPV share deals? If so, Wft/MiFID reclassification. (§2)
6. Retention: confirm 7 years (not 10) for NDAs/offers in Dils's own administration, and the legal-hold-over-erasure position. (§4)
7. Is the proposed G8 evidence set "sufficiently reliable" under BW 3:15a for NDAs, and should SPAs move to a qualified signature? (G8)

---

## 7. What changed since the June audit

- **Cyberbeveiligingswet** entered into force 15 Aug 2026 — confirmed out of scope, but it fixes the security baseline everyone will quote.
- **AI Act omnibus** (Reg. 2026/1744, in force 27 Jul 2026) delayed high-risk duties to Dec 2027; Art. 50 transparency unchanged.
- **AP Jaarplan 2026** names mass surveillance, AI and digital resilience as 2026–28 priorities, with transparency, pre-consent tracking and cookies as 2026 enforcement themes — this upgrades G2, G5 and G6 from paperwork to enforcement risk.
- **AP SME DPIA-exemption list** consultation closed 10 Aug 2026; scoped to HR/payroll, would not cover this app.
- **DPF upheld** in *Latombe* (3 Sep 2025), appeal pending.
- **UBO register** access regime changed 16 Jul 2025; "legitimate interest" access consultation Nov 2025 — only relevant if Dils performs buy-side CDD itself.
- **Digital Omnibus** (GDPR/ePrivacy) proposed 19 Nov 2025; not law before 2027.

---

## 8. Sources

**Primary**
- GDPR consolidated: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679
- Wwft Art. 1a (version 2026-01-01): https://wetten.overheid.nl/BWBR0024282/2026-01-01/0/HoofdstukI/Artikel1a
- Wwft bewaarplicht Art. 33 (commentary): https://www.viajuridica.nl/informatiesoorten/wetstoelichtingen/bewaarplicht-clientenonderzoek-art-33-wwft
- Belastingdienst Wwft cliëntenonderzoek: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/aangifte_betalen_en_toezicht/wwft-voorkomen-van-witwassen-en-terrorismefinanciering/verplichtingen/clientenonderzoek/
- FIU leidraad makelaars/bemiddelaars: https://www.fiu-nederland.nl/wp-content/uploads/2025/02/leidraad_wwft_richtl_makelaars_bemiddelaars_en_taxateurs_onroerende_zaken_tz0041z7fd.pdf
- WOR Art. 27: https://wetten.overheid.nl/BWBR0002747/2022-01-01/0/HoofdstukIVA/Artikel27/informatie
- AP OR-privacyboekje: https://www.autoriteitpersoonsgegevens.nl/uploads/imported/ap_or_privacy-boekje.pdf
- AP mandatory-DPIA list: https://wetten.overheid.nl/BWBR0042812/2019-11-27/0/informatie
- AP 2026 priorities: https://www.autoriteitpersoonsgegevens.nl/actueel/de-ap-in-2026-focus-op-massasurveillance-ai-en-digitale-weerbaarheid · Jaarplan: https://www.autoriteitpersoonsgegevens.nl/documenten/ap-jaarplan-2026
- AP DPIA-exemption consultation: https://www.autoriteitpersoonsgegevens.nl/actueel/ap-vraagt-reacties-op-lijst-dpia-uitzonderingen
- ACM spam/telemarketing guidance: https://www.acm.nl/nl/publicaties/publicatie/10143/Uitleg-aan-marktpartijen-over-spamverbod-en-telemarketingregels-2011
- EDPB Guidelines 01/2024 legitimate interest: https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202401_legitimateinterest_en.pdf
- EDPB Guidelines 07/2020 controller/processor: https://www.edpb.europa.eu/system/files/documents/2023-10/EDPB_guidelines_202007_controllerprocessor_final_en.pdf
- Cyberbeveiligingswet in force: https://www.rijksoverheid.nl/actueel/nieuws/2026/08/15/cyberbeveiligingswet-en-wet-weerbaarheid-kritieke-entiteiten-vanaf-vandaag-van-kracht · NCSC: https://www.ncsc.nl/cyberbeveiligingswet-nis2
- NIS2 sectors: https://digital-strategy.ec.europa.eu/en/policies/nis2-directive
- CRA: https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act
- AI Act Art. 50 FAQ: https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- Data Act: https://digital-strategy.ec.europa.eu/en/factpages/data-act-explained
- BW 3:15a–3:15f commentary: https://www.viajuridica.nl/informatiesoorten/wetstoelichtingen/elektronisch-vermogensrechtelijk-rechtsverkeer-art-3-15a-3-15f-bw
- Belastingdienst bewaartermijnen: https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/administratie_bewaren/administratie_bewaren
- Trade secrets (Octrooicentrum): https://www.octrooicentrum.nl/over-octrooien/orienteren-op-intellectueel-eigendom/bedrijfsgeheim
- KvK non-mailing indicator: https://www.kvk.nl/en/about-the-business-register/the-non-mailing-indicator/
- Huis voor Klokkenluiders (employers): https://www.huisvoorklokkenluiders.nl/wet-en-regelgeving/informatie-voor-werkgevers
- NCSC MFA / access: https://www.ncsc.nl/wat-kun-je-zelf-doen/basisprincipes/beheer-toegang-tot-data-en-diensten
- security.txt (NCSC): https://www.ncsc.nl/cvd-beleid/securitytxt-en-it-dienstverleners
- Vercel DPF certification: https://vercel.com/changelog/vercel-is-now-certified-under-the-eu-us-data-privacy-framework-dpf · Upstash DPA: https://upstash.com/trust/dpa.pdf

**Secondary (law-firm / commentary, flagged where they carry a claim)**
- AI Act omnibus in force 27 Jul 2026: https://www.whitecase.com/insight-alert/eu-ai-omnibus-enters-force-amending-ai-act · https://www.lewissilkin.com/insights/2026/07/27/the-digital-omnibus-on-ai-enters-into-force-today-102nedo
- Digital Omnibus (GDPR): https://www.whitecase.com/insight-alert/gdpr-under-revision-key-takeaways-from-digital-omnibus-regulation-proposal
- DPF / Latombe: https://www.twobirds.com/en/insights/2025/euus-data-privacy-framework-survives-legal-challenge-what-the-latombe-decision-means-for-internation
- E-signature case law: https://www.blenheim.nl/blog/uitspraak-van-rechtbank-amsterdam-de-rechtsgeldige-handtekening/ (ECLI:NL:RBAMS:2022:793) · https://www.tk.nl/nieuws/digitale-handtekening
- Selling-broker Wwft duty ("dubbel werk"): https://ellentimmer.com/2018/08/16/wwft-77/
- NVM Wwft-check tooling: https://www.nvm.nl/nieuws/2024/nvm-meer-dan-10000-anti-witwascontroles-per-maand-door-makelaars-via-movenl/
- EAA scope: https://www.russell.nl/en/publication/digital-products-services-accessible/
- PLD transposition tracker: https://cms.law/en/bel/legal-updates/transposition-time-update-on-the-eu-member-states-adoption-of-the-new-product-liability-directive
- eIDAS 2.0 / EUDI wallet: https://www.arthurcox.com/knowledge/the-eu-digital-identity-wallet-what-companies-need-to-know/
- UBO register access 2025–26: https://newtone.nl/inzichten/actualiteiten-ubo-register-nieuwe-regels-en-toegang-vanaf-2026/
- WOR instemmingsrecht: https://pelsrijcken.nl/kennis/het-medezeggenschapsrecht-deel-3-hoe-zit-het-ook-alweer-met-het-instemmingsrecht

**Could not verify (do not cite externally without checking):** exact NL implementing decree for the EAA; NL PLD bill number; EUDI wallet date 24 Dec 2026; final adopted text of EDPB LI guidelines 01/2024 and pseudonymisation 01/2025; Mailgun and Supabase DPF status; existence of real-estate-specific sanctions guidance; Dils NL's NVM membership and OR status.

---

## 9. Status after the 2026-09-07 remediation

Re-checked against `origin/master` (head `c52527c` at verification time) on 2026-09-07 evening. Every cell below was confirmed with `grep`/`sed -n` against the current tree, not copied from a PR description; see [code-fact-sheet-2026-09.md §14](code-fact-sheet-2026-09.md#14-changes-since-6017154) for the underlying `path:line` evidence.

| Gap | Status | PR(s) | What remains |
|---|---|---|---|
| G1 · June remediation unmerged | Partly | #170, #187 | Purge cron is wired (`vercel.json`, `src/app/api/cron/purge/route.ts`) but runs dry-run unless `PURGE_ENABLED=true` (`route.ts:41`) and needs `CRON_SECRET` set in Vercel (`route.ts:35`); the 4 sub-processor DPAs are still unsigned per `compliance/README.md`. |
| G2 · Wrong controller identity, no Art. 13/14 notice | Shipped | #185 | `<PrivacyNotice>` (`src/components/privacy-notice.tsx`) renders on login, forgot-password, request-access and both signing surfaces; `/privacy` (`src/app/privacy/page.tsx:45`) names the correct controller; the investor-shell footer (`src/components/investor/investor-shell.tsx:56`) dropped the Italian VAT number; `CompanyContact.source`/`collectedAt` added (`prisma/schema.prisma:275-276`). ⚖️ Legal review of the `/privacy` text itself is still open (README doc 1). |
| G3 · Nothing purged, deletion is obfuscation | Partly | #187 (cron); no anonymisation change | Cron exists but is dry-run by default (see G1). `removeInvestor` (`src/actions/invite-actions.ts:517`) still only rewrites the email to `<email>.removed-<ts>` on the fallback path — name, comments, signature images, signed PDFs and `ActivityLog.metadata.email` still survive; storage objects are still never deleted on removal. |
| G4 · Staff audit log without OR consent | Partly | #186 | `compliance/dpia-screening-staff-audit-log.md`, `staff-monitoring-protocol.md` and `or-instemmingsverzoek-audit-log.md` are drafted, but README still lists them "📋 Draft → Noah/OR" with open placeholders (OR status, assessor/DPO names) — the actual OR instemming step has not been taken. |
| G5 · No opt-out, unsubscribes ignored | Shipped | #176 | `h:List-Unsubscribe` / `h:List-Unsubscribe-Post` sent on every email (`src/lib/email.ts:99-100`); `EmailSuppression` model (`prisma/schema.prisma:547-553`); tokenised route in `src/lib/unsubscribe.ts`. Nothing outstanding. |
| G6 · Tracking without consent | Shipped as consent | #177 | Every send checks `hasTrackingConsent` and sets `o:tracking*` flags (`src/lib/email.ts:108-110`, `src/lib/email-tracking.ts:66-70`), default off; `EmailTrackingConsent` model (`prisma/schema.prisma:563-575`); opt-in UI at `/portal/preferences`. Nothing outstanding. |
| G7 · No Wwft/sanctions gate | Shipped | #188 | `Company.cddStatus`/`cddClearedAt`/`cddClearedByUserId`/`sanctionsScreenedAt` (`prisma/schema.prisma:236-243`), attestation UI + NBO soft-gate warning in `src/components/asset/tracking-detail-drawer.tsx`. ⚖️ Counsel still needs to confirm buy-side CDD scope/depth (README open item, §6 Q2 above). |
| G8 · Thin e-signature evidence | Shipped (pending merge) | #172 + #194 | certificate page, signer copy, intent checkbox; ⚖️ confirm BW 3:15a sufficiency for SPAs; offer-letter upload path brought to parity in #TBD-PR |
| G9 · Auth below 2026 baseline | Partly | #190 | `PasswordSetToken` (`prisma/schema.prisma:117-132`) + `src/lib/set-password-actions.ts` replace emailed plaintext passwords; `failedLoginCount`/`lockedUntil` (`schema.prisma:87-88`) + `src/lib/login-lockout.ts` add a 15-minute lockout after repeated failures. MFA is still not implemented (`totp\|mfa\|2fa\|webauthn\|authenticator` greps to zero real hits) — plan-only in `compliance/mfa-implementation-plan.md`. |
| G10 · No download log, unguarded timeline page | Shipped | #189 (download log); #173 (page guard, merged earlier but still true on current master) | `DOCUMENT_ACCESSED` now logged for every role (`src/actions/document-actions.ts:672`, `src/actions/html-nda-actions.ts:655`, `src/actions/content-actions.ts:279`); the timeline page now calls `requireAssetAccess` and strips staff identities for VIEWER via `loadTrackingTimeline` (`src/lib/timeline.ts:25,62`). Watermarking and access expiry on deal close are still open. |
| G11 · Hosting region / sub-processor paperwork | Partly | #187 | `vercel.json:2` pins `"regions": ["fra1"]`. DPAs (Supabase, Vercel, Mailgun, Upstash) still unsigned and the Upstash region is still unconfirmed per `compliance/README.md`'s transfer-verification checklist. |
| G12 · Vulnerability disclosure | Shipped | #189 | `public/.well-known/security.txt` and `.github/SECURITY.md` both present. Nothing outstanding. |
| G13 · Portal terms of use | Shipped (pending merge) | this PR | `TermsAcceptance` model + click-accept page at `/portal/terms`, gated via `src/app/(investor)/portal/(gated)/layout.tsx`; evidence (version/timestamp/IP/UA) recorded by `src/actions/terms-actions.ts`. Terms text is still the existing external "Algemene voorwaarden" page — ⚖️ counsel to confirm it covers portal use (README open item). |
| G14 · Free-text PII risk | Shipped (pending merge) | #170 BSN + #192 IBAN/ID-document guards | — |
| G15 · Calendar items | Open | — | No AI Act literacy note, Data Act contract check, or Wft/SPV reclassification flag added since June; dates in §5 above are unchanged. |
