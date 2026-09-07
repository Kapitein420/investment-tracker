# Protocol logging en controle in de Investment Tracker / Staff monitoring protocol

> **Verwerkingsverantwoordelijke / Controller:** Dils Netherlands B.V. · KvK 33.180.131 · Gustav Mahlerplein 72, 1082 MA Amsterdam · `privacy.netherlands@dils.com`. **Geen juridisch advies / Not legal advice** — dit protocol moet worden beoordeeld door een Nederlandse privacyjurist/DPO en (indien van toepassing) worden voorgelegd aan de ondernemingsraad voordat het wordt vastgesteld. **Versie:** 1.0 · **Datum:** 2026-09-07.

## Open items

- [[confirm: does Dils NL have an ondernemingsraad (OR)? If yes, this protocol is the attachment to the *instemmingsverzoek* — see [or-instemmingsverzoek-audit-log.md](or-instemmingsverzoek-audit-log.md).]]
- [[confirm: naam/link van de huidige klokkenluidersregeling / name-link of the current whistleblower channel]]

---

## NL — Protocol logging en controle in de Investment Tracker

### 1. Doel

De Investment Tracker houdt een activiteitenlog (`ActivityLog`) en een wijzigingsgeschiedenis per deal (`StageHistory`) bij, zichtbaar via een tijdlijnpagina. Het doel hiervan is uitsluitend:

- **Deal-governance** — traceerbaar maken wie een stap in het verkoopproces heeft goedgekeurd, gewijzigd of teruggedraaid;
- **Beveiliging** — misbruik, fouten en ongeautoriseerde toegang kunnen worden opgespoord en onderzocht;
- **Bewijs** — bij een geschil (bijv. over een ondertekende NDA of bod) is aantoonbaar wie wat heeft gedaan en wanneer.

**Dit is nadrukkelijk géén prestatiebeoordelingssysteem.** De log wordt niet gebruikt om medewerkers te beoordelen, te vergelijken of te scoren, en voedt geen functionerings- of beoordelingsgesprek.

### 2. Wat wordt gelogd

Elke door medewerkers geïnitieerde actie in het deal-proces, onder meer: aanmaken/wijzigen/verwijderen van assets, bedrijven en trackings; statuswijzigingen en stage-goedkeuringen (`STATUS_UPDATED`, `STAGE_APPROVED`, `STAGE_REVERTED`); documentacties (`DOCUMENT_UPLOADED`, `DOCUMENT_SIGNED`, `DOCUMENT_DELETED`, `DOCUMENT_REJECTED`); uitnodigingen (`INVITE_SENT`, `BULK_INVITE_BATCH_*`); en accountacties (`PASSWORD_RESET`, `ACCESS_REQUESTED`). De volledige actielijst staat in [code-fact-sheet-2026-09.md §3](code-fact-sheet-2026-09.md). Vastgelegd wordt: de medewerker (`userId`), de actie, een tijdstempel en actie-specifieke metadata (bijv. e-mailadres van de ontvanger, documentnaam). Sinds PR #172 wordt bij ondertekeningen ook het IP-adres en de user agent van de *ondertekenaar* (niet de medewerker) vastgelegd, uitsluitend voor bewijswaarde van de handtekening.

### 3. Wie kan het zien

- **ADMIN en EDITOR**: volledige toegang tot het activiteitenlog en de tijdlijn (`requireRole("EDITOR")` in `src/actions/asset-actions.ts`, `tracking-actions.ts`, `content-actions.ts`; ADMIN-only overzicht op `/admin/invites`).
- **VIEWER** (opdrachtgever/klant): **uitgesloten** van medewerker-identiteiten. `canSeeContactDetails()` (`src/lib/permissions.ts:59-62`) staat dit niet toe; op de tijdlijnpagina ziet een VIEWER "Team member" in plaats van een naam (`src/lib/timeline.ts:79`).
- **Investeerders**: **nooit**. `requireAssetAccess` (`src/lib/permissions.ts:107-121`) laat alleen ADMIN, EDITOR en een geautoriseerde VIEWER door; elke andere rol — inclusief INVESTOR — krijgt een "Forbidden".

### 4. Bewaartermijn

