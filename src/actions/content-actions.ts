"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { uploadFile } from "@/lib/supabase-storage";

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

  const updateData: any = { ...data };
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

  const content = await prisma.assetContent.delete({
    where: { id },
  });

  revalidatePath(`/assets/${content.assetId}`);
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

export async function uploadContentFile(formData: FormData) {
  await requireRole("EDITOR");

  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `content/${Date.now()}-${file.name}`;

  const publicUrl = await uploadFile(buffer, path, file.type);

  return publicUrl;
}
