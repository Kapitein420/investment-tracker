"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import { uploadFile, getSignedUrl, deleteFile } from "@/lib/supabase-storage";

export async function createAssetContent(data: {
  assetId: string;
  stageKey: string;
  contentType: "PDF" | "LANDING_PAGE";
  title: string;
  fileUrl?: string;
  fileName?: string;
  htmlContent?: string;
  description?: string;
  imageUrls?: string[];
  keyMetrics?: Record<string, unknown>;
  isPublished?: boolean;
}) {
  await requireRole("EDITOR");

  if (!data.assetId || !data.stageKey || !data.contentType || !data.title) {
    throw new Error("assetId, stageKey, contentType, and title are required");
  }

  // Prevent publishing PDF content without a file
  if (data.contentType === "PDF" && data.isPublished && !data.fileUrl) {
    throw new Error("Cannot publish PDF content without a file. Upload a file first.");
  }

  const content = await prisma.assetContent.create({
    data: {
      assetId: data.assetId,
      stageKey: data.stageKey,
      contentType: data.contentType,
      title: data.title,
      fileUrl: data.fileUrl ?? null,
      fileName: data.fileName ?? null,
      htmlContent: data.htmlContent ?? null,
      description: data.description ?? null,
      imageUrls: data.imageUrls ? JSON.parse(JSON.stringify(data.imageUrls)) : [],
      keyMetrics: data.keyMetrics ? JSON.parse(JSON.stringify(data.keyMetrics)) : undefined,
      isPublished: data.isPublished ?? false,
    },
  });

  revalidatePath(`/assets/${data.assetId}`);
  revalidatePath(`/portal`);

  return content;
}

export async function updateAssetContent(
  id: string,
  data: {
    title?: string;
    fileUrl?: string;
    fileName?: string;
    htmlContent?: string;
    description?: string;
    imageUrls?: string[];
    keyMetrics?: Record<string, unknown>;
    isPublished?: boolean;
  }
) {
  await requireRole("EDITOR");

  const allowedFields = ['title', 'fileUrl', 'fileName', 'htmlContent', 'description', 'isPublished', 'imageUrls', 'keyMetrics'];
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      sanitized[key] = value;
    }
  }

  const updateData: any = { ...sanitized };
  if (data.keyMetrics) updateData.keyMetrics = JSON.parse(JSON.stringify(data.keyMetrics));
  if (data.imageUrls) updateData.imageUrls = JSON.parse(JSON.stringify(data.imageUrls));

  const content = await prisma.assetContent.update({
    where: { id },
    data: updateData,
  });

  revalidatePath(`/assets/${content.assetId}`);
  revalidatePath(`/portal`);

  return content;
}

export async function deleteAssetContent(id: string) {
  await requireRole("ADMIN");

  // Fetch first so we can clean up storage files
  const existing = await prisma.assetContent.findUniqueOrThrow({
    where: { id },
  });

  // Delete associated files from Supabase Storage
  const pathsToDelete: string[] = [];
  if (existing.fileUrl && !existing.fileUrl.startsWith("http")) {
    pathsToDelete.push(existing.fileUrl);
  }
  if (Array.isArray(existing.imageUrls)) {
    for (const url of existing.imageUrls as unknown[]) {
      if (typeof url === "string" && !url.startsWith("http")) {
        pathsToDelete.push(url);
      }
    }
  }
  for (const path of pathsToDelete) {
    try {
      await deleteFile(path);
    } catch (e) {
      console.error(`Failed to delete storage file ${path}:`, e);
    }
  }

  await prisma.assetContent.delete({ where: { id } });

  revalidatePath(`/assets/${existing.assetId}`);
  revalidatePath(`/portal`);
}

export async function getAssetContents(assetId: string) {
  await requireRole("EDITOR");

  const contents = await prisma.assetContent.findMany({
    where: { assetId },
    orderBy: { stageKey: "asc" },
  });

  return contents;
}

export async function getSignedContentUrl(storagePath: string) {
  const user = await requireUser();

  // Find matching content or document
  const content = await prisma.assetContent.findFirst({
    where: { fileUrl: storagePath },
    select: { id: true, assetId: true },
  });

  let doc = null;
  if (!content) {
    doc = await prisma.document.findFirst({
      where: { OR: [{ fileUrl: storagePath }, { signedFileUrl: storagePath }] },
      include: { tracking: { select: { assetId: true, companyId: true } } },
    });
  }

  // Must exist in one of the tables
  if (!content && !doc) throw new Error("Forbidden: file not found");

  // INVESTOR check: must have access to the asset
  if (user.role === "INVESTOR") {
    if (!user.companyId) throw new Error("Forbidden");
    const assetId = content?.assetId ?? doc?.tracking.assetId;
    if (!assetId) throw new Error("Forbidden");

    const tracking = await prisma.assetCompanyTracking.findFirst({
      where: { assetId, companyId: user.companyId },
    });
    if (!tracking) throw new Error("Forbidden: no access to this asset");

    // If it's a Document, also check the document belongs to their company
    if (doc && doc.tracking.companyId !== user.companyId) {
      throw new Error("Forbidden");
    }
  }

  return getSignedUrl(storagePath, 7200);
}

export async function upsertTeaserContent(data: {
  assetId: string;
  description?: string;
  imageUrls?: string[];
  keyMetrics?: Record<string, unknown>;
}) {
  await requireRole("EDITOR");

  if (!data.assetId) throw new Error("assetId is required");

  const existing = await prisma.assetContent.findFirst({
    where: {
      assetId: data.assetId,
      stageKey: "teaser",
      contentType: "LANDING_PAGE",
    },
  });

  const payload = {
    title: "Property Overview",
    description: data.description ?? null,
    imageUrls: data.imageUrls ? JSON.parse(JSON.stringify(data.imageUrls)) : [],
    keyMetrics: data.keyMetrics ? JSON.parse(JSON.stringify(data.keyMetrics)) : undefined,
    isPublished: true,
  };

  let content;
  if (existing) {
    content = await prisma.assetContent.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    content = await prisma.assetContent.create({
      data: {
        assetId: data.assetId,
        stageKey: "teaser",
        contentType: "LANDING_PAGE",
        ...payload,
      },
    });
  }

  revalidatePath(`/assets/${data.assetId}`);
  revalidatePath(`/portal`);

  return content;
}

export async function uploadContentFile(formData: FormData) {
  await requireRole("EDITOR");

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");

  const ALLOWED_MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!ALLOWED_MIMES.includes(file.type)) {
    throw new Error("File type not allowed");
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File too large. Maximum 10MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `content/${Date.now()}-${file.name}`;

  const publicUrl = await uploadFile(buffer, path, file.type);

  return publicUrl;
}
