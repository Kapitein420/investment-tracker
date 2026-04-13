"use server";

import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import { uploadFile, getSignedUrl } from "@/lib/supabase-storage";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  signDocumentSchema,
  rejectDocumentSchema,
} from "@/lib/validators";

export async function uploadDocument(formData: FormData) {
  const user = await requireRole("EDITOR");

  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const trackingId = formData.get("trackingId") as string;
  const stageId = formData.get("stageId") as string;

  if (!trackingId || !stageId) {
    throw new Error("trackingId and stageId are required");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `documents/${trackingId}/${Date.now()}_${file.name}`;
  const url = await uploadFile(buffer, path, file.type);

  const document = await prisma.document.create({
    data: {
      trackingId,
      stageId,
      fileName: file.name,
      fileUrl: url,
      mimeType: file.type,
      fileSize: file.size,
      uploadedByUserId: user.id,
    },
  });

  const token = await prisma.signingToken.create({
    data: {
      documentId: document.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "Document",
      entityId: document.id,
      action: "DOCUMENT_UPLOADED",
      metadata: {
        trackingId,
        stageId,
        fileName: file.name,
      },
      userId: user.id,
    },
  });

  revalidatePath(`/assets`);
  revalidatePath(`/tracking/${trackingId}`);

  return { document, signingUrl: `/sign/${token.token}` };
}

export async function getDocumentsByTracking(trackingId: string) {
  await requireUser();

  const documents = await prisma.document.findMany({
    where: { trackingId },
    include: {
      stage: true,
      uploadedBy: { select: { id: true, name: true } },
      signingTokens: {
        where: {
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return documents;
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

  // Generate a temporary signed URL (2 hour access)
  const signedFileUrl = await getSignedUrl(signingToken.document.fileUrl, 7200);

  return {
    ...signingToken.document,
    fileUrl: signedFileUrl, // Replace stored path with temporary signed URL
  };
}

export async function signDocument(data: {
  token: string;
  signedByName: string;
  signedByEmail: string;
  signatureData: string;
}) {
  const validated = signDocumentSchema.parse(data);

  const signingToken = await prisma.signingToken.findUnique({
    where: { token: validated.token },
    include: { document: true },
  });

  if (!signingToken) throw new Error("Invalid signing token");
  if (signingToken.expiresAt <= new Date()) throw new Error("Token expired");
  if (signingToken.usedAt !== null) throw new Error("Token already used");

  const document = signingToken.document;

  await prisma.$transaction(async (tx) => {
    // Update Document to SIGNED
    await tx.document.update({
      where: { id: document.id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signedByName: validated.signedByName,
        signedByEmail: validated.signedByEmail,
        signatureData: validated.signatureData,
      },
    });

    // Mark token as used
    await tx.signingToken.update({
      where: { id: signingToken.id },
      data: { usedAt: new Date() },
    });

    // Update StageStatus to COMPLETED
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
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Create StageHistory
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

    // Create ActivityLog
    await tx.activityLog.create({
      data: {
        entityType: "Document",
        entityId: document.id,
        action: "DOCUMENT_SIGNED",
        metadata: {
          trackingId: document.trackingId,
          stageId: document.stageId,
          signedByName: validated.signedByName,
          signedByEmail: validated.signedByEmail,
        },
        userId: document.uploadedByUserId,
      },
    });
  });

  return { success: true };
}

export async function rejectDocument(data: {
  token: string;
  rejectionReason?: string;
}) {
  const validated = rejectDocumentSchema.parse(data);

  const signingToken = await prisma.signingToken.findUnique({
    where: { token: validated.token },
    include: { document: true },
  });

  if (!signingToken) throw new Error("Invalid signing token");
  if (signingToken.expiresAt <= new Date()) throw new Error("Token expired");
  if (signingToken.usedAt !== null) throw new Error("Token already used");

  const document = signingToken.document;

  await prisma.$transaction(async (tx) => {
    // Update Document to REJECTED
    await tx.document.update({
      where: { id: document.id },
      data: {
        status: "REJECTED",
        rejectedAt: new Date(),
        rejectionReason: validated.rejectionReason ?? null,
      },
    });

    // Mark token as used
    await tx.signingToken.update({
      where: { id: signingToken.id },
      data: { usedAt: new Date() },
    });

    // Create ActivityLog
    await tx.activityLog.create({
      data: {
        entityType: "Document",
        entityId: document.id,
        action: "DOCUMENT_REJECTED",
        metadata: {
          trackingId: document.trackingId,
          stageId: document.stageId,
          rejectionReason: validated.rejectionReason ?? null,
        },
        userId: document.uploadedByUserId,
      },
    });
  });

  return { success: true };
}
