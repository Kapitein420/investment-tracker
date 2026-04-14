/**
 * Get the canonical app URL for emails and links.
 *
 * Priority:
 * 1. NEXTAUTH_URL (manually set, should be stable production domain)
 * 2. VERCEL_PROJECT_PRODUCTION_URL (Vercel's stable production alias — survives deploys)
 * 3. VERCEL_URL (deployment-specific — breaks on new deploys, last resort)
 * 4. localhost (dev)
 *
 * IMPORTANT: NEXTAUTH_URL on Vercel should be set to the stable production
 * domain like https://investment-tracker-wd1b.vercel.app, NOT a deployment-
 * specific URL. Otherwise email links will break on every push.
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
