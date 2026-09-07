# Personal-data breach response runbook — Art. 33–34 GDPR

> **Controller:** Dils Netherlands B.V. **Goal:** detect, assess and (where required) report a personal-data breach to the **Autoriteit Persoonsgegevens (AP)** within **72 hours** of becoming aware. Adopt this runbook and keep the breach register below. **Last reviewed:** 2026-06-22.

## Roles
- **Incident lead** — owns the response (named internal privacy contact / DILS NL lead).
- **Technical responder** — engineer with access to Vercel, Supabase, logs.
- **Legal/escalation** — Dutch counsel/DPO for the notification decision.

## Steps

**1. Detect & contain (immediately).** Identify the breach (unauthorised access, loss, leak, accidental disclosure). Contain it — rotate keys, revoke sessions/tokens, disable affected accounts, isolate. Record the **time you became aware** — this starts the 72-hour clock.

**2. Assess risk (hours 0–24).** Determine: what data, whose, how many, what could happen to them. Was the data **encrypted** (at rest/in transit)? Encryption that renders data unintelligible materially reduces the Art. 34 individual-notification duty.

**3. Decide notification.**
- **Notify the AP** (Art. 33) **unless** the breach is *unlikely* to result in a risk to individuals. When in doubt, notify. Use the AP portal: **autoriteitpersoonsgegevens.nl** → *Meldloket datalekken*.
- **Notify affected individuals** (Art. 34) **if** the breach is likely to result in a **high risk** to them — without undue delay, in plain language.

**4. Notify the AP within 72h** with the Art. 33(3) content (template below). If full details aren't ready, file an initial report and follow up.

**5. Record in the breach register** — **every** breach, reportable or not (Art. 33(5)).

**6. Review.** Post-incident: root cause, remediation, update controls.

## AP notification content (Art. 33(3)) — template
- Nature of the breach; categories & approximate number of data subjects; categories & approximate number of records.
- Name & contact of the privacy contact / DPO.
- Likely consequences of the breach.
- Measures taken or proposed to address it and mitigate harm.

## Processor obligations
Each sub-processor (Supabase, Vercel, Mailgun, Upstash) must notify DILS **without undue delay** on becoming aware of a breach — verify this clause is in each DPA so we can meet the 72-hour clock.

## Breach register (log every incident)

| Date aware | Description | Data & subjects affected | Risk assessment | AP notified? (date) | Individuals notified? | Measures taken | Status |
|---|---|---|---|---|---|---|---|
| _e.g. 2026-..._ | | | low / high | yes/no | yes/no | | open/closed |
