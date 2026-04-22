"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import {
  createAssetSchema,
  updateAssetSchema,
  createCompanySchema,
  assetFieldDefaultsSchema,
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

/** Save the admin-supplied project-level defaults for document placeholders.
 *  These pre-fill NDA / IM fields when an investor signs and hide those keys
 *  from the investor-facing form so they cannot be edited. */
export async function updateAssetFieldDefaults(
  assetId: string,
  defaults: Record<string, string>
) {
  const user = await requireRole("EDITOR");
  const validated = assetFieldDefaultsSchema.parse(defaults);

  // Drop empty-string entries so the form never shows stale blank defaults
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(validated)) {
    const trimmed = v.trim();
    if (trimmed.length > 0) cleaned[k] = trimmed;
  }

  const asset = await prisma.asset.update({
    where: { id: assetId },
    data: { fieldDefaults: cleaned },
    select: { id: true, fieldDefaults: true },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "Asset",
      entityId: asset.id,
      action: "ASSET_FIELD_DEFAULTS_UPDATED",
      metadata: { keys: Object.keys(cleaned) },
      userId: user.id,
    },
  });

  revalidatePath(`/assets/${assetId}`);
  revalidatePath(`/portal/${assetId}`);
  return asset;
}

/** Return the merged set of placeholder tokens detected for this asset.
 *  Looks at the master AssetContent PDFs (NDA / IM templates) plus any
 *  per-investor Document already cloned out, so the Project fields panel
 *  populates as soon as the master NDA is uploaded. */
export async function getAssetPlaceholderTokens(
  assetId: string
): Promise<string[]> {
  await requireUser();

  const [contents, docs] = await Promise.all([
    prisma.assetContent.findMany({
      where: { assetId, contentType: "PDF" },
      select: { placeholderMap: true },
      take: 50,
    }),
    prisma.document.findMany({
      where: {
        tracking: { assetId },
        placementMode: "PLACEHOLDER",
        status: { in: ["PENDING", "SIGNED"] },
      },
      select: { placeholderMap: true },
      take: 50,
    }),
  ]);

  const set = new Set<string>();
  const collect = (raw: unknown) => {
    if (raw && typeof raw === "object") {
      for (const key of Object.keys(raw as Record<string, unknown>)) {
        set.add(key);
      }
    }
  };
  for (const c of contents) collect(c.placeholderMap);
  for (const d of docs) collect(d.placeholderMap);
  return Array.from(set).sort();
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
