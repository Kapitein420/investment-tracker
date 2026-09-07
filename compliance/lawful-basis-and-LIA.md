# Lawful basis & Legitimate Interests Assessment (LIA) — Art. 6 GDPR

> **For legal review.** Documents the lawful basis per processing purpose and the balancing test for legitimate-interest processing. **Last reviewed:** 2026-06-22.

## Lawful basis per purpose

| Purpose | Basis | Why |
|---|---|---|
| Give an invited user access to and operate the portal | **Contract** — Art. 6(1)(b) | Processing is necessary to provide the service the user has an account/relationship for. |
| Manage the deal pipeline & investor/broker/advisor relationships | **Legitimate interest** — Art. 6(1)(f) | Core B2B relationship management; see LIA below. |
| Security, rate-limiting, audit logging, fraud/abuse prevention | **Legitimate interest** — Art. 6(1)(f) | Protecting the service and its data; also supports Art. 32. |
| Retain signed documents / AML records | **Legal obligation** — Art. 6(1)(c) | Statutory/AML record-keeping (confirm scope with counsel). |
| Any non-essential analytics or marketing (none currently) | **Consent** — Art. 6(1)(a) | Reserve consent for this only; keep out of core flows. |

> Consent is **not** used as the basis for core portal processing. The only cookie set by the portal is strictly necessary (sign-in), which is consent-exempt under Tw Art. 11.7a.

## LIA — pipeline & relationship management (and security processing)

**1. Purpose / interest.** DILS has a legitimate, real and present commercial interest in operating a secure system to manage commercial-real-estate transactions and its relationships with investors, brokers and advisors, and in protecting that system from abuse. This is a lawful, clearly-articulated business interest.

**2. Necessity.** The processing (storing contacts, deal associations, interest levels, bids, notes; logging activity; rate-limiting) is necessary to run the pipeline and keep it secure. There is no materially less-intrusive way to achieve the same outcome — the data held is limited to what the relationship and security require.

**3. Balancing test.** Data subjects are business contacts (investors/brokers/advisors) operating in a professional capacity; the data is predominantly business-contact and transaction data, not sensitive. Such contacts **reasonably expect** that a counterparty manages the relationship in a CRM-type system. Safeguards reduce any residual impact:
- Access is role-based and least-privilege; investors see only their own deals (Row-Level Security).
- Strong security (bcrypt, signed sessions, rate-limiting, private storage, encryption in transit).
- A privacy notice informs subjects; they can **object** (Art. 21) at `privacy.netherlands@dils.com`.
- No special-category data is intended; free-text fields carry a "no BSN / no sensitive data" guard.
- Defined retention; data not kept longer than necessary.

**Conclusion.** The legitimate interest is **not overridden** by the interests or fundamental rights of the data subjects, given the professional context, the limited and expected nature of the data, and the safeguards. Legitimate interest is an appropriate basis. **Re-run this LIA** if the portal starts profiling/scoring investors, processes special-category data, or materially expands its data subjects.
