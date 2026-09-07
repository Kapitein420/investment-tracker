/**
 * Redaction helpers for server logs (GDPR Art. 32 / Art. 5(1)(f)).
 *
 * We log operational events (rate-limiting, email skips, auth failures) but
 * must not write raw personal data — email addresses and IPs — to the
 * console/platform logs, where it would persist and be readable by anyone
 * with log access. These helpers pseudonymise the value: enough to debug
 * (you can still correlate and see the domain / network) without recording
 * the full identifier.
 */

/** `anna@test.dils.com` → `a***@test.dils.com`. Masks the local-part. */
export function redactEmail(email?: string | null): string {
  if (!email) return "<none>";
  const at = email.indexOf("@");
  if (at < 1) return "<redacted>";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local[0]}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
}

/** `192.168.1.42` → `192.168.1.x`; IPv6 keeps the first two groups. */
export function redactIp(ip?: string | null): string {
  if (!ip) return "<none>";
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return `${parts.slice(0, 2).join(":")}:***`;
  }
  const o = ip.split(".");
  return o.length === 4 ? `${o[0]}.${o[1]}.${o[2]}.x` : "<redacted>";
}
