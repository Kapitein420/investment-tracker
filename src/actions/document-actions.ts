"use server";

import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import { uploadFile, getSignedUrl, downloadFile, uploadBytes, deleteFile } from "@/lib/supabase-storage";
import { generateSignedPdf, generateSignedPdfFromPlaceholders, type FieldPlacement } from "@/lib/pdf-signing";
import { scanPlaceholders } from "@/lib/pdf-placeholder-scan";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  signDocumentSchema,
  rejectDocumentSchema,
  saveDocumentPlacementsSchema,
} from "@/lib/validators";
import { formatDate } from "@/lib/utils";
import { syncCurrentStageKeyAfterCommit } from "@/actions/tracking-actions";

const DEFAULT_FIELD_CONFIG: FieldPlacement[] = [
  { type: "signature", page: -1, position: "bottom-center" },
  { type: "name", page: -1, position: "bottom-left" },
  { type: "date", page: -1, position: "bottom-right" },
];

// HTML NDA Documents store fileUrl="html:<assetContentId>" instead of a real
// Supabase path. Every PDF-flavoured code path here has to skip those rows or
// it crashes Supabase storage with "Object not found".
const HTML_NDA_FILEURL_PREFIX = "html:";
function isHtmlNdaSentinel(path: string | null | undefined): boolean {
  return !!path && path.startsWith(HTML_NDA_FILEURL_PREFIX);
}

/**
 * Render the signed PDF bytes for a Document and upload to Supabase.
 * Pure helper — no DB writes. Returns the storage path.
 *
 * Used by both the synchronous post-sign generation and the lazy
 * regen path (ensureSignedPdf), so the rendering logic lives in one place.
 *
 * Throws on failure (caller decides whether to surface to user).
 */
async function renderAndUploadSignedPdf(args: {
  doc: {
    id: string;
    trackingId: string;
    fileName: string;
    fileUrl: string;
    fieldConfig: any;
    placeholderMap: any;
  } & Record<string, any>;
  signatureData: string;
  signedByName: string;
  signedByEmail: string;
  signedAt: Date;
  fieldValues: Record<string, string>;
  assetFieldDefaults: Record<string, string>;
}): Promise<string> {
  const { doc, signatureData, signedByName, signedByEmail, signedAt, fieldValues, assetFieldDefaults } = args;
  const pdfStart = Date.now();
  const originalPdfBytes = await downloadFile(doc.fileUrl);

  let signedPdfBytes: Uint8Array;
  if (doc.placementMode === "PLACEHOLDER" && doc.placeholderMap) {
    // Merge order (later overrides earlier):
    //   1. investor-supplied values (lowest)
    //   2. admin-set asset defaults
    //   3. system-authoritative identity / date (highest)
    const mergedValues: Record<string, string> = {
      ...fieldValues,
      ...assetFieldDefaults,
      NAME: signedByName,
      EMAIL: signedByEmail,
      DATE: formatDate(signedAt),
    };
    signedPdfBytes = await generateSignedPdfFromPlaceholders(
      originalPdfBytes,
      signatureData,
      mergedValues,
      doc.placeholderMap as any
    );
  } else if (doc.placementMode === "MANUAL") {
    const manualPlacements: FieldPlacement[] =
      Array.isArray(doc.fieldConfig) ? (doc.fieldConfig as FieldPlacement[]) : [];
    signedPdfBytes = await generateSignedPdf(
      originalPdfBytes,
      signatureData,
      signedByName,
      formatDate(signedAt),
      manualPlacements.length > 0 ? manualPlacements : DEFAULT_FIELD_CONFIG
    );
  } else {
    const fieldConfig: FieldPlacement[] =
      Array.isArray(doc.fieldConfig) ? (doc.fieldConfig as FieldPlacement[]) : DEFAULT_FIELD_CONFIG;
    signedPdfBytes = await generateSignedPdf(
      originalPdfBytes,
      signatureData,
      signedByName,
      formatDate(signedAt),
      fieldConfig
    );
  }

  const signedPath = `documents/${doc.trackingId}/signed_${Date.now()}_${doc.fileName}`;
  await uploadBytes(signedPdfBytes, signedPath, "application/pdf");
  console.log(
    `[renderAndUploadSignedPdf] generated in ${Date.now() - pdfStart}ms for doc ${doc.id}`
  );
  return signedPath;
}

/**
 * Lazy regen for SIGNED documents whose signedFileUrl is null. Happens
 * when the synchronous post-sign generation failed (timeout, OOM under
 * burst, transient pdf-lib error). Race-safe: only one writer "wins"
 * the update; concurrent callers re-read the canonical path.
 *
 * Returns the storage path. Throws if the doc isn't signed yet, has no
 * signature data, or PDF rendering fails.
 */
