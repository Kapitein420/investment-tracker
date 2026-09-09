# Bulk send readiness runbook

> **Use this before any send larger than a handful of investors.** The goal is narrow and practical: the email lands in the inbox, and when the investor clicks, the portal opens instead of a corporate block page.
>
> Companion document: [email-dns-authentication.md](email-dns-authentication.md) covers the DNS half. This one covers everything else.

Investor-side IT is the adversary here, and it is not malicious — it is a bank or family office running Mimecast, Proofpoint, Zscaler or Netskope on default settings. Those defaults are hostile to exactly our profile: a young domain, sending in bulk for the first time, with links to a site nobody has ever visited.

---

## The three walls, in the order investors hit them

### Wall 1 — the mail gateway (message never arrives)

Covered by [email-dns-authentication.md](email-dns-authentication.md). Nothing else on this page matters until `spf=pass dkim=pass dmarc=pass` is confirmed on a real seed message.

### Wall 2 — the web filter (link is blocked or interstitialled)

**This is the one people forget, and it is the likeliest cause of "we hit an IT wall".**

Corporate web proxies classify every domain. A domain they have never seen is not "unknown", it is **uncategorised** — and a large share of enterprise deployments block uncategorised and newly-registered domains by default, because that is where phishing infrastructure lives. `dils-investorportal.nl` is young and low-traffic. Until it is categorised, a meaningful fraction of institutional investors will see a block page, not the portal.

Fixing it is free but slow: submit the domain to each vendor and ask for a business category. Allow **1–2 weeks** for propagation, so do this *before* the send, not in response to complaints.

Request the category **Finance / Business** (or **Real Estate** where offered). Never accept "Uncategorised".

| Vendor | Where to submit |
|---|---|
| Zscaler | `sitereview.zscaler.com` |
| Palo Alto Networks | `urlfiltering.paloaltonetworks.com` |
| Broadcom / Symantec (Bluecoat) | `sitereview.bluecoat.com` |
| Cisco Talos (Umbrella, ESA) | `talosintelligence.com/reputation_center` |
| Forcepoint | `csi.forcepoint.com` |
| Fortinet FortiGuard | `fortiguard.com/webfilter` |
| Trellix / McAfee | `trustedsource.org` |
| Trend Micro | `sitesafety.trendmicro.com` |
| Google Safe Browsing | check status at `transparencyreport.google.com/safe-browsing/search` |
| Microsoft SmartScreen | check/report via Bing Webmaster Tools |

Netskope and Sophos have no public form — raise it through the account team or support if a specific investor reports a block by those.

**Submit both hostnames** (`dils-investorportal.nl` and `www.dils-investorportal.nl`), since filters key on the exact host.

### Wall 3 — the portal itself (opens, but refuses them)

Two failure modes here, both now handled in code, both worth re-checking:

- **Shared egress IPs tripping rate limits.** A firm's mail gateway pre-fetches every URL in every inbound message for scanning, and an entire firm browses from a handful of NAT addresses. A bulk send to twenty people at one investor arrives as twenty near-simultaneous requests from one IP, before any human clicks. `emailLinkPageCap()` in `src/lib/rate-limit.ts` covers `/set-password/[token]`, `/sign/[token]` and the unsubscribe endpoint, and triples under `AUTH_LIMIT_BOOST` alongside the login caps.
- **Scanners burning single-use tokens.** Not a problem, verified: `/set-password/[token]` and `/sign/[token]` only *read* the token on GET (`findValidPasswordSetToken`), and claim it inside the transaction that actually sets the password or signature. A Safe Links pre-fetch cannot consume an investor's link. Keep it that way — never move token consumption into a page render.

---

## Pre-send checklist

### T-minus 2 weeks

- [ ] Publish the DNS records in [email-dns-authentication.md](email-dns-authentication.md). Confirm `dmarc=pass` on a seed message.
- [ ] Submit both hostnames to every web-filter vendor in the table above.
- [ ] Submit `dils-investorportal.nl` to the HSTS preload list at `hstspreload.org`. The header in `next.config.js` already declares `preload`, but the declaration does nothing until the domain is actually registered. Note this is slow to reverse — a couple of months — so treat it as a decision, not a checkbox.

### T-minus 1 week

- [ ] **Confirm `NEXTAUTH_URL` on Vercel is `https://www.dils-investorportal.nl`.** This is the highest-risk single setting. Every link in every email is built from it (`src/lib/app-url.ts`), and if it is still the `investment-tracker-wd1b.vercel.app` fallback, the entire send ships links to shared app-hosting space that filters treat as phishing infrastructure — while the mail itself comes from `mg.dils.com`. A From-domain and link-domain that don't match is the classic phishing shape, and it undoes everything above.
- [ ] Verify the certificate and headers actually serve on the branded domain:
      `curl -sSI https://www.dils-investorportal.nl` — expect HTTP 200, and `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` all present. Vercel provisions and renews the TLS certificate automatically; there is nothing to install, but confirm it is live on **both** apex and `www`, and that the apex redirects to `www`.
- [ ] Confirm the apex is in `allowedOrigins` in `next.config.js` (it is) so server actions work for investors who drop the `www`.
- [ ] Check `https://www.dils-investorportal.nl/.well-known/security.txt` resolves and its `Expires` date is still in the future. Some vendor scanners and reviewers look for it.

### T-minus 1 day

- [ ] Send a seed batch to test mailboxes: Gmail, Outlook.com, a Microsoft 365 tenant, and — most valuable — one friendly contact **inside an actual institutional investor**. That last one is the only real test of walls 2 and 3.
- [ ] For each: confirm inbox placement (not Promotions, not Junk), confirm the images load, confirm the CTA link opens the portal, and confirm the plain-text part reads sensibly.
- [ ] Turn on launch mode — `AUTH_LIMIT_BOOST=true` on Vercel, then redeploy. The `/launch-mode` skill scripts this. It triples the login, password-reset, and email-link caps for the window.

### Send day

- [ ] **Ramp, don't blast.** `mg.dils.com` has no sending reputation until it has sent. A cold subdomain going from zero to two thousand messages in an hour looks exactly like a compromised account. Spread the first send across a few hours, largest domains last, and watch bounces between batches.
- [ ] Watch Mailgun's dashboard for hard bounces and complaints. A complaint rate above **0.3%** is the threshold at which Gmail starts throttling the domain; above that, stop and diagnose.

### After

- [ ] Turn launch mode back off (`/launch-mode` off) once the onboarding window closes.
- [ ] Read the first DMARC aggregate reports and continue the ramp in [email-dns-authentication.md](email-dns-authentication.md).

---

## If an investor reports a block

1. **Get the exact wording and any block-page ID.** The page usually names the vendor — that tells you which submission to chase.
2. **Ask which of the three walls it is:** did the mail never arrive (wall 1), did the link show a block page (wall 2), or did the portal load and then refuse them (wall 3)?
3. **Wall 2 is the common case, and the fastest fix is on their side, not ours:** their IT can allowlist the domain in minutes, where recategorisation takes days. Give them the domain and a one-line description of what it is.
4. **Ask them to forward the original message with full headers** if it's wall 1. The `Authentication-Results` line their gateway added says precisely what failed.

## What is deliberately *not* on this list

- **ISO 27001 / SOC 2.** Organisational certifications, months of audit, and not what an inbox or a web proxy checks. They matter for a formal vendor-security review, not for whether a bulk email lands.
- **An EV TLS certificate.** Browsers stopped surfacing any distinction years ago. Vercel's automatic certificate is exactly as good here.
