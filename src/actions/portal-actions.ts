"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { StageStatusValue } from "@prisma/client";
import { syncCurrentStageKey } from "@/actions/tracking-actions";

// Stage unlock rules:
// - teaser: always unlocked
// - nda: unlocked if teaser is COMPLETED
// - im / viewing: unlocked once the NDA is BOTH signed (status COMPLETED)
//   AND admin-approved (approvedAt set). The status check matters because
//   when an admin deletes a signed-and-approved NDA we deliberately keep
//   approvedAt around so the re-signed copy auto-re-approves; that
//   in-between state has approvedAt set but status NOT_STARTED, and IM /
//   Viewing must re-lock during the re-sign window.
// - nbo: unlocked if viewing is COMPLETED
const isNdaApprovedAndSigned = (
  stages: Map<string, { status: string; approvedAt: Date | null }>
): boolean => {
  const nda = stages.get("nda");
  return nda?.status === "COMPLETED" && nda?.approvedAt != null;
};

const STAGE_UNLOCK_RULES: Record<
  string,
  (stages: Map<string, { status: string; approvedAt: Date | null }>) => boolean
> = {
  teaser: () => true,
  nda: (stages) => stages.get("teaser")?.status === "COMPLETED",
  im: isNdaApprovedAndSigned,
  viewing: isNdaApprovedAndSigned,
  nbo: (stages) => stages.get("viewing")?.status === "COMPLETED",
};

function computeUnlockedStages(
  stageStatuses: Array<{
    stage: { key: string };
    status: string;
    approvedAt: Date | null;
  }>
): Record<string, boolean> {
  const stageMap = new Map(
    stageStatuses.map((ss) => [
      ss.stage.key,
      { status: ss.status, approvedAt: ss.approvedAt },
    ])
  );

  const unlocked: Record<string, boolean> = {};
  for (const [key, rule] of Object.entries(STAGE_UNLOCK_RULES)) {
    unlocked[key] = rule(stageMap);
  }

  return unlocked;
}