async function ensureSignedPdf(documentId: string): Promise<string> {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: {
      tracking: { select: { asset: { select: { fieldDefaults: true } } } },
    },
  });

  if (doc.signedFileUrl) return doc.signedFileUrl;
  if (doc.status !== "SIGNED" || !doc.signatureData || !doc.signedByName || !doc.signedAt) {
    throw new Error("Document is not in a signed state — nothing to render.");
  }
  if (doc.mimeType === "text/html" || isHtmlNdaSentinel(doc.fileUrl)) {
    throw new Error("HTML NDA — no PDF download available.");
  }

  // For PLACEHOLDER mode we persisted the merged field values into
  // fieldConfig at sign time (see signDocument). For MANUAL/GRID modes
  // fieldConfig stores FieldPlacement[]; values aren't needed because
  // those modes don't render investor-typed fields.
  const isPlaceholder =
    (doc as any).placementMode === "PLACEHOLDER" && (doc as any).placeholderMap;
  const persistedValues =
    isPlaceholder && doc.fieldConfig && !Array.isArray(doc.fieldConfig)
      ? (doc.fieldConfig as Record<string, string>)
      : {};

  const signedPath = await renderAndUploadSignedPdf({
    doc: doc as any,
    signatureData: doc.signatureData,
    signedByName: doc.signedByName,
    signedByEmail: doc.signedByEmail ?? "",
    signedAt: doc.signedAt,
    fieldValues: persistedValues,
    assetFieldDefaults:
      ((doc.tracking?.asset?.fieldDefaults as Record<string, string> | null) ?? {}),
  });

  // Race-safe: if another concurrent call already stored a path, this
  // updateMany matches 0 rows, we re-read, and return the canonical one.
  await prisma.document.updateMany({
    where: { id: doc.id, signedFileUrl: null },
    data: { signedFileUrl: signedPath },
  });
  const fresh = await prisma.document.findUniqueOrThrow({
    where: { id: doc.id },
    select: { signedFileUrl: true },
  });
  return fresh.signedFileUrl ?? signedPath;
}

export async function uploadDocument(formData: FormData) {
  const user = await requireRole("EDITOR");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  // Validate file size (max 10MB for Vercel serverless)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 10MB.");
  }

  // Validate MIME type
  if (file.type !== "application/pdf" && file.type !== "application/x-pdf") {
    throw new Error("Only PDF files are allowed");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Validate PDF magic bytes
  if (!buffer.slice(0, 4).toString().startsWith("%PDF")) {
    throw new Error("Invalid PDF file (failed magic byte check)");
  }

  const trackingId = formData.get("trackingId") as string;
  const stageId = formData.get("stageId") as string;

  if (!trackingId || !stageId) {
    throw new Error("trackingId and stageId are required");
  }

  // Prevent duplicate documents for the same tracking + stage
  const existing = await prisma.document.findFirst({
    where: { trackingId, stageId, status: { in: ["PENDING", "SIGNED"] } },
  });
  if (existing) {
    throw new Error("A document already exists for this stage. Delete the existing one first.");
  }

  // Parse field config or use defaults
  const fieldConfigRaw = formData.get("fieldConfig") as string | null;
  let fieldConfig: FieldPlacement[] = DEFAULT_FIELD_CONFIG;
  if (fieldConfigRaw) {
    try {
      fieldConfig = JSON.parse(fieldConfigRaw);
    } catch {
      // use defaults
    }
  }

  // Optional: admin can request MANUAL placement mode on upload
  // (drag-drop editor will supply placements via saveDocumentPlacements)
  const requestedMode = formData.get("placementMode") as string | null;

  let placeholderMap: Record<string, any> | null = null;
  let placementMode: "GRID" | "PLACEHOLDER" | "MANUAL" = "GRID";

  if (requestedMode === "MANUAL") {
    placementMode = "MANUAL";
    // Start with empty placements — admin fills them in via the editor
    fieldConfig = [];
    console.log("[uploadDocument] MANUAL mode requested — skipping placeholder scan");
  } else {
    // Scan for placeholders with a 5s timeout so slow PDFs don't
    // block the Vercel serverless function (default limit is 10s).
    try {
      const scanPromise = scanPlaceholders(buffer);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Placeholder scan timed out after 5s")), 5000)
      );
      const detected = await Promise.race([scanPromise, timeoutPromise]);
      if (Object.keys(detected).length > 0) {
        placeholderMap = detected;
        placementMode = "PLACEHOLDER";
        console.log(`[uploadDocument] Detected ${Object.keys(detected).length} placeholders`);
      } else {
        console.log("[uploadDocument] No placeholders detected — using GRID mode");
      }
    } catch (e) {
      console.error("[uploadDocument] Placeholder scan failed (falling back to GRID):", e);
    }
  }

  const path = `documents/${trackingId}/${Date.now()}_${file.name}`;
  const storagePath = await uploadFile(buffer, path, file.type);

  const document = await prisma.document.create({
    data: {
      trackingId,
      stageId,
      fileName: file.name,
      fileUrl: storagePath,
      mimeType: file.type,
      fileSize: file.size,
      uploadedByUserId: user.id,
      fieldConfig: fieldConfig as any,
      placeholderMap: placeholderMap as any,
      placementMode,
    },
  });

  const token = await prisma.signingToken.create({
    data: {
      documentId: document.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "Document",
      entityId: document.id,
      action: "DOCUMENT_UPLOADED",
      metadata: { trackingId, stageId, fileName: file.name },
      userId: user.id,
    },
  });

  revalidatePath(`/assets`);
  return {
    document,
    signingUrl: `/sign/${token.token}`,
    placementMode,
    placeholderCount: placeholderMap ? Object.keys(placeholderMap).length : 0,
  };
}

