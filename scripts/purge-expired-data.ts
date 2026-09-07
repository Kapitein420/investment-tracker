/**
 * Data-retention purge CLI (GDPR Art. 5(1)(e), "storage limitation").
 * Enforces compliance/data-retention-schedule.md. Purge logic itself lives
 * in src/lib/purge.ts — this is a thin wrapper so the same code path also
 * runs from src/app/api/cron/purge/route.ts (Vercel Cron).
 *
 *   npm run purge:dry   # count what WOULD be deleted (no writes)
 *   npm run purge       # perform the deletion
 *
 * Once cron is confirmed working (see vercel.json), manual runs are for
 * ad-hoc checks only.
 */
import { prisma } from "../src/lib/db";
import { runPurge } from "../src/lib/purge";

const DRY = process.argv.includes("--dry");

async function main() {
  const counts = await runPurge({ dryRun: DRY });

  if (DRY) {
    console.log("[purge:dry] would delete (no changes made):");
    console.log(`  - signing tokens expired >30d:        ${counts.signingTokens}`);
    console.log(`  - unaccepted invites expired >30d:     ${counts.investorInvites}`);
    console.log(`  - activity logs older than 24 months:  ${counts.activityLogs}`);
    console.log("  - signed documents / signatures:        0 (legal hold — never purged)");
    return;
  }

  console.log("[purge] deleted:");
  console.log(`  - signing tokens:   ${counts.signingTokens}`);
  console.log(`  - expired invites:  ${counts.investorInvites}`);
  console.log(`  - activity logs:    ${counts.activityLogs}`);
}

main()
  .catch((e) => {
    console.error("[purge] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
