import { describe, it, expect, vi, beforeEach } from "vitest";

// Same mocking style as permissions.test.ts / timeline.test.ts: stub the
// Prisma models runPurge touches so a dry run is provably read-only.
const tokenCount = vi.fn();
const tokenDeleteMany = vi.fn();
const setPasswordCount = vi.fn();
const setPasswordDeleteMany = vi.fn();
const inviteCount = vi.fn();
const inviteDeleteMany = vi.fn();
const logCount = vi.fn();
const logDeleteMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    signingToken: {
      count: (...a: unknown[]) => tokenCount(...a),
      deleteMany: (...a: unknown[]) => tokenDeleteMany(...a),
    },
    passwordSetToken: {
      count: (...a: unknown[]) => setPasswordCount(...a),
      deleteMany: (...a: unknown[]) => setPasswordDeleteMany(...a),
    },
    investorInvite: {
      count: (...a: unknown[]) => inviteCount(...a),
      deleteMany: (...a: unknown[]) => inviteDeleteMany(...a),
    },
    activityLog: {
      count: (...a: unknown[]) => logCount(...a),
      deleteMany: (...a: unknown[]) => logDeleteMany(...a),
    },
  },
}));

import { runPurge } from "./purge";

beforeEach(() => {
  tokenCount.mockReset().mockResolvedValue(3);
  tokenDeleteMany.mockReset().mockResolvedValue({ count: 3 });
  setPasswordCount.mockReset().mockResolvedValue(2);
  setPasswordDeleteMany.mockReset().mockResolvedValue({ count: 2 });
  inviteCount.mockReset().mockResolvedValue(1);
  inviteDeleteMany.mockReset().mockResolvedValue({ count: 1 });
  logCount.mockReset().mockResolvedValue(7);
  logDeleteMany.mockReset().mockResolvedValue({ count: 7 });
});

describe("runPurge", () => {
  it("dryRun: counts only, performs no deletes", async () => {
    const counts = await runPurge({ dryRun: true });

    expect(counts).toEqual({
      signingTokens: 3,
      passwordSetTokens: 2,
      investorInvites: 1,
      activityLogs: 7,
    });
    expect(tokenCount).toHaveBeenCalledTimes(1);
    expect(setPasswordCount).toHaveBeenCalledTimes(1);
    expect(inviteCount).toHaveBeenCalledTimes(1);
    expect(logCount).toHaveBeenCalledTimes(1);
    expect(tokenDeleteMany).not.toHaveBeenCalled();
    expect(setPasswordDeleteMany).not.toHaveBeenCalled();
    expect(inviteDeleteMany).not.toHaveBeenCalled();
    expect(logDeleteMany).not.toHaveBeenCalled();
  });

  it("live run: deletes and returns the delete counts", async () => {
    const counts = await runPurge({ dryRun: false });

    expect(counts).toEqual({
      signingTokens: 3,
      passwordSetTokens: 2,
      investorInvites: 1,
      activityLogs: 7,
    });
    expect(tokenDeleteMany).toHaveBeenCalledTimes(1);
    expect(setPasswordDeleteMany).toHaveBeenCalledTimes(1);
    expect(inviteDeleteMany).toHaveBeenCalledTimes(1);
    expect(logDeleteMany).toHaveBeenCalledTimes(1);
    expect(tokenCount).not.toHaveBeenCalled();
    expect(setPasswordCount).not.toHaveBeenCalled();
    expect(inviteCount).not.toHaveBeenCalled();
    expect(logCount).not.toHaveBeenCalled();
  });

  it("only targets unaccepted invites past their grace period", async () => {
    await runPurge({ dryRun: true });

    expect(inviteCount).toHaveBeenCalledWith({
      where: { acceptedAt: null, expiresAt: { lt: expect.any(Date) } },
    });
  });
});