/**
 * Delete a Document (and its SigningTokens). Best-effort removes the
 * original + signed file from storage. Signed documents are protected —
 * the admin must pass `force: true` explicitly to remove a legal record.
 */
export async function deleteDocument(
  documentId: string,
  opts: { force?: boolean } = {}
): Promise<{ deleted: boolean }> {
  const user = await requireRole("EDITOR");

  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    select: {
      id: true,
      status: true,
      fileName: true,
      fileUrl: true,
      signedFileUrl: true,
      trackingId: true,
      stageId: true,
    },
  });

  if (doc.status === "SIGNED" && !opts.force) {
    throw new Error(
      "Cannot delete a signed document without force=true — signed documents are legal records."
    );
  }

  // Storage cleanup is best-effort; DB delete is authoritative.
  // Skip http URLs (already external) and the HTML NDA sentinel (no real file).
  const filesToDelete = [doc.fileUrl, doc.signedFileUrl].filter(
    (u): u is string => !!u && !u.startsWith("http") && !isHtmlNdaSentinel(u)
  );
  for (const path of filesToDelete) {
    try {
      await deleteFile(path);
    } catch (e) {
      console.error(`[deleteDocument] storage cleanup failed for ${path}:`, e);
    }
  }

  await prisma.$transaction(async (tx) => {
    // SigningTokens + StageHistory rows referencing this document will cascade
    // via onDelete in the schema; if not, remove tokens explicitly first.
    await tx.signingToken.deleteMany({ where: { documentId: doc.id } });
    await tx.document.delete({ where: { id: doc.id } });

    // Deleting a SIGNED doc puts the investor back into the signing flow:
    //   - stage status reverts to NOT_STARTED (green check → question mark)
    //   - For NDA: approvedAt / approvedByUserId are PRESERVED, not cleared.
    //     This is intentional — the admin already approved this investor on
    //     this asset; if the doc is being replaced (typo on the legal copy,
    //     re-sign requested for any reason), the next signature should
    //     auto-inherit that approval rather than forcing the admin to
    //     manually approve a second time. Unlock rules below additionally
    //     require status === "COMPLETED" so IM/Viewing relock until the
    //     replacement NDA is actually signed.
    //   - subsequent stages that were unlocked by this approval revert
    if (doc.status === "SIGNED") {
      const ss = await tx.stageStatus.findUnique({
        where: { trackingId_stageId: { trackingId: doc.trackingId, stageId: doc.stageId } },
        include: { stage: { select: { key: true } } },
      });
      if (ss) {
        const isNda = ss.stage.key === "nda";
        await tx.stageStatus.update({
          where: { id: ss.id },
          data: {
            status: "NOT_STARTED",
            completedAt: null,
            // Only the NDA stage retains its prior approval marker so the
            // investor's next signature auto-re-approves. Other stages
            // don't use approvedAt today, but be explicit.
            ...(isNda
              ? {}
              : { approvedAt: null, approvedByUserId: null }),
            updatedByUserId: user.id,
          },
        });
        await tx.stageHistory.create({
          data: {
            trackingId: doc.trackingId,
            stageId: doc.stageId,
            fieldName: "status",
            oldValue: "COMPLETED",
            newValue: "NOT_STARTED",
            changedByUserId: user.id,
          },
        });

        // If we deleted a signed NDA, lock IM back down by reverting it
        // from IN_PROGRESS back to NOT_STARTED.
        if (ss.stage.key === "nda") {
          const imStage = await tx.pipelineStage.findFirst({
            where: { key: "im", isActive: true },
            select: { id: true },
          });
          if (imStage) {
            const imSs = await tx.stageStatus.findUnique({
              where: { trackingId_stageId: { trackingId: doc.trackingId, stageId: imStage.id } },
            });
            if (imSs && imSs.status === "IN_PROGRESS") {
              await tx.stageStatus.update({
                where: { id: imSs.id },
                data: { status: "NOT_STARTED", updatedByUserId: user.id },
              });
            }
          }
        }
      }
    }

    await tx.activityLog.create({
      data: {
        entityType: "Document",
        entityId: doc.id,
        action: "DOCUMENT_DELETED",
        metadata: {
          fileName: doc.fileName,
          wasSigned: doc.status === "SIGNED",
          force: !!opts.force,
          stageReset: doc.status === "SIGNED",
        },
        userId: user.id,
      },
    });
  });

  revalidatePath("/assets");
  return { deleted: true };
}

