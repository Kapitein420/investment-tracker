"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import {
  createAssetSchema,
  updateAssetSchema,
  createCompanySchema,
  type CreateAssetInput,
  type UpdateAssetInput,
  type CreateCompanyInput,
} from "@/lib/validators";

export async function createAsset(data: CreateAssetInput) {
  const user = await requireRole("EDITOR");
  const validated = createAssetSchema.parse(data);

  const asset = await prisma.asset.create({
    data: {
      ...validated,
      createdById: user.id,
    },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "Asset",
      entityId: asset.id,
      action: "CREATED",
      metadata: { title: asset.title },
      userId: user.id,
    },
  });

  revalidatePath("/assets");
  return asset;
}

export async function updateAsset(id: string, data: UpdateAssetInput) {
  await requireRole("EDITOR");
  const validated = updateAssetSchema.parse(data);

  const asset = await prisma.asset.update({
    where: { id },
    data: validated,
  });

  revalidatePath("/assets");
  revalidatePath(`/assets/${id}`);
  return asset;
}

export async function deleteAsset(id: string) {
  await requireRole("ADMIN");

  await prisma.asset.delete({ where: { id } });

  revalidatePath("/assets");
}

export async function createCompany(data: CreateCompanyInput) {
  await requireRole("EDITOR");
  const validated = createCompanySchema.parse(data);

  const company = await prisma.company.create({
    data: validated,
  });

  revalidatePath("/assets");
  return company;
}

export async function getAssets() {
  await requireUser();

  return prisma.asset.findMany({
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { trackings: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAssetById(id: string) {
  await requireUser();

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      trackings: {
        include: {
          company: true,
          stageStatuses: {
            include: { stage: true },
            orderBy: { stage: { sequence: "asc" } },
          },
          comments: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
          ownerUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!asset) throw new Error("Asset not found");
  return asset;
}
