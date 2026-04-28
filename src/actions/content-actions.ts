"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import { uploadFile, getSignedUrl, deleteFile, downloadFile } from "@/lib/supabase-storage";
import { scanPlaceholders } from "@/lib/pdf-placeholder-scan";

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

  // Scan PDFs for {{TOKEN}} / {TOKEN} placeholders so the admin sees them in
  // the Project fields panel and per-investor signing forms can be auto-built.
  let placeholderMap: Record<string, unknown> | null = null;
  if (data.contentType === "PDF" && data.fileUrl) {
    try {
      const bytes = await downloadFile(data.fileUrl);
      const map = await scanPlaceholders(Buffer.from(bytes));
      if (Object.keys(map).length > 0) placeholderMap = map as any;
    } catch (e) {
      console.error("[createAssetContent] placeholder scan failed (continuing):", e);
    }
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
      placeholderMap: placeholderMap as any,
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

  // If the file is being replaced, re-scan placeholders so Project fields stays in sync
  if (data.fileUrl) {
    try {
      const existing = await prisma.assetContent.findUnique({
        where: { id },
        select: { contentType: true },
      });
      if (existing?.contentType === "PDF") {
        const bytes = await downloadFile(data.fileUrl);
        const map = await scanPlaceholders(Buffer.from(bytes));
        updateData.placeholderMap = Object.keys(map).length > 0 ? (map as any) : null;
      }
    } catch (e) {
      console.error("[updateAssetContent] placeholder scan failed (continuing):", e);
    }
  }

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

  // HTML NDA templates are referenced by per-investor Documents via the
  // sentinel fileUrl "html:<thisId>". Deleting the template would orphan
  // every signed copy — the signed-NDA viewer re-reads this row to verify
  // the document. Refuse if any signed/pending NDA still points here.
  const referencingDocs = await prisma.document.count({
    where: { fileUrl: `html:${existing.id}` },
  });
  if (referencingDocs > 0) {
    throw new Error(
      `Can't delete — ${referencingDocs} investor NDA${
        referencingDocs === 1 ? "" : "s"
      } reference${referencingDocs === 1 ? "s" : ""} this template.`
    );
  }

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
  let investorTrackingId: string | null = null;
  let investorContentStageKey: string | null = null;
  if (user.role === "INVESTOR") {
    if (!user.companyId) throw new Error("Forbidden");
    const assetId = content?.assetId ?? doc?.tracking.assetId;
    if (!assetId) throw new Error("Forbidden");

    const tracking = await prisma.assetCompanyTracking.findFirst({
      where: { assetId, companyId: user.companyId },
      select: { id: true },
    });
    if (!tracking) throw new Error("Forbidden: no access to this asset");
    investorTrackingId = tracking.id;

    // If it's a Document, also check the document belongs to their company
    if (doc && doc.tracking.companyId !== user.companyId) {
      throw new Error("Forbidden");
    }

    // For AssetContent (IM, NDA template, etc.), capture the stage key so
    // we can log a per-tracking access event below.
    if (content) {
      const fullContent = await prisma.assetContent.findUnique({
        where: { id: content.id },
        select: { stageKey: true },
      });
      investorContentStageKey = fullContent?.stageKey ?? null;
    }
  }

  // Log the access — surfaces "first viewed at" timestamps in the admin
  // overview ("Anna opened the IM at 14:02"). Best-effort: logging failure
  // never blocks the URL from being returned.
  if (
    user.role === "INVESTOR" &&
    investorTrackingId &&
    content &&
    investorContentStageKey
  ) {
    try {
      await prisma.activityLog.create({
        data: {
          entityType: "AssetContent",
          entityId: content.id,
          action: "CONTENT_ACCESSED",
          metadata: {
            trackingId: investorTrackingId,
            stageKey: investorContentStageKey,
            storagePath,
          },
          userId: user.id,
        },
      });
    } catch (e) {
      console.error("[getSignedContentUrl] access log failed:", e);
    }
  }

  return getSignedUrl(storagePath, 7200);
}

/**
 * For each tracking on an asset, return the earliest CONTENT_ACCESSED
 * event per stage. Drives the "first viewed" timestamp shown in the admin
 * overview so brokers can see who has actually opened the IM.
 */
export async function getContentAccessByTracking(
  assetId: string,
  stageKey: string
): Promise<Record<string, Date>> {
  await requireUser();

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: { assetId },
    select: { id: true },
  });
  if (trackings.length === 0) return {};
  const trackingIds = trackings.map((t) => t.id);

  const logs = await prisma.activityLog.findMany({
    where: {
      action: "CONTENT_ACCESSED",
      entityType: "AssetContent",
    },
    select: { metadata: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const earliest: Record<string, Date> = {};
  for (const log of logs) {
    const m = log.metadata as any;
    if (!m) continue;
    if (m.stageKey !== stageKey) continue;
    if (!trackingIds.includes(m.trackingId)) continue;
    if (!earliest[m.trackingId]) earliest[m.trackingId] = log.createdAt;
  }
  return earliest;
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
