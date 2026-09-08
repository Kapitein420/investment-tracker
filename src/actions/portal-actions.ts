"use server";

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { Prisma, StageStatusValue } from "@prisma/client";
import { syncCurrentStageKeyAfterCommit } from "@/lib/stage-sync";
import {
  readOfferPdf,
  resolveOfferStageId,
  replaceOfferDocument,
} from "@/lib/offer-document";
import { getClientIp, getClientUserAgent } from "@/lib/rate-limit";
import { getSignedUrl } from "@/lib/supabase-storage";
import { submitOfferSchema } from "@/lib/validators";

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

  // IM completion is now driven by NDA approval (see approval-actions).
  // VIEWED_DOCUMENT and DOWNLOADED still get logged via the activityLog
  // entry below as timeline events, but they never change the stage
  // status — the green check tracks "has access" not "has consumed".
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

  // Even when there's no status transition (e.g. IM downloaded after the
  // stage was already completed by NDA approval), we still log the event
  // to the activity timeline so the admin can see "investor downloaded
  // the IM at 14:02".
  const willTransition =
    next != null && STATUS_RANK[next] > STATUS_RANK[stageStatus.status];

  await prisma.$transaction(async (tx) => {
    if (willTransition && next != null) {
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
    }

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
          to: willTransition ? next : stageStatus.status,
        },
        userId: user.id,
      },
    });
  });

  // POST-COMMIT: roll currentStageKey forward (teaser open → COMPLETED, etc.).
  // Outside the transaction so a sync failure doesn't break event recording.
  if (willTransition) {
    await syncCurrentStageKeyAfterCommit(tracking.id);
  }

  return { ok: true, transitioned: willTransition };
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

  // Sprint B PR-2: investors can hold this asset under any of the
  // companies they belong to. The legacy User.companyId check rejected
  // investors with multi-company memberships if the tracking's company
  // happened to be a non-primary one — surfaced as "Forbidden" on the
  // Plan a viewing button. Use the membership shim instead, same as
  // getSignedHtmlNda already does.
  if (user.role === "INVESTOR") {
    const { getUserCompanyIds } = await import("@/lib/user-companies");
    const companyIds = await getUserCompanyIds(user.id);
    if (companyIds.length === 0) {
      return { ok: false, error: "No company associated" };
    }
    if (!companyIds.includes(tracking.companyId)) {
      return { ok: false, error: "Forbidden" };
    }
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
  });

  // POST-COMMIT: roll currentStageKey forward (Viewing → IN_PROGRESS).
  await syncCurrentStageKeyAfterCommit(tracking.id);

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
          Please reach out to schedule a date. The deal page in Investor Portal now shows
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

/**
 * Investor-side NBO offer submission.
 *
 * The mirror image of the admin's OfferSection: writes the same
 * bidAmount / bidCurrency / bidSubmittedAt on the tracking and the same
 * Document(kind="OFFER"), so an investor-submitted offer is
 * indistinguishable downstream from one an admin keyed in on their
 * behalf — the seller-side VIEWER and the pipeline table pick it up with
 * no extra plumbing.
 *
 * Gated on the NBO stage being unlocked (Viewing COMPLETED) and not yet
 * COMPLETED — once the deal team closes the stage the investor can no
 * longer overwrite the recorded bid.
 *
 * Re-submittable: the amount can be revised, and a new PDF atomically
 * replaces the previous one. Omitting the file on a re-submit keeps the
 * document already on file.
 */