export async function getInvestorDeals() {
  const user = await requireUser();

  if (user.role !== "INVESTOR") {
    throw new Error("Forbidden: investor access only");
  }

  if (!user.companyId) {
    throw new Error("Investor has no associated company");
  }

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: { companyId: user.companyId },
    include: {
      asset: true,
      stageStatuses: {
        include: { stage: true },
        orderBy: { stage: { sequence: "asc" } },
      },
      documents: {
        include: {
          stage: true,
          signingTokens: {
            where: { usedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return trackings.map((tracking) => ({
    ...tracking,
    unlockedStages: computeUnlockedStages(tracking.stageStatuses),
  }));
}

export type InvestorStageEvent = "OPENED" | "VIEWED_DOCUMENT" | "DOWNLOADED";

// Monotonic ordering — we only allow transitions forward through this chain.
const STATUS_RANK: Record<StageStatusValue, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  BLOCKED: 1,
  DECLINED: 1,
  COMPLETED: 2,
};

/**
 * Given the investor's raw action on a stage, compute the next status the
 * stage should transition to, or null if this event is a no-op for that
 * stage. We never regress — the caller also guards against it.
 */
function nextStatusForEvent(
  stageKey: string,
  event: InvestorStageEvent,
  current: StageStatusValue
): StageStatusValue | null {
  const key = stageKey.toLowerCase();

  if (event === "OPENED" && key === "teaser") {
    // Opening the teaser landing page is equivalent to consuming it.
    if (current === "NOT_STARTED" || current === "IN_PROGRESS") return "COMPLETED";
    return null;
  }

  if (event === "OPENED" && key === "nda") {
    // Defensive — invite seed should already have put NDA at IN_PROGRESS.
    if (current === "NOT_STARTED") return "IN_PROGRESS";
    return null;
  }

  if (event === "VIEWED_DOCUMENT" && key === "im") {
    if (current === "NOT_STARTED") return "IN_PROGRESS";
    return null;
  }

  if (event === "DOWNLOADED" && key === "im") {
    if (current === "NOT_STARTED" || current === "IN_PROGRESS") return "COMPLETED";
    return null;
  }

  return null;
}

/**
 * Record an investor-side stage event from the portal. Fire-and-forget from
 * the client — any validation failure is swallowed server-side so we never
 * block the UI on tracking data.
 *
 * Only the investor's own company's tracking can be mutated, and the status
 * only transitions forward (never regresses).
 */
export async function recordInvestorStageEvent(input: {
  trackingId: string;
  stageKey: string;
  event: InvestorStageEvent;
}): Promise<{ ok: boolean; transitioned: boolean }> {
  const user = await requireUser();

  if (user.role !== "INVESTOR") {
    // Only investors (or the internal admin impersonating one) fire these.
    // Admins viewing via /portal with a companyId are allowed too.
    if (user.role !== "ADMIN") return { ok: false, transitioned: false };
  }

  if (!user.companyId) return { ok: false, transitioned: false };

  const tracking = await prisma.assetCompanyTracking.findUnique({
    where: { id: input.trackingId },
    select: { id: true, companyId: true, assetId: true },
  });

  if (!tracking) return { ok: false, transitioned: false };
  if (tracking.companyId !== user.companyId) {
    return { ok: false, transitioned: false };
  }

  const stageStatus = await prisma.stageStatus.findFirst({
    where: {
      trackingId: tracking.id,
      stage: { key: { equals: input.stageKey, mode: "insensitive" } },
    },
    include: { stage: true },
  });

  if (!stageStatus) return { ok: false, transitioned: false };

  const next = nextStatusForEvent(
    stageStatus.stage.key,
    input.event,
    stageStatus.status
  );

  if (!next) return { ok: true, transitioned: false };

  // Guard against regression (belt + suspenders with nextStatusForEvent).
  if (STATUS_RANK[next] <= STATUS_RANK[stageStatus.status]) {
    return { ok: true, transitioned: false };
  }

  await prisma.$transaction(async (tx) => {
    await tx.stageStatus.update({
      where: { id: stageStatus.id },
      data: {
        status: next,
        updatedByUserId: user.id,
        completedAt: next === "COMPLETED" ? new Date() : stageStatus.completedAt,
      },
    });

    await tx.stageHistory.create({
      data: {
        trackingId: tracking.id,
        stageId: stageStatus.stageId,
        fieldName: "status",
        oldValue: stageStatus.status,
        newValue: next,
        changedByUserId: user.id,
        note: `investor:${input.event}`,
      },
    });

    await tx.activityLog.create({
      data: {
        entityType: "StageStatus",
        entityId: stageStatus.id,
        action: "INVESTOR_STAGE_EVENT",
        metadata: {
          trackingId: tracking.id,
          assetId: tracking.assetId,
          stageKey: stageStatus.stage.key,
          event: input.event,
          from: stageStatus.status,
          to: next,
        },
        userId: user.id,
      },
    });

    // Roll currentStageKey forward so the admin pipeline-table reflects
    // investor-driven progress (teaser open → COMPLETED, IM viewed →
    // IN_PROGRESS, etc.).
    await syncCurrentStageKey(tx, tracking.id);
  });

  return { ok: true, transitioned: true };
}

/**
 * Investor requests a property viewing. Transitions the viewing stage to
 * IN_PROGRESS, logs StageHistory + ActivityLog with note "investor:VIEWING_REQUESTED",
 * and notifies the tracking's owner (or all admins as fallback) by email so
 * the broker can reach out to schedule a date.
 *
 * Idempotent — calling again on an already IN_PROGRESS / COMPLETED viewing
 * stage returns { alreadyRequested: true } without re-emailing.
 */
export async function requestViewing(
  trackingId: string
): Promise<{ ok: boolean; alreadyRequested?: boolean; error?: string }> {
  const user = await requireUser();

  if (user.role !== "INVESTOR" && user.role !== "ADMIN") {
    return { ok: false, error: "Forbidden" };
  }
  if (user.role === "INVESTOR" && !user.companyId) {
    return { ok: false, error: "No company associated" };
  }

  const tracking = await prisma.assetCompanyTracking.findUnique({
    where: { id: trackingId },
    include: {
      asset: { select: { id: true, title: true, address: true, city: true } },
      company: { select: { id: true, name: true, contactEmail: true, contactName: true } },
      ownerUser: { select: { id: true, name: true, email: true } },
      stageStatuses: {
        include: { stage: true },
      },
    },
  });

  if (!tracking) return { ok: false, error: "Deal not found" };

  if (user.role === "INVESTOR" && tracking.companyId !== user.companyId) {
    return { ok: false, error: "Forbidden" };
  }

  // Verify viewing stage is unlocked. Investors can request a viewing as
  // soon as the NDA is signed AND approved (in lockstep with IM access).
  // Both checks matter: if the admin deleted a previously-approved NDA the
  // approvedAt marker survives, so we additionally require the status to
  // be COMPLETED to confirm the *current* NDA copy was actually signed.
  const ndaStatus = tracking.stageStatuses.find((ss) => ss.stage.key === "nda");
  if (
    !ndaStatus?.approvedAt ||
    ndaStatus.status !== "COMPLETED"
  ) {
    return { ok: false, error: "Sign and have your NDA approved before requesting a viewing." };
  }

  const viewingStatus = tracking.stageStatuses.find(
    (ss) => ss.stage.key === "viewing"
  );
  if (!viewingStatus) {
    return { ok: false, error: "Viewing stage not configured for this asset." };
  }

  // Idempotent: already requested or completed
  if (
    viewingStatus.status === "IN_PROGRESS" ||
    viewingStatus.status === "COMPLETED"
  ) {
    return { ok: true, alreadyRequested: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.stageStatus.update({
      where: { id: viewingStatus.id },
      data: {
        status: "IN_PROGRESS",
        updatedByUserId: user.id,
      },
    });

    await tx.stageHistory.create({
      data: {
        trackingId: tracking.id,
        stageId: viewingStatus.stageId,
        fieldName: "status",
        oldValue: viewingStatus.status,
        newValue: "IN_PROGRESS",
        changedByUserId: user.id,
        note: "investor:VIEWING_REQUESTED",
      },
    });

    await tx.activityLog.create({
      data: {
        entityType: "StageStatus",
        entityId: viewingStatus.id,
        action: "VIEWING_REQUESTED",
        metadata: {
          trackingId: tracking.id,
          assetId: tracking.assetId,
          companyId: tracking.companyId,
          companyName: tracking.company.name,
        },
        userId: user.id,
      },
    });

    await syncCurrentStageKey(tx, tracking.id);
  });

  // Determine recipients: tracking owner, fallback to all admins
  const recipients: string[] = [];
  if (tracking.ownerUser?.email) {
    recipients.push(tracking.ownerUser.email);
  } else {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true },
    });
    for (const a of admins) {
      if (a.email) recipients.push(a.email);
    }
  }

  if (recipients.length > 0) {
    const investorContact = tracking.company.contactName ?? tracking.company.name;
    const investorEmail = tracking.company.contactEmail ?? "(no contact email)";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#1F2937; max-width:560px;">
        <h2 style="font-size:18px; margin:0 0 12px;">Property viewing requested</h2>
        <p style="font-size:14px; line-height:1.55; margin:0 0 12px;">
          <strong>${escapeHtml(tracking.company.name)}</strong> has requested a viewing for
          <strong>${escapeHtml(tracking.asset.title)}</strong>${tracking.asset.address ? ` (${escapeHtml(tracking.asset.address)}, ${escapeHtml(tracking.asset.city ?? "")})` : ""}.
        </p>
        <table style="font-size:13px; line-height:1.6; margin:0 0 16px; border-collapse:collapse;">
          <tr><td style="padding:2px 12px 2px 0; color:#6B7280;">Investor contact</td><td>${escapeHtml(investorContact)}</td></tr>
          <tr><td style="padding:2px 12px 2px 0; color:#6B7280;">Email</td><td>${escapeHtml(investorEmail)}</td></tr>
          <tr><td style="padding:2px 12px 2px 0; color:#6B7280;">Asset</td><td>${escapeHtml(tracking.asset.title)}</td></tr>
        </table>
        <p style="font-size:13px; line-height:1.55; margin:0;">
          Please reach out to schedule a date. The deal page in Investment Tracker now shows
          this row with the Viewing stage marked <em>In progress</em>.
        </p>
      </div>
    `.trim();

    // Fire all emails in parallel; failures are non-fatal — the request is
    // already persisted, the worst case is the broker has to spot it manually
    // in the pipeline view.
    await Promise.allSettled(
      recipients.map((to) =>
        sendEmail({
          to,
          subject: `Viewing requested · ${tracking.asset.title} · ${tracking.company.name}`,
          html,
        })
      )
    );
  }

  return { ok: true };
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function getAssetContentForInvestor(
  assetId: string,
  stageKey: string
) {
  const user = await requireUser();

  if (user.role !== "INVESTOR") {
    throw new Error("Forbidden: investor access only");
  }

  if (!user.companyId) {
    throw new Error("Investor has no associated company");
  }

  // Verify the investor's company has a tracking for this asset
  const tracking = await prisma.assetCompanyTracking.findFirst({
    where: {
      assetId,
      companyId: user.companyId,
    },
    include: {
      stageStatuses: {
        include: { stage: true },
        orderBy: { stage: { sequence: "asc" } },
      },
    },
  });

  if (!tracking) {
    throw new Error("No access to this asset");
  }

  // Verify the stage is unlocked
  const unlocked = computeUnlockedStages(tracking.stageStatuses);
  if (!unlocked[stageKey]) {
    throw new Error("This stage is not yet unlocked");
  }

  // For gated stages (im), additionally require both signed + approved
  // — see the deleteDocument note in document-actions.ts on why approvedAt
  // alone isn't enough during the re-sign window.
  if (stageKey === "im") {
    const ndaStatus = tracking.stageStatuses.find(
      (ss) => ss.stage.key === "nda"
    );
    if (!ndaStatus?.approvedAt || ndaStatus.status !== "COMPLETED") {
      throw new Error("NDA approval required to access IM content");
    }
  }

  const content = await prisma.assetContent.findMany({
    where: {
      assetId,
      stageKey,
      isPublished: true,
    },
  });

  return content.length > 0 ? content : null;
}
