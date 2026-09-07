/**
 * Data-retention purge (GDPR Art. 5(1)(e), "storage limitation").
 * Enforces compliance/data-retention-schedule.md.
 *
 *   npm run purge:dry   # count what WOULD be deleted (no writes)
 *   npm run purge       # perform the deletion
 *
 * Conservative by design:
 *  - Signing tokens: deleted 30 days after they expire (used or not).
 *  - Investor invites: deleted 30 days after expiry IF never accepted.
 *  - Activity logs: deleted after 24 months.
 *  - Signed documents / signature images are NEVER touched here — they are
 *    under legal hold (AML / contract retention). See the retention schedule.
 *
 * Wire to a daily scheduled job (Vercel Cron → protected route, or a GitHub
 * Action) once the retention periods are signed off by counsel.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const expiredGracecutoff = new Date(now - 30 * DAY); // 30-day grace past expiry
const activityLogCutoff = new Date(now - 24 * 30 * DAY); // ~24 months

const tokenWhere = { expiresAt: { lt: expiredGracecutoff } };
const inviteWhere = { acceptedAt: null, expiresAt: { lt: expiredGracecutoff } };
const logWhere = { createdAt: { lt: activityLogCutoff } };

async function main() {
  if (DRY) {
    const [tokens, invites, logs] = await Promise.all([
      prisma.signingToken.count({ where: tokenWhere }),
      prisma.investorInvite.count({ where: inviteWhere }),
      prisma.activityLog.count({ where: logWhere }),
    ]);
    console.log("[purge:dry] would delete (no changes made):");
    console.log(`  - signing tokens expired >30d:        ${tokens}`);
    console.log(`  - unaccepted invites expired >30d:     ${invites}`);
    console.log(`  - activity logs older than 24 months:  ${logs}`);
    console.log("  - signed documents / signatures:        0 (legal hold — never purged)");
    return;
  }

  const tokens = await prisma.signingToken.deleteMany({ where: tokenWhere });
  const invites = await prisma.investorInvite.deleteMany({ where: inviteWhere });
  const logs = await prisma.activityLog.deleteMany({ where: logWhere });
  console.log("[purge] deleted:");
  console.log(`  - signing tokens:   ${tokens.count}`);
  console.log(`  - expired invites:  ${invites.count}`);
  console.log(`  - activity logs:    ${logs.count}`);
}

main()
  .catch((e) => {
    console.error("[purge] failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