export async function submitInvestorOffer(
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();

  if (user.role !== "INVESTOR" && user.role !== "ADMIN") {
    return { ok: false, error: "Forbidden" };
  }

  const trackingId = (formData.get("trackingId") as string | null) ?? "";
  if (!trackingId) return { ok: false, error: "Missing deal reference" };

  // Read the file up front — the schema needs to know whether one is
  // attached to decide if attestation is required.
  const file = formData.get("file") as File | null;
  const hasNewFile = !!file && file.size > 0;

  const parsed = submitOfferSchema.safeParse({
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    hasFile: hasNewFile,
    attestation: formData.get("attestation") === "true",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid offer",
    };
  }
  const { amount, currency } = parsed.data;

  const tracking = await prisma.assetCompanyTracking.findUnique({
    where: { id: trackingId },
    include: {
      asset: { select: { id: true, title: true, address: true, city: true } },
      company: {
        select: { id: true, name: true, contactEmail: true, contactName: true },
      },
      ownerUser: { select: { id: true, name: true, email: true } },
      stageStatuses: { include: { stage: true } },
    },
  });

  if (!tracking) return { ok: false, error: "Deal not found" };
  if (tracking.lifecycleStatus === "DROPPED") {
    return { ok: false, error: "This deal is no longer active" };
  }

  if (user.role === "INVESTOR") {
    const { getUserCompanyIds } = await import("@/lib/user-companies");
    const companyIds = await getUserCompanyIds(user.id);
    if (!companyIds.includes(tracking.companyId)) {
      return { ok: false, error: "Forbidden" };
    }
  }

  const unlocked = computeUnlockedStages(tracking.stageStatuses);
  if (!unlocked.nbo) {
    return {
      ok: false,
      error: "Complete the viewing stage before submitting an offer.",
    };
  }

  const nboStatus = tracking.stageStatuses.find((ss) => ss.stage.key === "nbo");
  if (!nboStatus) {
    return { ok: false, error: "NBO stage not configured for this asset." };
  }
  if (nboStatus.status === "COMPLETED") {
    return {
      ok: false,
      error:
        "The deal team has closed this stage — contact them to revise your offer.",
    };
  }

  // The PDF is optional throughout — an investor can record an indicative
  // figure now and attach the signed letter on a later submission. Omitting
  // it on a re-submit keeps whatever is already on file rather than
  // clearing it. (file / hasNewFile read above, ahead of schema validation.)
  const existingOffer = hasNewFile
    ? null
    : await prisma.document.findFirst({
        where: { trackingId, kind: "OFFER" },
        select: { id: true },
      });

  const oldBid =
    tracking.bidAmount == null ? null : tracking.bidAmount.toString();
  const submittedAt = new Date();
  // Set below, before the transaction, when a file is attached — read by
  // writeBid's OFFER_SUBMITTED log so the hash lands in the same audit
  // entry as the bid, not just on the Document row.
  let offerFileSha256: string | null = null;

  // Shared with the document path below so a submission carrying a PDF
  // commits the bid and the document in a single transaction.
  const writeBid = async (tx: Prisma.TransactionClient) => {
    await tx.assetCompanyTracking.update({
      where: { id: trackingId },
      data: {
        bidAmount: amount,
        bidCurrency: currency,
        bidSubmittedAt: submittedAt,
      },
    });

    await tx.stageHistory.create({
      data: {
        trackingId,
        stageId: nboStatus.stageId,
        fieldName: "bidAmount",
        oldValue: oldBid,
        newValue: String(amount),
        changedByUserId: user.id,
        note: "investor:OFFER_SUBMITTED",
      },
    });

    if (nboStatus.status === "NOT_STARTED") {
      await tx.stageStatus.update({
        where: { id: nboStatus.id },
        data: { status: "IN_PROGRESS", updatedByUserId: user.id },
      });
      await tx.stageHistory.create({
        data: {
          trackingId,
          stageId: nboStatus.stageId,
          fieldName: "status",
          oldValue: nboStatus.status,
          newValue: "IN_PROGRESS",
          changedByUserId: user.id,
          note: "investor:OFFER_SUBMITTED",
        },
      });
    }

    await tx.activityLog.create({
      data: {
        entityType: "AssetCompanyTracking",
        entityId: trackingId,
        action: "OFFER_SUBMITTED",
        metadata: {
          trackingId,
          assetId: tracking.assetId,
          companyId: tracking.companyId,
          companyName: tracking.company.name,
          amount: String(amount),
          currency,
          ...(offerFileSha256 ? { pdfSha256: offerFileSha256 } : {}),
        },
        userId: user.id,
      },
    });
  };

  let offerDoc: Awaited<ReturnType<typeof replaceOfferDocument>> | null = null;
  if (hasNewFile) {
    const buffer = await readOfferPdf(file!);
    offerFileSha256 = createHash("sha256").update(buffer).digest("hex");
    const stageId = await resolveOfferStageId(trackingId);
    offerDoc = await replaceOfferDocument({
      trackingId,
      stageId,
      buffer,
      fileName: file!.name,
      fileSize: file!.size,
      mimeType: file!.type,
      uploadedByUserId: user.id,
      action: "OFFER_DOCUMENT_SUBMITTED",
      metadata: { amount: String(amount), currency, source: "investor" },
      extraWrites: writeBid,
      signedByName: user.name,
      signedByEmail: user.email,
      ip: await getClientIp(),
      userAgent: await getClientUserAgent(),
      attestedAt: submittedAt,
    });
  } else {
    await prisma.$transaction(writeBid);
  }

  // POST-COMMIT: roll currentStageKey forward (NBO -> IN_PROGRESS).
  await syncCurrentStageKeyAfterCommit(trackingId);

  await notifyDealTeamOfOffer({
    tracking,
    amount,
    currency,
    letter: hasNewFile ? "new" : existingOffer ? "existing" : "none",
  });

  if (offerDoc) {
    await sendOfferReceipt({
      userId: user.id,
      toEmail: user.email,
      assetTitle: tracking.asset.title,
      amount,
      currency,
      fileName: file!.name,
      pdfSha256: offerDoc.pdfSha256,
      submittedAt,
      document: offerDoc,
    });
  }

  return { ok: true };
}

/**
 * Best-effort receipt to the investor who submitted a signed offer letter
 * (G8 / BW 3:15a: the submitter holds an independent copy, not just a
 * portal record — same rationale as signDocument's signed-copy email).
 * Never blocks or undoes the submission; a mail failure is logged only.
 */