/**
 * Bulk-delete every PENDING document on an asset. Useful for cleaning up
 * test invites that were created before the master-NDA auto-clone flow
 * was in place. Does NOT touch SIGNED documents.
 */
export async function deleteAssetPendingDocuments(
  assetId: string
): Promise<{ deleted: number }> {
  await requireRole("EDITOR");

  const pendings = await prisma.document.findMany({
    where: { tracking: { assetId }, status: "PENDING" },
    select: { id: true },
  });

  let deleted = 0;
  for (const d of pendings) {
    try {
      await deleteDocument(d.id);
      deleted += 1;
    } catch (e) {
      console.error(`[deleteAssetPendingDocuments] failed for ${d.id}:`, e);
    }
  }

  revalidatePath(`/assets/${assetId}`);
  return { deleted };
}

export async function getSignedDocumentUrl(documentId: string) {
  const user = await requireUser();
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { tracking: { select: { companyId: true, assetId: true } } },
  });

  // Investors can only access their own company's documents.
  if (user.role === "INVESTOR" && doc.tracking.companyId !== user.companyId) {
    throw new Error("Forbidden");
  }

  // VIEWER (opdrachtgever / client) can download signed docs only on
  // assets they've been granted access to — the same gate
  // getSignedHtmlNda uses, kept consistent so the two doc types behave
  // identically for the client role.
  if (user.role === "VIEWER") {
    const access = await prisma.assetViewerAccess.findUnique({
      where: {
        userId_assetId: { userId: user.id, assetId: doc.tracking.assetId },
      },
      select: { id: true },
    });
    if (!access) throw new Error("Forbidden");
  }

  // HTML NDAs are rendered server-side at /portal/signed-nda/[id]; they don't
  // have a downloadable file. Refuse rather than 500ing inside Supabase.
  // Exception: if the investor uploaded their own pre-signed PDF for an
  // HTML-template NDA, signedFileUrl points to a real Supabase path —
  // honour that and allow download.
  const hasRealSignedFile =
    !!doc.signedFileUrl && !isHtmlNdaSentinel(doc.signedFileUrl);
  if (!hasRealSignedFile && (doc.mimeType === "text/html" || isHtmlNdaSentinel(doc.fileUrl))) {
    throw new Error("HTML NDA documents are viewed via the portal — no download URL.");
  }

  // Lazy regen path: signing decouples PDF generation from the commit, so
  // a doc can be SIGNED with signedFileUrl=null when a burst overran the
  // post-commit render. Fill it in here on first download. Prefer the
  // unsigned original as a final fallback so the page never 500s.
  let path: string;
  if (doc.signedFileUrl) {
    path = doc.signedFileUrl;
  } else if (doc.status === "SIGNED") {
    try {
      path = await ensureSignedPdf(doc.id);
    } catch (e) {
      console.error(
        `[getSignedDocumentUrl] lazy regen failed for doc ${doc.id} — falling back to unsigned original:`,
        e
      );
      path = doc.fileUrl;
    }
  } else {
    path = doc.fileUrl;
  }
  return getSignedUrl(path, 7200);
}

export async function getDocumentsByTracking(trackingId: string) {
  await requireUser();
  return prisma.document.findMany({
    where: { trackingId },
    include: {
      stage: true,
      uploadedBy: { select: { id: true, name: true } },
      signingTokens: {
        where: { usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Returns the placeholder map for a document plus the project-level defaults
 * already set on the asset. The signing UI uses this to render a dynamic form
 * and to hide any token the admin has already filled in.
 */
export async function getDocumentPlaceholderInfo(
  documentId: string
): Promise<{
  placeholderMap: Record<string, unknown> | null;
  assetFieldDefaults: Record<string, string>;
} | null> {
  await requireUser();
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      placementMode: true,
      placeholderMap: true,
      tracking: { select: { asset: { select: { fieldDefaults: true } } } },
    },
  });
  if (!doc) return null;
  if (doc.placementMode !== "PLACEHOLDER") {
    return { placeholderMap: null, assetFieldDefaults: {} };
  }
  return {
    placeholderMap:
      (doc.placeholderMap as Record<string, unknown> | null) ?? null,
    assetFieldDefaults:
      (doc.tracking?.asset?.fieldDefaults as Record<string, string> | null) ?? {},
  };
}

/** Kept for backwards compatibility with any existing callers. */
export async function getDocumentPlaceholderMap(
  documentId: string
): Promise<Record<string, unknown> | null> {
  const info = await getDocumentPlaceholderInfo(documentId);
  return info?.placeholderMap ?? null;
}

/**
 * Re-download the document file and re-run the placeholder scanner with the
 * current scan logic. Used to refresh documents that were uploaded under an
 * older scan implementation (e.g. before single-brace / lower-case support).
 * Updates the document's placeholderMap and promotes placementMode to
 * PLACEHOLDER when any are found.
 */
export async function rescanDocumentPlaceholders(
  documentId: string
): Promise<{ keysFound: number; placementMode: string }> {
  await requireRole("EDITOR");

  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    select: { id: true, fileUrl: true, mimeType: true },
  });

  if (doc.mimeType === "text/html" || isHtmlNdaSentinel(doc.fileUrl)) {
    throw new Error("Cannot rescan an HTML NDA — placeholders are managed in the template editor.");
  }

  const pdfBytes = await downloadFile(doc.fileUrl);
  const placeholderMap = await scanPlaceholders(Buffer.from(pdfBytes));
  const keysFound = Object.keys(placeholderMap).length;

  const placementMode = keysFound > 0 ? "PLACEHOLDER" : "GRID";

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      placeholderMap: keysFound > 0 ? (placeholderMap as any) : undefined,
      placementMode,
    },
  });

  revalidatePath("/assets");
  return { keysFound, placementMode };
}

