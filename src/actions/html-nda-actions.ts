"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import {
  DEFAULT_NDA_TEMPLATE,
  extractTokens,
  injectSignature,
  renderTemplate,
  RESERVED_TOKENS,
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
  const user = await requireRole("EDITOR");

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

  // Retroactively clone the HTML NDA for every tracking that already
  // exists on this asset. Without this, investors who were added /
  // invited BEFORE the admin enabled HTML NDA never see a "Sign Now"
  // button — their tracking has no Document, and the master template
  // is hidden from the journey card by design. Idempotent per tracking
  // (cloneHtmlNdaForInvestor returns the existing PENDING html doc if
  // one is already there).
  try {
    const trackings = await prisma.assetCompanyTracking.findMany({
      where: { assetId },
      select: { id: true },
    });
    for (const t of trackings) {
      try {
        await cloneHtmlNdaForInvestor(t.id, created.id, user.id);
      } catch (e) {
        console.error(
          `[enableHtmlNdaForAsset] clone failed for tracking ${t.id}:`,
          e
        );
      }
    }
  } catch (e) {
    console.error("[enableHtmlNdaForAsset] retroactive clone batch failed:", e);
  }

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

/**
 * Manually clone the master HTML NDA into every tracking on an asset that
 * doesn't already have a PENDING html-NDA document. Used to repair assets
 * where investors were added before the master template existed (no
 * Sign Now button shows on the journey card without a per-tracking
 * Document). Idempotent — re-running is a no-op for trackings that
 * already have a clone.
 */
export async function issueHtmlNdaToAllTrackings(
  assetId: string
): Promise<{ cloned: number; skipped: number; total: number }> {
  const user = await requireRole("EDITOR");

  const master = await findHtmlNda(assetId);
  if (!master) {
    throw new Error("HTML NDA is not enabled for this asset.");
  }

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: { assetId },
    select: { id: true },
  });

  let cloned = 0;
  let skipped = 0;
  for (const t of trackings) {
    try {
      // cloneHtmlNdaForInvestor returns the existing PENDING html doc if
      // one is already attached; reading the activity log distinguishes
      // a fresh create from a pre-existing match.
      const before = await prisma.activityLog.count({
        where: {
          action: "HTML_NDA_CLONED_FROM_MASTER",
          metadata: { path: ["trackingId"], equals: t.id },
        },
      });
      await cloneHtmlNdaForInvestor(t.id, master.id, user.id);
      const after = await prisma.activityLog.count({
        where: {
          action: "HTML_NDA_CLONED_FROM_MASTER",
          metadata: { path: ["trackingId"], equals: t.id },
        },
      });
      if (after > before) cloned += 1;
      else skipped += 1;
    } catch (e) {
      console.error(
        `[issueHtmlNdaToAllTrackings] failed for tracking ${t.id}:`,
        e
      );
    }
  }

  revalidatePath(`/assets/${assetId}`);
  return { cloned, skipped, total: trackings.length };
}

/**
 * Disable the HTML NDA on an asset (deletes the master template row).
 *
 * Refuses if any per-investor HTML NDA Document already references this
 * template — those Documents store the rendered/signed HTML inside their
 * fieldConfig, but their fileUrl sentinel points back here, and the
 * /portal/signed-nda/[id] view re-fetches this row to verify metadata.
 * Deleting the template would orphan the signed copies and break the
 * signed-NDA viewer for every investor who already signed.
 */
export async function disableHtmlNdaForAsset(assetId: string) {
  await requireRole("EDITOR");
  const existing = await findHtmlNda(assetId);
  if (!existing) return;

  const sentinel = `${HTML_NDA_FILEURL_PREFIX}${existing.id}`;
  const referencingDocs = await prisma.document.count({
    where: { fileUrl: sentinel },
  });
  if (referencingDocs > 0) {
    throw new Error(
      `Can't disable — ${referencingDocs} investor${
        referencingDocs === 1 ? " has" : "s have"
      } already received this NDA. Disable HTML NDA only on assets with no outstanding signing tokens.`
    );
  }

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
  // Build the field list directly from what the HTML actually references,
  // so admins who paste text with tokens we have no field config for still
  // get inputs for those tokens. RESERVED_TOKENS (SIGNATURE / DATE) are
  // auto-filled and never shown.
  const knownByKey = new Map(meta.fields.map((f) => [f.key, f]));
  const fields: TemplateField[] = referencedTokens
    .filter((t) => !RESERVED_TOKENS.has(t))
    .map((key) => knownByKey.get(key) ?? { key, label: humanize(key) });

  // Merge per-asset project defaults (BUILDING_NAME, CITY, …) under the
  // template-level admin defaults — template wins if both define the same
  // key. Both are hidden from the investor and auto-fill at render time.
  const assetDefaults =
    (doc.tracking.asset.fieldDefaults as Record<string, string> | null) ?? {};
  const adminFieldDefaults: Record<string, string> = {
    ...assetDefaults,
    ...(meta.adminFieldDefaults ?? {}),
  };

  return {
    documentId: doc.id,
    assetTitle: doc.tracking.asset.title,
    companyName: doc.tracking.company.name,
    html: template.htmlContent,
    fields,
    adminFieldDefaults,
  };
}

