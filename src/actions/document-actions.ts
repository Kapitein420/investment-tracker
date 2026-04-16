"use server";

import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import { uploadFile, getSignedUrl, downloadFile, uploadBytes } from "@/lib/supabase-storage";
import { generateSignedPdf, generateSignedPdfFromPlaceholders, type FieldPlacement } from "@/lib/pdf-signing";
import { scanPlaceholders } from "@/lib/pdf-placeholder-scan";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signDocumentSchema, rejectDocumentSchema } from "@/lib/validators";
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

  // Scan for placeholders with a 5s timeout so slow PDFs don't
  // block the Vercel serverless function (default limit is 10s).
  let placeholderMap: Record<string, any> | null = null;
  let placementMode: "GRID" | "PLACEHOLDER" = "GRID";
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

export async function getDocumentForSigning(token: string) {
  const signingToken = await prisma.signingToken.findUnique({
    where: { token },
    include: {
      document: {
        include: {
          tracking: {
            include: {
              company: { select: { name: true } },
              asset: { select: { title: true } },
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
  };
}

export async function signDocument(data: {
  token: string;
  signedByName: string;
  signedByEmail: string;
  signatureData: string;
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
      signedPdfBytes = await generateSignedPdfFromPlaceholders(
        originalPdfBytes,
        validated.signatureData,
        validated.signedByName,
        formatDate(new Date()),
        docAny.placeholderMap as any,
        validated.signedByEmail
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
