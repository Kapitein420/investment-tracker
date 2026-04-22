"use server";

import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import { uploadFile, getSignedUrl, downloadFile, uploadBytes } from "@/lib/supabase-storage";
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
    select: { id: true, fileUrl: true },
  });

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
      },
      select: { id: true, fileUrl: true },
      take: 50,
    }),
  ]);

  let totalKeys = 0;
  let masterContentScanned = 0;

  for (const c of contents) {
    if (!c.fileUrl) continue;
    try {
      const pdfBytes = await downloadFile(c.fileUrl);
      const map = await scanPlaceholders(Buffer.from(pdfBytes));
      const count = Object.keys(map).length;
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

  // ── All validation + updates inside transaction to prevent race conditions ──
  const { document, signingTokenId } = await prisma.$transaction(async (tx) => {
    // Atomic check: find token AND verify unused in one query
    const token = await tx.signingToken.findUnique({
      where: { token: validated.token },
      include: { document: true },
    });

    if (!token) throw new Error("Invalid signing token");
    if (token.expiresAt <= new Date()) throw new Error("Token expired");
    if (token.usedAt !== null) throw new Error("Token already used");

    // Immediately mark token as used (prevents race condition)
    await tx.signingToken.update({
      where: { id: token.id, usedAt: null }, // atomic: only update if still unused
      data: { usedAt: new Date() },
    });

    await tx.document.update({
      where: { id: token.document.id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signedByName: validated.signedByName,
        signedByEmail: validated.signedByEmail,
        signatureData: validated.signatureData,
      },
    });

    const doc = token.document;

    const currentStageStatus = await tx.stageStatus.findUnique({
      where: {
        trackingId_stageId: {
          trackingId: doc.trackingId,
          stageId: doc.stageId,
        },
      },
    });

    const oldStatus = currentStageStatus?.status ?? "NOT_STARTED";

    await tx.stageStatus.update({
      where: {
        trackingId_stageId: {
          trackingId: doc.trackingId,
          stageId: doc.stageId,
        },
      },
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
        action: "DOCUMENT_SIGNED",
        metadata: {
          trackingId: doc.trackingId,
          signedByName: validated.signedByName,
        },
        userId: doc.uploadedByUserId,
      },
    });

    return { document: doc, signingTokenId: token.id };
  });

  // ── Generate signed PDF (non-blocking — runs after DB commit) ───
  // The signature is already saved above; this just produces the
  // pretty PDF with the embedded signature image. If it fails the
  // signature record is still valid.
  const pdfStart = Date.now();
  try {
    const originalPdfBytes = await downloadFile(document.fileUrl);

    const docAny = document as any;
    let signedPdfBytes;
    if (docAny.placementMode === "PLACEHOLDER" && docAny.placeholderMap) {
      // Pull project-level defaults off the asset so admin-set fields like
      // BUILDING_NAME / VENDOR / CITY always win over anything the investor
      // might submit.
      const assetRecord = await prisma.document.findUnique({
        where: { id: document.id },
        select: {
          tracking: { select: { asset: { select: { fieldDefaults: true } } } },
        },
      });
      const assetDefaults =
        (assetRecord?.tracking?.asset?.fieldDefaults as Record<string, string> | null) ??
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
      // Use the manual drag-drop placements (already contain explicit x/y/w/h)
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
    const signedFileUrl = await uploadBytes(signedPdfBytes, signedPath, "application/pdf");

    // Patch the document with the generated PDF URL
    await prisma.document.update({
      where: { id: document.id },
      data: { signedFileUrl },
    });

    console.log(`[signDocument] PDF generation completed in ${Date.now() - pdfStart}ms for doc ${document.id}`);
  } catch (e) {
    console.error(
      `[signDocument] PDF generation failed after ${Date.now() - pdfStart}ms for doc ${document.id}:`,
      e
    );
    // Non-fatal — the signature data is already persisted
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