/**
 * Rescan every PDF attached to an asset — both master AssetContent files
 * (NDA, IM, etc.) and any per-investor Documents already cloned out.
 * Returns counts so the admin UI can give meaningful feedback.
 */
export async function rescanAssetPlaceholders(
  assetId: string
): Promise<{ scanned: number; totalKeys: number; masterContentScanned: number }> {
  await requireRole("EDITOR");

  const [contents, docs] = await Promise.all([
    prisma.assetContent.findMany({
      where: { assetId, contentType: "PDF", fileUrl: { not: null } },
      select: { id: true, fileUrl: true },
      take: 50,
    }),
    prisma.document.findMany({
      where: {
        tracking: { assetId },
        status: { in: ["PENDING", "SIGNED"] },
        placementMode: { in: ["GRID", "PLACEHOLDER"] },
        // HTML NDA Documents share the table but never need a placeholder
        // re-scan — their templating lives in AssetContent.
        mimeType: "application/pdf",
      },
      select: { id: true, fileUrl: true },
      take: 50,
    }),
  ]);

  let totalKeys = 0;
  let masterContentScanned = 0;

  for (const c of contents) {
    if (!c.fileUrl) continue;
    console.log(`[rescanAssetPlaceholders] AssetContent ${c.id}: downloading "${c.fileUrl}"`);
    try {
      const pdfBytes = await downloadFile(c.fileUrl);
      console.log(`[rescanAssetPlaceholders] AssetContent ${c.id}: downloaded ${pdfBytes.length} bytes, scanning...`);
      const map = await scanPlaceholders(Buffer.from(pdfBytes));
      const count = Object.keys(map).length;
      console.log(`[rescanAssetPlaceholders] AssetContent ${c.id}: found ${count} placeholders: ${Object.keys(map).join(", ")}`);
      totalKeys += count;
      masterContentScanned += 1;
      await prisma.assetContent.update({
        where: { id: c.id },
        data: { placeholderMap: count > 0 ? (map as any) : null },
      });
    } catch (e) {
      console.error(`[rescanAssetPlaceholders] AssetContent ${c.id} failed:`, e);
    }
  }

  for (const d of docs) {
    try {
      const pdfBytes = await downloadFile(d.fileUrl);
      const map = await scanPlaceholders(Buffer.from(pdfBytes));
      const count = Object.keys(map).length;
      totalKeys += count;
      await prisma.document.update({
        where: { id: d.id },
        data: {
          placeholderMap: count > 0 ? (map as any) : undefined,
          placementMode: count > 0 ? "PLACEHOLDER" : "GRID",
        },
      });
    } catch (e) {
      console.error(`[rescanAssetPlaceholders] Document ${d.id} failed:`, e);
    }
  }

  revalidatePath(`/assets/${assetId}`);
  return { scanned: docs.length + masterContentScanned, totalKeys, masterContentScanned };
}

export async function getDocumentForSigning(token: string) {
  const signingToken = await prisma.signingToken.findUnique({
    where: { token },
    include: {
      document: {
        include: {
          tracking: {
            include: {
              company: { select: { name: true } },
              asset: { select: { title: true, fieldDefaults: true } },
            },
          },
          stage: { select: { label: true } },
        },
      },
    },
  });

  if (!signingToken) return null;
  if (signingToken.expiresAt <= new Date()) return null;
  if (signingToken.usedAt !== null) return null;

  // HTML NDA tokens are routed via getHtmlNdaForSigning(); calling
  // getSignedUrl on an "html:<id>" sentinel would 500 inside Supabase.
  // Returning null lets /sign/[token] fall through to the HTML branch.
  const docMime = signingToken.document.mimeType;
  if (docMime === "text/html" || isHtmlNdaSentinel(signingToken.document.fileUrl)) {
    return null;
  }

  // Generate signed URL — if it fails (file missing, env vars), still return doc info
  let signedFileUrl: string;
  try {
    signedFileUrl = await getSignedUrl(signingToken.document.fileUrl, 7200);
  } catch (e) {
    console.error("Failed to generate signed URL for document:", e);
    signedFileUrl = ""; // Empty URL — page will show "Unable to load document"
  }

  return {
    ...signingToken.document,
    fileUrl: signedFileUrl,
    assetFieldDefaults:
      (signingToken.document.tracking?.asset
        ?.fieldDefaults as Record<string, string> | null) ?? {},
  };
}