function humanize(key: string) {
  return key
    .toLowerCase()
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
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

  // Pull per-asset project defaults (BUILDING_NAME / CITY / VENDOR …) so
  // they auto-fill in the rendered NDA without the admin having to repeat
  // them in every template.
  const tracking = await prisma.assetCompanyTracking.findUnique({
    where: { id: doc.trackingId },
    select: { asset: { select: { fieldDefaults: true } } },
  });
  const assetDefaults =
    (tracking?.asset?.fieldDefaults as Record<string, string> | null) ?? {};

  // Merge order (later overrides earlier):
  //   1. investor inputs (lowest)
  //   2. per-asset project defaults
  //   3. template-specific admin defaults
  //   4. system identity / date (highest)
  const signatureImg = `<img src="${data.signatureData}" alt="signature" style="max-width:240px;max-height:90px;" />`;
  const merged: Record<string, string> = {
    ...data.values,
    ...assetDefaults,
    ...(meta.adminFieldDefaults ?? {}),
    // Single full-name field on the signing form drives three name tokens
    // — NAME (full string), FIRST_NAMES (everything except the last word),
    // SURNAME (last word). The Orizon-style template renders Voornamen +
    // Achternaam separately; legacy templates only reference {{NAME}}.
    NAME: data.signedByName.trim(),
    FIRST_NAMES: (() => {
      const parts = data.signedByName.trim().split(/\s+/);
      return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(" ");
    })(),
    SURNAME: (() => {
      const parts = data.signedByName.trim().split(/\s+/);
      return parts.length > 1 ? parts[parts.length - 1] : "";
    })(),
    EMAIL: data.signedByEmail,
    DATE: formatDate(new Date()),
  };
  // Preserve admin/legacy explicit overrides if the values payload still
  // carries them (older NDA templates with NAME / SURNAME / FIRST_NAMES
  // as required investor fields, asset-specific overrides, etc.).
  if (data.values.NAME) merged.NAME = data.values.NAME;
  if (data.values.FIRST_NAMES) merged.FIRST_NAMES = data.values.FIRST_NAMES;
  if (data.values.SURNAME) merged.SURNAME = data.values.SURNAME;

  const renderedHtml = renderTemplate(template.htmlContent, merged);
  const signedHtml = injectSignature(renderedHtml, signatureImg);

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic claim — the where clause includes usedAt:null, so if a
      // concurrent request claimed the token between our pre-check above
      // and now, this update throws P2025 and the whole transaction rolls
      // back. We catch P2025 below and surface a friendly message instead
      // of leaking a Prisma error.
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
  } catch (e: any) {
    // P2025: "Record to update not found" — happens when the atomic
    // usedAt:null guard found nothing. The token was claimed between
    // our pre-check and the transaction.
    if (e?.code === "P2025") {
      throw new Error("This signing link has already been used. Please contact your broker for a new link.");
    }
    throw e;
  }

  return { success: true };
}

/**
 * Fetch a signed HTML NDA for download/preview.
 *
 * Authorisation:
 *  - INVESTOR  → only their own company's tracking
 *  - VIEWER    → only if they have AssetViewerAccess for the tracking's
 *                asset; PII (signedByName / signedByEmail) is scrubbed
 *                before the response leaves the server
 *  - ADMIN / EDITOR → unrestricted
 *  - all other roles → Forbidden
 */
export async function getSignedHtmlNda(documentId: string) {
  const user = await requireUser();
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: {
      tracking: {
        select: { companyId: true, assetId: true, asset: { select: { title: true } } },
      },
    },
  });

  if (doc.mimeType !== "text/html") throw new Error("Not an HTML NDA");

  if (user.role === "INVESTOR") {
    // Sprint B PR-2: investors can hold this asset under any of the
    // companies they belong to. The legacy User.companyId check rejected
    // investors with multi-company memberships if the doc's company
    // happened to be a non-primary one — manifested as a 500 right after
    // signing for some test accounts. Use the membership shim instead.
    const { getUserCompanyIds } = await import("@/lib/user-companies");
    const companyIds = await getUserCompanyIds(user.id);
    if (!companyIds.includes(doc.tracking.companyId)) {
      throw new Error("Forbidden");
    }
  } else if (user.role === "VIEWER") {
    const access = await prisma.assetViewerAccess.findUnique({
      where: {
        userId_assetId: { userId: user.id, assetId: doc.tracking.assetId },
      },
      select: { id: true },
    });
    if (!access) throw new Error("Forbidden");
  } else if (user.role !== "ADMIN" && user.role !== "EDITOR") {
    throw new Error("Forbidden");
  }

  const cfg = (doc.fieldConfig as any) ?? null;

  // VIEWERs never see investor identity — strip the signed-by fields
  // server-side as a defence-in-depth complement to the client redaction
  // rules already in tracking-detail-drawer.
  const showSignerIdentity = user.role !== "VIEWER";

  return {
    documentId: doc.id,
    assetId: doc.tracking.assetId,
    assetTitle: doc.tracking.asset.title,
    signedAt: doc.signedAt,
    signedByName: showSignerIdentity ? doc.signedByName : null,
    signedByEmail: showSignerIdentity ? doc.signedByEmail : null,
    signedHtml: cfg?.signedHtml ?? null,
  };
}

