/**
 * Get the canonical app URL for emails and links.
 *
 * Priority:
 * 1. NEXTAUTH_URL (manually set, should be stable production domain)
 * 2. VERCEL_PROJECT_PRODUCTION_URL (Vercel's stable production alias — survives deploys)
 * 3. VERCEL_URL (deployment-specific — breaks on new deploys, last resort)
 * 4. localhost (dev)
 *
 * IMPORTANT: NEXTAUTH_URL on Vercel must be set to the canonical branded
 * domain — https://www.dils-investorportal.nl — and NOT to a deployment-
 * specific URL, nor to the investment-tracker-wd1b.vercel.app fallback it
 * used to name here.
 *
 * Two reasons, beyond email links breaking on every push:
 *
 *  1. Every link in every outbound email is built from this value. Corporate
 *     web filters and mail gateways treat *.vercel.app as shared app-hosting
 *     space that is heavily used for phishing, so some block or interstitial
 *     it outright — the investor never reaches the portal.
 *  2. Mail sent From mg.dils.com whose links point at a completely unrelated
 *     domain is a classic phishing shape, and filters score it that way.
 *     From-domain and link-domain sharing the dils brand keeps that score down.
 *
 * See compliance/bulk-send-readiness-runbook.md before any bulk send.
 */
export function getAppUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
