# Email DNS authentication — `mg.dils.com`

> **Owner:** whoever administers DNS for `dils.com`. **Effort:** ~30 minutes to publish, then a 4-week DMARC ramp.
> **Why now:** without these records, a bulk investor send is authenticated by nothing. Gmail and Yahoo have required SPF + DKIM + DMARC from bulk senders since February 2024, and Microsoft since May 2025. Unauthenticated bulk mail is rejected or spam-foldered outright — this is the single biggest lever on whether investors ever see the invite.

## What the app already does

The sending side is complete in code; only DNS is missing.

| Requirement | Status | Where |
|---|---|---|
| One-click unsubscribe (RFC 8058) | ✅ | `src/lib/email.ts` — `List-Unsubscribe` + `List-Unsubscribe-Post` headers on every message |
| Honouring opt-outs | ✅ | `EmailSuppression` checked before every `category: "commercial"` send |
| No tracking without consent | ✅ | `src/lib/email-tracking.ts` — open pixel and link rewriting off unless the recipient opted in |
| `text/plain` alternative | ✅ | `src/lib/html-to-text.ts` — HTML-only mail scores as `MIME_HTML_ONLY` in SpamAssassin |
| SPF / DKIM / DMARC | ❌ **this document** | DNS at the `dils.com` registrar |

## The records

Sending domain is `mg.dils.com` on Mailgun's **EU** region (`MAILGUN_API_BASE=https://api.eu.mailgun.net/v3`). EU and US regions use different hostnames — the values below are the EU ones.

> **Authoritative source:** Mailgun → Sending → Domains → `mg.dils.com` → DNS records. Copy what that page shows. The table below is what it *should* show, so you can sanity-check it, and so DNS can be prepared before anyone logs into Mailgun.

| # | Type | Host | Value | Required? |
|---|---|---|---|---|
| 1 | TXT | `mg.dils.com` | `v=spf1 include:eu.mailgun.org ~all` | **Yes** |
| 2 | TXT | `<selector>._domainkey.mg.dils.com` | `k=rsa; p=MIGfMA0GCS...` — **copy verbatim from Mailgun** | **Yes** |
| 3 | TXT | `_dmarc.mg.dils.com` | `v=DMARC1; p=none; rua=mailto:dmarc@dils.com; fo=1` | **Yes** |
| 4 | MX | `mg.dils.com` | `10 mxa.eu.mailgun.org` | Recommended |
| 5 | MX | `mg.dils.com` | `10 mxb.eu.mailgun.org` | Recommended |
| 6 | CNAME | `email.mg.dils.com` | `eu.mailgun.org` | **Skip** — see below |

Notes on each:

1. **SPF.** Authorises Mailgun's EU sending IPs for mail whose envelope sender is `mg.dils.com`. `~all` (softfail) rather than `-all` while you ramp; tighten to `-all` once DMARC is at `p=reject`. Do **not** add a second `v=spf1` record on this host — multiple SPF records is a permanent error that fails SPF entirely.
2. **DKIM.** Mailgun generates the key and the selector; the selector is commonly `mx` or `krs` on EU accounts but is per-domain, so use exactly what the dashboard shows. If you switch Mailgun to a 2048-bit key, the value exceeds the 255-character limit for a single TXT string — most registrars split it automatically, but some need you to enter it as two quoted strings.
3. **DMARC.** Published on the **subdomain**, not on `dils.com`. A resolver checking `mg.dils.com` looks for `_dmarc.mg.dils.com` first and only falls back to the organisational record. Publishing here means the portal's policy is independent of corporate mail — you can ramp the portal to `p=reject` without touching anything the rest of Dils sends. **Check first whether `_dmarc.dils.com` already exists with an `sp=` value**: if corporate is already at `sp=reject`, `mg.dils.com` inherits rejection *today*, and records 1 and 2 are urgent rather than merely important.
4/5. **MX.** Only needed so Mailgun can receive bounces and complaint feedback at the subdomain. Without them you still send fine, but your suppression data gets thinner. Safe to add — `mg.dils.com` is a dedicated subdomain with no human mailboxes.
6. **Tracking CNAME.** Deliberately skipped. It exists so Mailgun can rewrite links through a click-tracking redirector, and this app keeps tracking off unless the recipient opts in (Telecommunicatiewet 11.7a). Not publishing it also helps deliverability: a redirector hostname between the visible link and the real destination is exactly the shape filters score as suspicious.

