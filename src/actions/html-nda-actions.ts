"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import {
  DEFAULT_NDA_TEMPLATE,
  extractTokens,
  renderTemplate,
  type TemplateField,
} from "@/lib/html-nda-template";
import { formatDate } from "@/lib/utils";

const HTML_NDA_FILEURL_PREFIX = "html:";

interface HtmlNdaMeta {
  isHtmlNda: true;
  fields: TemplateField[];
  adminFieldDefaults?: Record<string, string>;
}

function parseMeta(keyMetrics: unknown): HtmlNdaMeta | null {
  if (!keyMetrics || typeof keyMetrics !== "object") return null;
  const m = keyMetrics as any;
  if (!m.isHtmlNda) return null;
  return m as HtmlNdaMeta;
}

/**
 * Returns the master HTML NDA AssetContent for an asset, or null if the
 * admin hasn't enabled the HTML flow yet.
 */
export async function getHtmlNdaForAsset(assetId: string) {
  await requireUser();
  return findHtmlNda(assetId);
}

async function findHtmlNda(assetId: string) {
  const candidates = await prisma.assetContent.findMany({
    where: {
      assetId,
      stageKey: { equals: "nda", mode: "insensitive" },
      contentType: "LANDING_PAGE",
    },
    orderBy: { createdAt: "desc" },
  });
  return candidates.find((c) => parseMeta(c.keyMetrics) !== null) ?? null;
}

/**
 * Enables the HTML NDA flow for an asset. Idempotent — if one already
 * exists, returns it. Otherwise seeds a new AssetContent with the default
 * NDA template and the standard field set.
 */
export async function enableHtmlNdaForAsset(assetId: string) {
  await requireRole("EDITOR");

  const existing = await findHtmlNda(assetId);
  if (existing) return existing;

  const created = await prisma.assetContent.create({
    data: {
      assetId,
      stageKey: "nda",
      contentType: "LANDING_PAGE",
      title: "HTML NDA",
      htmlContent: DEFAULT_NDA_TEMPLATE.html,
      keyMetrics: {
        isHtmlNda: true,
        fields: DEFAULT_NDA_TEMPLATE.fields,
        adminFieldDefaults: {},
      } as any,
      isPublished: true,
    },
  });

  revalidatePath(`/assets/${assetId}`);
  return created;
}

/** Update the HTML body or the admin-pre-filled values on an existing template. */
export async function updateHtmlNdaTemplate(
  assetContentId: string,
  data: { html?: string; adminFieldDefaults?: Record<string, string>; fields?: TemplateField[] }
) {
  await requireRole("EDITOR");

  const existing = await prisma.assetContent.findUniqueOrThrow({
    where: { id: assetContentId },
  });
  const meta = parseMeta(existing.keyMetrics);
  if (!meta) throw new Error("Not an HTML NDA template");

  const newMeta: HtmlNdaMeta = {
    isHtmlNda: true,
    fields: data.fields ?? meta.fields,
    adminFieldDefaults: { ...(meta.adminFieldDefaults ?? {}), ...(data.adminFieldDefaults ?? {}) },
  };

  const updated = await prisma.assetContent.update({
    where: { id: assetContentId },
    data: {
      htmlContent: data.html ?? existing.htmlContent,
      keyMetrics: newMeta as any,
    },
  });

  revalidatePath(`/assets/${existing.assetId}`);
  return updated;
}

/** Disable the HTML NDA on an asset (deletes the master template row). */
export async function disableHtmlNdaForAsset(assetId: string) {
  await requireRole("EDITOR");
  const existing = await findHtmlNda(assetId);
  if (!existing) return;
  await prisma.assetContent.delete({ where: { id: existing.id } });
  revalidatePath(`/assets/${assetId}`);
}

