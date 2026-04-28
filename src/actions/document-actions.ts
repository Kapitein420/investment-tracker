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
    //   - approval cleared (so IM re-locks)
    //   - subsequent stages that were unlocked by this approval also revert
    // Mostly used for re-testing, but also valid if the admin notices a
    // mistake on the signed copy and wants the investor to redo it.
    if (doc.status === "SIGNED") {
      const ss = await tx.stageStatus.findUnique({
        where: { trackingId_stageId: { trackingId: doc.trackingId, stageId: doc.stageId } },
        include: { stage: { select: { key: true } } },
      });
      if (ss) {
        await tx.stageStatus.update({
          where: { id: ss.id },
          data: {
            status: "NOT_STARTED",
            completedAt: null,
            approvedAt: null,
            approvedByUserId: null,
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
    include: { tracking: { select: { companyId: true } } },
  });

  // Investors can only access their own company's documents
  if (user.role === "INVESTOR" && doc.tracking.companyId !== user.companyId) {
    throw new Error("Forbidden");
  }

  // HTML NDAs are rendered server-side at /portal/signed-nda/[id]; they don't
  // have a downloadable file. Refuse rather than 500ing inside Supabase.
  if (doc.mimeType === "text/html" || isHtmlNdaSentinel(doc.fileUrl)) {
    throw new Error("HTML NDA documents are viewed via the portal — no download URL.");
  }

  // Prefer signed version if available
  const path = doc.signedFileUrl ?? doc.fileUrl;
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

  // ── Step 2: Generate + upload signed PDF BEFORE committing ──
  // If PDF generation fails the investor sees a clear error and can
  // retry — the document is NOT marked SIGNED with a missing file.
  const pdfStart = Date.now();
  let signedFileUrl: string;
  try {
    const originalPdfBytes = await downloadFile(document.fileUrl);

    const docAny = document as any;
    let signedPdfBytes;
    if (docAny.placementMode === "PLACEHOLDER" && docAny.placeholderMap) {
      const assetDefaults =
        (document.tracking?.asset?.fieldDefaults as Record<string, string> | null) ??
        {};

      // Merge order (later overrides earlier):
      //   1. investor-supplied values (lowest)
      //   2. admin-set asset defaults
      //   3. system-authoritative identity / date (highest)
      const mergedValues: Record<string, string> = {
        ...validated.fieldValues,
        ...assetDefaults,
        NAME: validated.signedByName,
        EMAIL: validated.signedByEmail,
        DATE: formatDate(new Date()),
      };
      signedPdfBytes = await generateSignedPdfFromPlaceholders(
        originalPdfBytes,
        validated.signatureData,
        mergedValues,
        docAny.placeholderMap as any
      );
    } else if (docAny.placementMode === "MANUAL") {
      const manualPlacements: FieldPlacement[] =
        (document.fieldConfig as FieldPlacement[] | null) ?? [];

      signedPdfBytes = await generateSignedPdf(
        originalPdfBytes,
        validated.signatureData,
        validated.signedByName,
        formatDate(new Date()),
        manualPlacements.length > 0 ? manualPlacements : DEFAULT_FIELD_CONFIG
      );
    } else {
      const fieldConfig: FieldPlacement[] =
        (document.fieldConfig as FieldPlacement[] | null) ?? DEFAULT_FIELD_CONFIG;

      signedPdfBytes = await generateSignedPdf(
        originalPdfBytes,
        validated.signatureData,
        validated.signedByName,
        formatDate(new Date()),
        fieldConfig
      );
    }

    const signedPath = `documents/${document.trackingId}/signed_${Date.now()}_${document.fileName}`;
    signedFileUrl = await uploadBytes(signedPdfBytes, signedPath, "application/pdf");

    console.log(
      `[signDocument] PDF generation completed in ${Date.now() - pdfStart}ms for doc ${document.id}`
    );
  } catch (e) {
    console.error(
      `[signDocument] PDF generation failed after ${Date.now() - pdfStart}ms for doc ${document.id}:`,
      e
    );
    throw new Error(
      "We couldn't finalize your signed document. Please try again — if this keeps happening, contact support."
    );
  }

  // ── Step 3: Atomic commit — claim token + persist signed state ──
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
        signedAt: new Date(),
        signedByName: validated.signedByName,
        signedByEmail: validated.signedByEmail,
        signatureData: validated.signatureData,
        signedFileUrl,
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