export async function signDocument(data: {
  token: string;
  signedByName: string;
  signedByEmail: string;
  signatureData: string;
  fieldValues?: Record<string, string>;
}) {
  const validated = signDocumentSchema.parse(data);

  // ── Step 1: Read-only token validation + fetch asset defaults ──
  // No DB writes yet. If anything fails after this, no "ghost signed"
  // records are left behind.
  const token = await prisma.signingToken.findUnique({
    where: { token: validated.token },
    include: {
      document: {
        include: {
          tracking: {
            select: { asset: { select: { fieldDefaults: true } } },
          },
        },
      },
    },
  });

  if (!token) throw new Error("Invalid signing token");
  if (token.expiresAt <= new Date()) throw new Error("Token expired");
  if (token.usedAt !== null) throw new Error("Token already used");

  const document = token.document;

  // HTML NDAs are signed via signHtmlNda(). If a token for an HTML NDA ends
  // up here it's almost certainly a routing bug, but bail with a clear
  // message rather than crashing inside Supabase storage.
  if (document.mimeType === "text/html" || isHtmlNdaSentinel(document.fileUrl)) {
    throw new Error("This NDA uses the HTML signing flow — wrong signing endpoint.");
  }

  // ── Step 2: Atomic commit — claim token + persist signed state ──
  // PDF generation is decoupled from the commit so a slow / failed pdf-lib
  // run during a signing burst can't roll back the signature itself. The
  // signedFileUrl is left null and filled in (a) by the post-commit
  // generation below on the happy path, or (b) lazily by ensureSignedPdf
  // the first time someone hits getSignedDocumentUrl. For PLACEHOLDER docs
  // we persist the merged field values into fieldConfig — that's all the
  // info ensureSignedPdf needs to reproduce the PDF later.
  const signedAt = new Date();
  const assetFieldDefaults =
    (document.tracking?.asset?.fieldDefaults as Record<string, string> | null) ?? {};
  const docAny = document as any;
  const isPlaceholder =
    docAny.placementMode === "PLACEHOLDER" && docAny.placeholderMap;
  const mergedFieldValues: Record<string, string> = isPlaceholder
    ? {
        ...validated.fieldValues,
        ...assetFieldDefaults,
        NAME: validated.signedByName,
        EMAIL: validated.signedByEmail,
        DATE: formatDate(signedAt),
      }
    : {};

  try {
    await prisma.$transaction(async (tx) => {
    // Atomic re-claim with usedAt=null guard. Throws P2025 if another
    // request claimed the token between Step 1 and now — caught below
    // and rethrown as a friendly message.
    await tx.signingToken.update({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.document.update({
      where: { id: document.id },
      data: {
        status: "SIGNED",
        signedAt,
        signedByName: validated.signedByName,
        signedByEmail: validated.signedByEmail,
        signatureData: validated.signatureData,
        // signedFileUrl filled by post-commit gen (or lazy regen)
        // For PLACEHOLDER docs only: stash the merged values so lazy
        // regen can reproduce the PDF. fieldConfig is unused for
        // PLACEHOLDER mode at read-time so this overwrite is safe.
        ...(isPlaceholder ? { fieldConfig: mergedFieldValues as any } : {}),
      },
    });

    const currentStageStatus = await tx.stageStatus.findUnique({
      where: {
        trackingId_stageId: {
          trackingId: document.trackingId,
          stageId: document.stageId,
        },
      },
    });

    const oldStatus = currentStageStatus?.status ?? "NOT_STARTED";

    await tx.stageStatus.update({
      where: {
        trackingId_stageId: {
          trackingId: document.trackingId,
          stageId: document.stageId,
        },
      },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    await tx.stageHistory.create({
      data: {
        trackingId: document.trackingId,
        stageId: document.stageId,
        fieldName: "status",
        oldValue: oldStatus,
        newValue: "COMPLETED",
        changedByUserId: document.uploadedByUserId,
      },
    });

    await tx.activityLog.create({
      data: {
        entityType: "Document",
        entityId: document.id,
        action: "DOCUMENT_SIGNED",
        metadata: {
          trackingId: document.trackingId,
          signedByName: validated.signedByName,
        },
        userId: document.uploadedByUserId,
      },
    });
    });
  } catch (e: any) {
    if (e?.code === "P2025") {
      throw new Error("This signing link has already been used. Please contact your broker for a new link.");
    }
    throw e;
  }

  // POST-COMMIT: roll currentStageKey forward — same reason as the
  // HTML NDA flow. Outside the transaction so a sync failure can't
  // roll back signing.
  await syncCurrentStageKeyAfterCommit(token.document.trackingId);

  // POST-COMMIT: render the signed PDF best-effort. If this fails (timeout,
  // pdf-lib OOM under burst, transient Supabase error) the signature is
  // still permanent — ensureSignedPdf regenerates lazily on first download.
  try {
    const signedPath = await renderAndUploadSignedPdf({
      doc: document as any,
      signatureData: validated.signatureData,
      signedByName: validated.signedByName,
      signedByEmail: validated.signedByEmail,
      signedAt,
      fieldValues: validated.fieldValues ?? {},
      assetFieldDefaults,
    });
    // Race-safe write — only fill in if still null (won't clobber a lazy
    // regen that already raced ahead, although under normal circumstances
    // no one's hit getSignedDocumentUrl this fast).
    await prisma.document.updateMany({
      where: { id: document.id, signedFileUrl: null },
      data: { signedFileUrl: signedPath },
    });
  } catch (e) {
    console.error(
      `[signDocument] post-commit PDF render failed for doc ${document.id} — will regen on first download:`,
      e
    );
  }

  return { success: true };
}

/**
 * Investor-uploaded NDA flow: investor provides a pre-signed PDF (signed
 * offline / by their counsel) instead of the in-portal signature pad. Same
 * approval gate as signDocument — admin still has to review and approve via
 * the tracking drawer banner before IM access unlocks.
 *
 * signatureData is set to the literal sentinel "INVESTOR_UPLOAD" so the
 * admin UI can flag the source. signedFileUrl points directly to the
 * uploaded path — no PDF re-render is needed (the file IS the signed copy).
 */
export async function uploadInvestorNda(formData: FormData) {
  const file = formData.get("file") as File | null;
  const token = formData.get("token") as string | null;
  const signedByName = ((formData.get("signedByName") as string | null) ?? "").trim();
  const signedByEmail = ((formData.get("signedByEmail") as string | null) ?? "").trim();

  if (!file) throw new Error("No file provided");
  if (!token) throw new Error("Missing signing token");
  if (!signedByName) throw new Error("Your full name is required");
  z.string().email("Valid email is required").parse(signedByEmail);

  // 5 MB cap — tighter than the 10 MB admin upload limit; this is a one-off
  // NDA, not a marketing PDF.
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 5MB.");
  }
  if (file.type !== "application/pdf" && file.type !== "application/x-pdf") {
    throw new Error("Only PDF files are allowed");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.slice(0, 4).toString().startsWith("%PDF")) {
    throw new Error("Invalid PDF file (failed magic byte check)");
  }

  // ── Step 1: Read-only token validation ──
  const signingToken = await prisma.signingToken.findUnique({
    where: { token },
    include: { document: true },
  });
  if (!signingToken) throw new Error("Invalid signing token");
  if (signingToken.expiresAt <= new Date()) throw new Error("Token expired");
  if (signingToken.usedAt !== null) throw new Error("Token already used");

  const document = signingToken.document;
  const signedAt = new Date();

  // Upload BEFORE the transaction — Supabase isn't transactional with
  // Postgres, and a long upload inside the txn would hold the row lock
  // longer than necessary. Worst case if the txn fails: an orphan PDF in
  // storage (cleaned up below), no DB record.
  const safeName = (file.name || "investor-nda.pdf").replace(/[^\w.\-]/g, "_");
  const uploadedPath = `documents/${document.trackingId}/investor_${Date.now()}_${safeName}`;
  await uploadBytes(buffer, uploadedPath, "application/pdf");

  try {
    await prisma.$transaction(async (tx) => {
      // Atomic re-claim — see signDocument for rationale.
      await tx.signingToken.update({
        where: { id: signingToken.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      await tx.document.update({
        where: { id: document.id },
        data: {
          status: "SIGNED",
          signedAt,
          signedByName,
          signedByEmail,
          signatureData: "INVESTOR_UPLOAD",
          signedFileUrl: uploadedPath,
          // For HTML-template NDAs the investor uploaded a real PDF — flip
          // mimeType so download/view code paths treat it like a PDF doc.
          // fileUrl is left as the original "html:..." sentinel for audit.
          ...(document.mimeType === "text/html"
            ? { mimeType: "application/pdf" }
            : {}),
        },
      });

      const currentStageStatus = await tx.stageStatus.findUnique({
        where: {
          trackingId_stageId: {
            trackingId: document.trackingId,
            stageId: document.stageId,
          },
        },
      });
      const oldStatus = currentStageStatus?.status ?? "NOT_STARTED";

      await tx.stageStatus.update({
        where: {
          trackingId_stageId: {
            trackingId: document.trackingId,
            stageId: document.stageId,
          },
        },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      await tx.stageHistory.create({
        data: {
          trackingId: document.trackingId,
          stageId: document.stageId,
          fieldName: "status",
          oldValue: oldStatus,
          newValue: "COMPLETED",
          changedByUserId: document.uploadedByUserId,
        },
      });

      await tx.activityLog.create({
        data: {
          entityType: "Document",
          entityId: document.id,
          action: "DOCUMENT_INVESTOR_UPLOADED",
          metadata: {
            trackingId: document.trackingId,
            signedByName,
            originalFileName: file.name,
            fileSize: file.size,
          },
          userId: document.uploadedByUserId,
        },
      });
    });
  } catch (e: any) {
    // Best-effort cleanup of the orphan upload — log only, never shadow
    // the original error.
    try {
      await deleteFile(uploadedPath);
    } catch (cleanupErr) {
      console.error("[uploadInvestorNda] orphan cleanup failed:", cleanupErr);
    }
    if (e?.code === "P2025") {
      throw new Error("This signing link has already been used. Please contact your broker for a new link.");
    }
    throw e;
  }

  await syncCurrentStageKeyAfterCommit(document.trackingId);

  return { success: true };
}

export async function rejectDocument(data: {
  token: string;
  rejectionReason?: string;
}) {
  const validated = rejectDocumentSchema.parse(data);

  await prisma.$transaction(async (tx) => {
    // Atomic: validate + mark used inside transaction
    const signingToken = await tx.signingToken.findUnique({
      where: { token: validated.token },
      include: { document: true },
    });

    if (!signingToken) throw new Error("Invalid signing token");
    if (signingToken.expiresAt <= new Date()) throw new Error("Token expired");
    if (signingToken.usedAt !== null) throw new Error("Token already used");

    await tx.signingToken.update({
      where: { id: signingToken.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const doc = signingToken.document;

    await tx.document.update({
      where: { id: doc.id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: validated.rejectionReason ?? null,
      },
    });

    await tx.activityLog.create({
      data: {
        entityType: "Document",
        entityId: doc.id,
        action: "DOCUMENT_REJECTED",
        metadata: {
          trackingId: doc.trackingId,
          rejectionReason: validated.rejectionReason ?? null,
        },
        userId: doc.uploadedByUserId,
      },
    });
  });

  return { success: true };
}

/**
 * Save manual drag-drop placements for a document.
 * Sets placementMode = "MANUAL" and stores placements as fieldConfig.
 * Only callable by EDITOR+.
 */
export async function saveDocumentPlacements(
  documentId: string,
  placements: FieldPlacement[]
) {
  const user = await requireRole("EDITOR");

  const validated = saveDocumentPlacementsSchema.parse({ documentId, placements });

  const existing = await prisma.document.findUnique({
    where: { id: validated.documentId },
    select: { id: true, trackingId: true, status: true },
  });
  if (!existing) throw new Error("Document not found");
  if (existing.status === "SIGNED") {
    throw new Error("Cannot edit placements on a signed document");
  }

  await prisma.document.update({
    where: { id: validated.documentId },
    data: {
      fieldConfig: validated.placements as any,
      placementMode: "MANUAL",
      // Clear placeholder map so MANUAL takes precedence on sign
      placeholderMap: null as any,
    },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "Document",
      entityId: validated.documentId,
      action: "DOCUMENT_PLACEMENTS_SAVED",
      metadata: {
        trackingId: existing.trackingId,
        placementCount: validated.placements.length,
      },
      userId: user.id,
    },
  });

  revalidatePath(`/assets`);
  revalidatePath(`/assets/${existing.trackingId}`);
  return { success: true, count: validated.placements.length };
}

/**
 * Fetch a short-lived signed URL + basic metadata for a document
 * so the admin placement editor can render the PDF in the browser.
 * Only callable by EDITOR+.
 */
export async function getDocumentForPlacement(documentId: string) {
  await requireRole("EDITOR");

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      placementMode: true,
      fieldConfig: true,
      status: true,
    },
  });
  if (!doc) throw new Error("Document not found");

  if (isHtmlNdaSentinel(doc.fileUrl)) {
    throw new Error("HTML NDA documents don't have a placement editor — edit the template instead.");
  }

  let signedUrl = "";
  try {
    signedUrl = await getSignedUrl(doc.fileUrl, 3600);
  } catch (e) {
    console.error("Failed to generate signed URL for placement editor:", e);
  }

  return {
    id: doc.id,
    fileName: doc.fileName,
    pdfUrl: signedUrl,
    placementMode: doc.placementMode,
    placements: (doc.fieldConfig as FieldPlacement[] | null) ?? [],
    status: doc.status,
  };
}