async function sendOfferReceipt(args: {
  userId: string;
  toEmail: string;
  assetTitle: string;
  amount: number;
  currency: string;
  fileName: string;
  pdfSha256: string | null;
  submittedAt: Date;
  document: { id: string; fileUrl: string };
}): Promise<void> {
  const { userId, toEmail, assetTitle, amount, currency, fileName, pdfSha256, submittedAt, document } =
    args;

  try {
    const formatted = new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
    const submittedAtAmsterdam = `${new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Amsterdam",
    }).format(submittedAt)} (Europe/Amsterdam)`;
    const downloadUrl = await getSignedUrl(document.fileUrl, 7200);

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#1F2937; max-width:560px;">
        <h2 style="font-size:18px; margin:0 0 12px;">Your offer has been received</h2>
        <p style="font-size:14px; line-height:1.55; margin:0 0 12px;">
          We've received your offer for <strong>${escapeHtml(assetTitle)}</strong>, including
          your uploaded offer letter.
        </p>
        <table style="font-size:13px; line-height:1.6; margin:0 0 16px; border-collapse:collapse;">
          <tr><td style="padding:2px 12px 2px 0; color:#6B7280;">Offer</td><td><strong>${escapeHtml(formatted)}</strong></td></tr>
          <tr><td style="padding:2px 12px 2px 0; color:#6B7280;">File</td><td>${escapeHtml(fileName)}</td></tr>
          ${pdfSha256 ? `<tr><td style="padding:2px 12px 2px 0; color:#6B7280;">SHA-256</td><td style="font-family:monospace; font-size:11px;">${escapeHtml(pdfSha256)}</td></tr>` : ""}
          <tr><td style="padding:2px 12px 2px 0; color:#6B7280;">Submitted</td><td>${escapeHtml(submittedAtAmsterdam)}</td></tr>
        </table>
        <p style="font-size:13px; line-height:1.55; margin:0 0 12px;">
          <a href="${downloadUrl}" style="color:#1D4ED8;">Download your offer letter</a>
          — this link expires in 2 hours; the portal keeps a copy you can reach anytime from
          the deal page.
        </p>
      </div>
    `.trim();

    await sendEmail({
      to: toEmail,
      subject: `Your offer for ${assetTitle} has been received`,
      category: "transactional",
      html,
    });

    await prisma.activityLog.create({
      data: {
        entityType: "Document",
        entityId: document.id,
        action: "OFFER_RECEIPT_SENT",
        metadata: { toEmail },
        userId,
      },
    });
  } catch (e) {
    console.error(`[submitInvestorOffer] receipt email failed for doc ${document.id}:`, e);
  }
}

/**
 * Email the tracking owner (or every admin as fallback) that an offer
 * landed. Non-fatal: the offer is already persisted by the time this runs.
 */
async function notifyDealTeamOfOffer(args: {
  tracking: {
    asset: { title: string; address: string | null; city: string | null };
    company: {
      name: string;
      contactEmail: string | null;
      contactName: string | null;
    };
    ownerUser: { email: string | null } | null;
  };
  amount: number;
  currency: string;
  /** Whether this submission carried a PDF, reused the one on file, or has none. */
  letter: "new" | "existing" | "none";
}): Promise<void> {
  const { tracking, amount, currency, letter } = args;

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
  if (recipients.length === 0) return;

  const formatted = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

  const investorContact = tracking.company.contactName ?? tracking.company.name;
  const investorEmail = tracking.company.contactEmail ?? "(no contact email)";
  const location = tracking.asset.address
    ? ` (${escapeHtml(tracking.asset.address)}, ${escapeHtml(tracking.asset.city ?? "")})`
    : "";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color:#1F2937; max-width:560px;">
      <h2 style="font-size:18px; margin:0 0 12px;">Non-binding offer submitted</h2>
      <p style="font-size:14px; line-height:1.55; margin:0 0 12px;">
        <strong>${escapeHtml(tracking.company.name)}</strong> has submitted an offer for
        <strong>${escapeHtml(tracking.asset.title)}</strong>${location}.
      </p>
      <table style="font-size:13px; line-height:1.6; margin:0 0 16px; border-collapse:collapse;">
        <tr><td style="padding:2px 12px 2px 0; color:#6B7280;">Offer</td><td><strong>${escapeHtml(formatted)}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0; color:#6B7280;">Investor contact</td><td>${escapeHtml(investorContact)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0; color:#6B7280;">Email</td><td>${escapeHtml(investorEmail)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0; color:#6B7280;">Offer letter</td><td>${letter === "new" ? "Attached to the deal (PDF)" : letter === "existing" ? "Unchanged - previously submitted PDF still on file" : "Not attached - amount only"}</td></tr>
      </table>
      <p style="font-size:13px; line-height:1.55; margin:0;">
        The offer and its PDF are on the deal row in the pipeline. Wwft reminder: buyer CDD
        must be cleared before accepting.
      </p>
    </div>
  `.trim();

  await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `Offer submitted · ${tracking.asset.title} · ${tracking.company.name}`,
        html,
      })
    )
  );
}
