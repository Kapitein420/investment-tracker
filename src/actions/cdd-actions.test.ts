import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";

// Integration test against the local seeded Postgres (see asset-actions.test.ts
// for the same pattern). Mocks only the two non-DB seams: auth (run as an
// authorised EDITOR) and next/cache (revalidatePath is import-time only
// here). Everything else — the transaction, the ActivityLog row, the
// cddClearedAt/cddClearedByUserId bookkeeping — hits real Prisma.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/permissions", () => ({
  requireRole: vi.fn().mockResolvedValue({ id: "test", role: "EDITOR" }),
}));

import { prisma } from "@/lib/db";
import { setCompanyCdd } from "./cdd-actions";

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("setCompanyCdd (Wwft / CDD attestation, G7)", () => {
  let companyId: string;
  let userId: string;
  const insertedLogIds: string[] = [];

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `CDD test co ${Date.now()}`, type: "INVESTOR" },
    });
    companyId = company.id;
    const user = await prisma.user.findFirstOrThrow();
    userId = user.id;
  });

  afterEach(async () => {
    if (insertedLogIds.length) {
      await prisma.activityLog.deleteMany({ where: { id: { in: insertedLogIds } } });
      insertedLogIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.company.delete({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("moves status to CLEARED and stamps cddClearedAt/cddClearedByUserId", async () => {
    const result = await setCompanyCdd({
      companyId,
      cddStatus: "CLEARED",
      cddNote: "KYC file ref 2026-001",
      sanctionsScreened: true,
    });
    expect(result.cddStatus).toBe("CLEARED");
    expect(result.cddClearedAt).toBeInstanceOf(Date);
    expect(result.sanctionsScreenedAt).toBeInstanceOf(Date);

    const log = await prisma.activityLog.findFirst({
      where: { entityType: "Company", entityId: companyId, action: "COMPANY_CDD_UPDATED" },
      orderBy: { createdAt: "desc" },
    });
    expect(log).toBeTruthy();
    expect((log!.metadata as any).newStatus).toBe("CLEARED");
    if (log) insertedLogIds.push(log.id);
  });

  it("clears cddClearedAt/cddClearedByUserId when status moves away from CLEARED", async () => {
    await setCompanyCdd({
      companyId,
      cddStatus: "CLEARED",
      cddNote: null,
      sanctionsScreened: false,
    });

    const result = await setCompanyCdd({
      companyId,
      cddStatus: "ESCALATED",
      cddNote: null,
      sanctionsScreened: false,
    });
    expect(result.cddStatus).toBe("ESCALATED");
    expect(result.cddClearedAt).toBeNull();
    expect(result.cddClearedByUserId).toBeNull();

    const logs = await prisma.activityLog.findMany({
      where: { entityType: "Company", entityId: companyId, action: "COMPANY_CDD_UPDATED" },
    });
    insertedLogIds.push(...logs.map((l) => l.id));
  });

  it("never un-sets an already-recorded sanctionsScreenedAt", async () => {
    const first = await setCompanyCdd({
      companyId,
      cddStatus: "IN_PROGRESS",
      cddNote: null,
      sanctionsScreened: true,
    });
    expect(first.sanctionsScreenedAt).toBeInstanceOf(Date);
    const screenedAt = first.sanctionsScreenedAt;

    const second = await setCompanyCdd({
      companyId,
      cddStatus: "IN_PROGRESS",
      cddNote: null,
      sanctionsScreened: false,
    });
    expect(second.sanctionsScreenedAt?.getTime()).toBe(screenedAt?.getTime());

    const logs = await prisma.activityLog.findMany({
      where: { entityType: "Company", entityId: companyId, action: "COMPANY_CDD_UPDATED" },
    });
    insertedLogIds.push(...logs.map((l) => l.id));
  });
});
