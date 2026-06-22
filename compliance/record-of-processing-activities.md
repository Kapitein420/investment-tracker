# Record of Processing Activities (RoPA) — Art. 30 GDPR

> **Controller:** Dils Netherlands B.V. · KvK 33.180.131 · Gustav Mahlerplein 72, 1082 MA Amsterdam · `privacy.netherlands@dils.com`
> **Scope:** the DILS Investor Portal (deal-pipeline / investor application). Website-enquiry and recruitment processing are recorded under the company's existing RoPA.
> **Why we keep this:** the "fewer than 250 employees" exemption (Art. 30(5)) does **not** apply because the processing is **not occasional** (an always-on portal). Maintain this document; review at least annually and on any material change.
> **Last reviewed:** 2026-06-22 (initial draft).

## A. Processing activities

### A1 — Investor & broker relationship / deal-pipeline management
- **Purpose:** manage commercial-real-estate deals and the relationships with investors, brokers and advisors through the pipeline (teaser → NDA → IM → viewing → NBO).
- **Lawful basis:** legitimate interest (Art. 6(1)(f)) — running the advisory business; for invited investors with an account, also contract (Art. 6(1)(b)). See LIA.
- **Data subjects:** investor/broker/advisor contacts; internal staff.
- **Data categories:** names, business email, phone; company/firm; relationship notes & comments; interest level; bid/offer amounts (financial); deal associations.
- **Recipients / sub-processors:** Supabase (database), Vercel (hosting). See doc 4.
- **Retention:** see retention schedule (active + 24 months after relationship ends, unless under legal hold).

### A2 — User accounts & authentication
- **Purpose:** create and secure user logins to the portal; role-based access.
- **Lawful basis:** contract (Art. 6(1)(b)); security processing under legitimate interest (Art. 6(1)(f)).
- **Data subjects:** all portal users (admins, editors, viewers, investors).
- **Data categories:** name, email, bcrypt password hash, role, company membership, password-changed timestamp.
- **Recipients / sub-processors:** Supabase (database), Vercel (hosting).
- **Retention:** life of the account + 12 months after deactivation, then purge/anonymise.

### A3 — Electronic signing of documents
- **Purpose:** let investors sign NDAs and related documents online.
- **Lawful basis:** contract (Art. 6(1)(b)); legal obligation for retention of signed records (Art. 6(1)(c)).
- **Data subjects:** signing investors/contacts.
- **Data categories:** signer name & email, signature image (PNG), signed PDF, timestamps, signing tokens.
- **Recipients / sub-processors:** Supabase (database + private file storage), Vercel.
- **Retention:** signed documents kept per statutory/AML period (confirm with counsel — generally up to 5 years or longer for contracts); signing tokens purged after expiry.

### A4 — Transactional email
- **Purpose:** send invitations, credential/access emails and deal notifications.
- **Lawful basis:** contract (Art. 6(1)(b)) / legitimate interest (Art. 6(1)(f)).
- **Data subjects:** invited contacts and portal users.
- **Data categories:** recipient name & email, email content (may reference company, asset/deal, teaser preview), an actor tag.
- **Recipients / sub-processors:** Mailgun (EU endpoint `api.eu.mailgun.net`).
- **Retention:** message logs/events per Mailgun's retention; in-app invite records purged after expiry.

### A5 — Security, rate-limiting & audit logging
- **Purpose:** protect the portal against brute-force/abuse and maintain an audit trail for breach detection/investigation.
- **Lawful basis:** legitimate interest (Art. 6(1)(f)); supports Art. 32 security obligations.
- **Data subjects:** all users and login attempters.
- **Data categories:** email + IP (rate-limit keys, short-lived); ActivityLog (userId, action, metadata, timestamp).
- **Recipients / sub-processors:** Upstash/Vercel KV (rate-limit counters), Supabase (activity logs), Vercel (platform logs).
- **Retention:** rate-limit keys auto-expire (minutes); activity logs aged out per retention schedule (proposed 24 months).

## B. Recipients & international transfers (fill in after verification)

| Sub-processor | Role | Region (verify) | Transfer basis | DPA status / date |
|---|---|---|---|---|
| Supabase | Database + file storage | ✅ EU — Ireland (`eu-west-1`) | SCCs (Supabase DPA) | ☐ |
| Vercel | App hosting | ☐ EU (`fra1`/`ams`) | EU-US DPF | ☐ |
| Mailgun (Sinch) | Transactional email | EU (`api.eu.mailgun.net`) | DPA / SCCs | ☐ |
| Upstash / Vercel KV | Rate-limit / security | ☐ EU | DPA / SCCs | ☐ |

## C. Technical & organisational security measures (Art. 32 summary)
bcrypt(12) password hashing; signed JWT sessions with rotation & invalidation; role-based access + Supabase Row-Level Security; distributed login rate-limiting (fail-closed); HSTS + strict CSP + security headers; CSPRNG invite/signing tokens with expiry; Prisma parameterised queries + Zod validation + DOMPurify; private file storage with short-lived signed URLs; secrets in environment only; GitHub push-protection & secret-scanning. **Open:** admin MFA; confirm at-rest encryption in writing; PII removed from logs (done — see `log-redact`).