**24 maanden** vanaf het moment van vastlegging, conform [data-retention-schedule.md](data-retention-schedule.md), gehandhaafd door `scripts/purge-expired-data.ts`. Een uitzondering geldt voor logregels die horen bij een document onder wettelijke bewaarplicht (ondertekende NDA's/offers): die worden **7 jaar** bewaard, gelijk aan het onderliggende document (zie [legal-landscape-and-gap-analysis-2026-09.md §4](legal-landscape-and-gap-analysis-2026-09.md)). *Let op: het purge-script draait nog niet automatisch (nog geen cron/scheduled job) — dit is een openstaand actiepunt, geen weerspiegeling van dit protocol.*

### 5. Wanneer mag dit in een HR-context worden gebruikt

**In beginsel nooit.** Gegevens uit dit systeem mogen alleen worden gebruikt in een aanstellings-, beoordelings-, disciplinaire of ontslagcontext als:

1. er een **nieuw, gedocumenteerd besluit** aan ten grondslag ligt om de log voor dát specifieke doel te raadplegen (dit protocol dekt dat gebruik niet op voorhand), én
2. per geval een **proportionaliteitstoets** is uitgevoerd (is er een minder ingrijpend middel? staat het doel in verhouding tot de inbreuk op de privacy van de medewerker?), én
3. de medewerker daarover — voor zover de aard van de zaak dat toelaat — wordt geïnformeerd.

### 6. Rechten van medewerkers

Medewerkers hebben recht op:
- **Inzage** — opvragen welke gegevens over hen zijn vastgelegd;
- **Rectificatie** — onjuiste gegevens laten corrigeren;
- **Bezwaar** — bezwaar maken tegen verwerking op basis van gerechtvaardigd belang.

Verzoeken via `privacy.netherlands@dils.com`. Zie ook [data-subject-request-procedure.md](data-subject-request-procedure.md) voor de procedure (van toepassing op alle betrokkenen, inclusief medewerkers).

### 7. Melding van misbruik

Vermoedt een medewerker dat dit systeem oneigenlijk wordt gebruikt (bijv. voor prestatiebeoordeling zonder nieuw besluit, of raadpleging buiten het hierboven omschreven doel)? Meld dit via de bedrijfsbrede **klokkenluidersregeling** (Wet bescherming klokkenluiders) — [[confirm: naam/link van de huidige klokkenluidersregeling]] — of rechtstreeks aan `privacy.netherlands@dils.com`.

---

## EN — Staff monitoring protocol (Investment Tracker)

### 1. Purpose

The Investment Tracker keeps an activity log (`ActivityLog`) and a per-deal change history (`StageHistory`), surfaced through a timeline page. Its purpose is limited to:

- **Deal governance** — making it traceable who approved, changed or reverted a step in the sale process;
- **Security** — detecting and investigating misuse, error or unauthorised access;
- **Evidence** — in a dispute (e.g. over a signed NDA or a bid), being able to show who did what and when.

**This is explicitly not a performance-appraisal system.** The log is not used to evaluate, rank or score staff, and does not feed into a performance or appraisal conversation.

### 2. What is logged

Every staff-initiated action across the deal pipeline, including: creating/editing/deleting assets, companies and trackings; status changes and stage approvals (`STATUS_UPDATED`, `STAGE_APPROVED`, `STAGE_REVERTED`); document actions (`DOCUMENT_UPLOADED`, `DOCUMENT_SIGNED`, `DOCUMENT_DELETED`, `DOCUMENT_REJECTED`); invites (`INVITE_SENT`, `BULK_INVITE_BATCH_*`); and account actions (`PASSWORD_RESET`, `ACCESS_REQUESTED`). The full action list is in [code-fact-sheet-2026-09.md §3](code-fact-sheet-2026-09.md). What is recorded: the staff member (`userId`), the action, a timestamp, and action-specific metadata (e.g. recipient email, document name). Since PR #172, signing events also capture the *signer's* IP address and user agent (not the staff member's), solely for signature evidentiary purposes.

### 3. Who can see it

- **ADMIN and EDITOR**: full access to the activity log and timeline (`requireRole("EDITOR")` in `src/actions/asset-actions.ts`, `tracking-actions.ts`, `content-actions.ts`; an ADMIN-only overview at `/admin/invites`).
- **VIEWER** (client): **excluded** from staff identities. `canSeeContactDetails()` (`src/lib/permissions.ts:59-62`) disallows this; on the timeline page a VIEWER sees "Team member" instead of a name (`src/lib/timeline.ts:79`).
- **Investors**: **never**. `requireAssetAccess` (`src/lib/permissions.ts:107-121`) only lets ADMIN, EDITOR and an authorised VIEWER through; every other role — including INVESTOR — is refused.

### 4. Retention

**24 months** from the record's creation date, per [data-retention-schedule.md](data-retention-schedule.md), enforced by `scripts/purge-expired-data.ts`. Rows tied to a document under statutory retention (signed NDAs/offers) are kept **7 years**, matching the underlying document (see [legal-landscape-and-gap-analysis-2026-09.md §4](legal-landscape-and-gap-analysis-2026-09.md)). *Note: the purge script does not yet run automatically (no scheduled job) — this is a separate open action item, not a gap in this protocol.*

### 5. When it may be used in an HR context

**In principle, never.** Data from this system may only be used for a hiring, appraisal, disciplinary or termination purpose if:

1. a **new, documented decision** authorises consulting the log for that specific purpose (this protocol does not pre-authorise it), and
2. a **case-specific proportionality check** is carried out (is there a less intrusive means? is the purpose proportionate to the intrusion on the employee's privacy?), and
3. the employee is informed, to the extent the circumstances allow.

### 6. Employee rights

Employees have the right to:
- **Access (inzage)** — request what data has been recorded about them;
- **Rectification (rectificatie)** — have inaccurate data corrected;
- **Object (bezwaar)** — object to processing based on legitimate interest.

Requests via `privacy.netherlands@dils.com`. See also [data-subject-request-procedure.md](data-subject-request-procedure.md) (applies to all data subjects, including employees).

### 7. Reporting misuse

If an employee suspects this system is being misused (e.g. for performance appraisal without a fresh decision, or consulted outside the purpose described above), report it via the company-wide **whistleblower scheme** (Wet bescherming klokkenluiders) — [[confirm: name/link of the current whistleblower channel]] — or directly to `privacy.netherlands@dils.com`.

---

**Version 1.0 · 2026-09-07.** Review this protocol on any material change to what is logged, who can view it, or retention, and whenever [dpia-screening-staff-audit-log.md](dpia-screening-staff-audit-log.md) is re-run.