## Alignment — the part that is easy to get wrong

DMARC passes when SPF **or** DKIM passes *and* is aligned with the visible `From:` domain.

Default sends are `investments.netherlands@mg.dils.com` (`MAILGUN_FROM`). From-domain, DKIM `d=`, and envelope sender are all `mg.dils.com` — aligned under any setting.

But `src/actions/auth-actions.ts` supports `MAILGUN_FROM_ACCESS`, an override that sends welcome/credential mail from a broker address on **`dils.com`** so it matches the marketing mail that preceded it. If you use it:

- **Keep DMARC alignment relaxed.** Relaxed is the default — just don't add `adkim=s` or `aspf=s` to record 3. Under relaxed alignment, DKIM `d=mg.dils.com` aligns with `From: @dils.com` because both sit under the same organisational domain. Under strict, it does not, and every credential email fails DMARC.
- **The policy that applies is the corporate one.** With `From: @dils.com`, receivers evaluate `_dmarc.dils.com`, not our subdomain record. Confirm what corporate publishes before enabling the override.
- **Don't add Mailgun to the corporate SPF record** to "fix" this. Aligned DKIM alone is sufficient for DMARC to pass, and `include:eu.mailgun.org` on `dils.com` would authorise Mailgun to send as *any* corporate address. Not worth it.
- **Seed-test before using it in anger.** Leave `MAILGUN_FROM_ACCESS` unset until a seed send from that address shows `dmarc=pass`.

## Verify

```bash
dig +short TXT mg.dils.com                      # expect the v=spf1 record, exactly one
dig +short TXT <selector>._domainkey.mg.dils.com # expect k=rsa; p=...
dig +short TXT _dmarc.mg.dils.com               # expect v=DMARC1; ...
dig +short MX  mg.dils.com                      # expect mxa/mxb.eu.mailgun.org
```

Then send one real message to a Gmail address and open **Show original**. You want all three on the `Authentication-Results` line:

```
spf=pass  dkim=pass  dmarc=pass
```

Two out of three is not good enough for a bulk send.

## DMARC ramp

Do not start at `p=reject` — you will silently destroy mail you didn't know you were sending.

| Week | Record 3 value | What you're doing |
|---|---|---|
| 0 | `v=DMARC1; p=none; rua=mailto:dmarc@dils.com; fo=1` | Publish. Collect aggregate reports, change nothing. |
| 1–2 | unchanged | Read the reports. Every source should be Mailgun. Anything else is either a forgotten sender or someone spoofing you. |
| 3 | `v=DMARC1; p=quarantine; pct=25; rua=...` | Quarantine a quarter of failures. Watch for complaints. |
| 4 | `v=DMARC1; p=quarantine; pct=100; rua=...` | Full quarantine. |
| 5+ | `v=DMARC1; p=reject; rua=...` | Enforce. Also tighten record 1 to `-all` at this point. |

`rua=` needs a mailbox someone actually reads, or a DMARC report parser — raw aggregate reports are gzipped XML.

## Optional: BIMI

Once DMARC is at `p=quarantine` or `p=reject`, BIMI puts the DILS logo next to the sender name in Gmail and Apple Mail. It needs a `_bimi.mg.dils.com` record, an SVG Tiny PS logo, and — for Gmail — a **Verified Mark Certificate**, a genuine paid certificate from DigiCert or Entrust at roughly €1,000/year requiring a registered trademark.

Nice-to-have for an investor-facing brand, no deliverability effect on its own. Only worth revisiting after the ramp above is finished.