/**
 * Clone the master HTML NDA for one investor — creates a per-investor
 * Document with mimeType=text/html plus a SigningToken so the existing
 * sign-link infrastructure works unchanged.
 *
 * Idempotent: if a PENDING html-NDA Document already exists for this
 * (tracking, stage), returns it. Avoids piling up clones on re-invite.
 */
export async function cloneHtmlNdaForInvestor(
  trackingId: string,
  assetContentId: string,
  uploadedByUserId: string
) {
  const ndaStage = await prisma.pipelineStage.findFirst({
    where: { key: "nda", isActive: true },
  });
  if (!ndaStage) throw new Error("NDA stage not configured");

  const sentinelFileUrl = `${HTML_NDA_FILEURL_PREFIX}${assetContentId}`;

  const existing = await prisma.document.findFirst({
    where: {
      trackingId,
      stageId: ndaStage.id,
      status: "PENDING",
      mimeType: "text/html",
    },
    include: { signingTokens: { where: { usedAt: null }, orderBy: { createdAt: "desc" }, take: 1 } },
  });

  if (existing) return existing;

  const doc = await prisma.document.create({
    data: {
      trackingId,
      stageId: ndaStage.id,
      fileName: "NDA.html",
      fileUrl: sentinelFileUrl,
      fileSize: 0,
      mimeType: "text/html",
      status: "PENDING",
      placementMode: "GRID",
      uploadedByUserId,
    },
  });

  await prisma.signingToken.create({
    data: {
      documentId: doc.id,
      token: randomUUID() + "-" + randomUUID(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "Document",
      entityId: doc.id,
      action: "HTML_NDA_CLONED_FROM_MASTER",
      metadata: { trackingId, masterAssetContentId: assetContentId },
      userId: uploadedByUserId,
    },
  });

  return doc;
}

/**
 * Investor-side: returns the template + admin-prefilled values + the list
 * of fields the investor still needs to fill, given a signing token.
 */
export async function getHtmlNdaForSigning(token: string) {
  const signingToken = await prisma.signingToken.findUnique({
    where: { token },
    include: {
      document: {
        include: {
          tracking: {
            include: {
              company: { select: { name: true } },
              asset: { select: { id: true, title: true, fieldDefaults: true } },
            },
          },
        },
      },
    },
  });

  if (!signingToken) return null;
  if (signingToken.expiresAt <= new Date()) return null;
  if (signingToken.usedAt !== null) return null;

  const doc = signingToken.document;
  if (doc.mimeType !== "text/html" || !doc.fileUrl.startsWith(HTML_NDA_FILEURL_PREFIX)) {
    return null;
  }

  const assetContentId = doc.fileUrl.slice(HTML_NDA_FILEURL_PREFIX.length);
  const template = await prisma.assetContent.findUnique({
    where: { id: assetContentId },
  });
  if (!template) return null;

  const meta = parseMeta(template.keyMetrics);
  if (!meta || !template.htmlContent) return null;

  const referencedTokens = extractTokens(template.htmlContent);
  const fields = meta.fields.filter((f) => referencedTokens.includes(f.key));

  return {
    documentId: doc.id,
    assetTitle: doc.tracking.asset.title,
    companyName: doc.tracking.company.name,
    html: template.htmlContent,
    fields,
    adminFieldDefaults: meta.adminFieldDefaults ?? {},
  };
}

/**
 * Investor signs the HTML NDA. Stores filled values + signature inside
 * Document.fieldConfig (no schema change), renders the final HTML and
 * stores it for audit/replay, and progresses the stage to COMPLETED.
 */
export async function signHtmlNda(data: {
  token: string;
  values: Record<string, string>;
  signatureData: string;
  signedByName: string;
  signedByEmail: string;
}) {
  const signingToken = await prisma.signingToken.findUnique({
    where: { token: data.token },
    include: { document: true },
  });

  if (!signingToken) throw new Error("Invalid signing token");
  if (signingToken.expiresAt <= new Date()) throw new Error("Token expired");
  if (signingToken.usedAt !== null) throw new Error("Token already used");

  const doc = signingToken.document;
  if (doc.mimeType !== "text/html" || !doc.fileUrl.startsWith(HTML_NDA_FILEURL_PREFIX)) {
    throw new Error("Not an HTML NDA");
  }

  const assetContentId = doc.fileUrl.slice(HTML_NDA_FILEURL_PREFIX.length);
  const template = await prisma.assetContent.findUnique({
    where: { id: assetContentId },
  });
  if (!template?.htmlContent) throw new Error("Template missing");

  const meta = parseMeta(template.keyMetrics);
  if (!meta) throw new Error("Template metadata missing");

  // Merge: investor values < admin defaults < system identity / date.
  const signatureImg = `<img src="${data.signatureData}" alt="signature" style="max-width:240px;max-height:90px;" />`;
  const merged: Record<string, string> = {
    ...data.values,
    ...(meta.adminFieldDefaults ?? {}),
    NAME: data.signedByName.split(" ")[0] || data.signedByName,
    SURNAME: data.signedByName.split(" ").slice(1).join(" ") || data.values.SURNAME || "",
    DATE: formatDate(new Date()),
  };
  // Preserve full name if user explicitly provided NAME / SURNAME inputs.
  if (data.values.NAME) merged.NAME = data.values.NAME;
  if (data.values.SURNAME) merged.SURNAME = data.values.SURNAME;

  let signedHtml = renderTemplate(template.htmlContent, merged);
  signedHtml = signedHtml.replace(/\{\{SIGNATURE_BLOCK\}\}/g, signatureImg);

  await prisma.$transaction(async (tx) => {
    await tx.signingToken.update({
      where: { id: signingToken.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.document.update({
      where: { id: doc.id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signedByName: data.signedByName,
        signedByEmail: data.signedByEmail,
        signatureData: data.signatureData,
        fieldConfig: {
          values: merged,
          signedHtml,
        } as any,
      },
    });

    const stageStatus = await tx.stageStatus.findUnique({
      where: { trackingId_stageId: { trackingId: doc.trackingId, stageId: doc.stageId } },
    });
    const oldStatus = stageStatus?.status ?? "NOT_STARTED";

    await tx.stageStatus.update({
      where: { trackingId_stageId: { trackingId: doc.trackingId, stageId: doc.stageId } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await tx.stageHistory.create({
      data: {
        trackingId: doc.trackingId,
        stageId: doc.stageId,
        fieldName: "status",
        oldValue: oldStatus,
        newValue: "COMPLETED",
        changedByUserId: doc.uploadedByUserId,
      },
    });

    await tx.activityLog.create({
      data: {
        entityType: "Document",
        entityId: doc.id,
        action: "HTML_NDA_SIGNED",
        metadata: { trackingId: doc.trackingId, signedByName: data.signedByName },
        userId: doc.uploadedByUserId,
      },
    });
  });

  return { success: true };
}

/**
 * Admin-side view: fetch a signed HTML NDA for download/preview.
 */
export async function getSignedHtmlNda(documentId: string) {
  const user = await requireUser();
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { tracking: { select: { companyId: true, asset: { select: { title: true } } } } },
  });

  if (user.role === "INVESTOR" && doc.tracking.companyId !== user.companyId) {
    throw new Error("Forbidden");
  }
  if (doc.mimeType !== "text/html") throw new Error("Not an HTML NDA");

  const cfg = (doc.fieldConfig as any) ?? null;
  return {
    documentId: doc.id,
    assetTitle: doc.tracking.asset.title,
    signedAt: doc.signedAt,
    signedByName: doc.signedByName,
    signedByEmail: doc.signedByEmail,
    signedHtml: cfg?.signedHtml ?? null,
  };
}

export const HTML_NDA_FILEURL_PREFIX_EXPORT = HTML_NDA_FILEURL_PREFIX;
