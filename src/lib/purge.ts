/**
 * Data-retention purge (GDPR Art. 5(1)(e), "storage limitation").
 * Enforces compliance/data-retention-schedule.md.
 *
 * Conservative by design:
 *  - Signing tokens: deleted 30 days after they expire (used or not).
 *  - Set-password tokens: same 30-day grace past expiry.
 *  - Investor invites: deleted 30 days after expiry IF never accepted.
 *  - Activity logs: deleted after 24 months.
 *  - Signed documents / signature images are NEVER touched here — they are
 *    under legal hold (AML / contract retention). See the retention schedule.
 *
 * Called from scripts/purge-expired-data.ts (manual CLI) and
 * src/app/api/cron/purge/route.ts (Vercel Cron, daily).
 */
import { prisma } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

export interface PurgeCounts {
  signingTokens: number;
  passwordSetTokens: number;
  investorInvites: number;
  activityLogs: number;
}

export async function runPurge({ dryRun }: { dryRun: boolean }): Promise<PurgeCounts> {
  const now = Date.now();
  const expiredGraceCutoff = new Date(now - 30 * DAY); // 30-day grace past expiry
  const activityLogCutoff = new Date(now - 24 * 30 * DAY); // ~24 months

  const tokenWhere = { expiresAt: { lt: expiredGraceCutoff } };
  const inviteWhere = { acceptedAt: null, expiresAt: { lt: expiredGraceCutoff } };
  const logWhere = { createdAt: { lt: activityLogCutoff } };

  if (dryRun) {
    const [signingTokens, passwordSetTokens, investorInvites, activityLogs] =
      await Promise.all([
        prisma.signingToken.count({ where: tokenWhere }),
        prisma.passwordSetToken.count({ where: tokenWhere }),
        prisma.investorInvite.count({ where: inviteWhere }),
        prisma.activityLog.count({ where: logWhere }),
      ]);
    return { signingTokens, passwordSetTokens, investorInvites, activityLogs };
  }

  const [signingTokens, passwordSetTokens, investorInvites, activityLogs] =
    await Promise.all([
      prisma.signingToken.deleteMany({ where: tokenWhere }),
      prisma.passwordSetToken.deleteMany({ where: tokenWhere }),
      prisma.investorInvite.deleteMany({ where: inviteWhere }),
      prisma.activityLog.deleteMany({ where: logWhere }),
    ]);
  return {
    signingTokens: signingTokens.count,
    passwordSetTokens: passwordSetTokens.count,
    investorInvites: investorInvites.count,
    activityLogs: activityLogs.count,
  };
}
