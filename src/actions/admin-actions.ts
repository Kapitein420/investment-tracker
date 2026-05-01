"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { renderEmail, renderCredentialsTable, renderCta } from "@/lib/email-template";
import { getAppUrl } from "@/lib/app-url";
import {
  createUserSchema,
  updateUserSchema,
  updatePipelineStageSchema,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/lib/validators";

// ─── User Management ────────────────────────────────────────────────────────

export async function getUsers() {
  await requireRole("ADMIN");

  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function createUser(data: CreateUserInput) {
  await requireRole("ADMIN");
  const validated = createUserSchema.parse(data);

  const existingUser = await prisma.user.findUnique({
    where: { email: validated.email },
  });

  if (existingUser) {
    throw new Error("A user with this email already exists");
  }

  // bcrypt cost 10 — OWASP-recommended minimum. Cost 12 was ~250ms per
  // verify on Vercel's CPU; under bursty auth load that serialised every
  // login through bcrypt and produced 68% false 401s at 100 concurrent.
  // Cost 10 is ~62ms — still strong (≥10K hash/s would still take centuries
  // to brute-force a single password) and fixes the load-test cliff.
  const passwordHash = await bcrypt.hash(validated.password, 10);

  const user = await prisma.user.create({
    data: {
      name: validated.name,
      email: validated.email,
      passwordHash,
      role: validated.role,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  // Seed VIEWER asset access if the admin pre-selected assets in the
  // create dialog — saves them a second click into Manage access right
  // after creating the account.
  if (
    validated.role === "VIEWER" &&
    validated.accessibleAssetIds &&
    validated.accessibleAssetIds.length > 0
  ) {
    const validAssets = await prisma.asset.findMany({
      where: { id: { in: validated.accessibleAssetIds } },
      select: { id: true },
    });
    if (validAssets.length > 0) {
      const adminUser = await requireRole("ADMIN");
      await prisma.assetViewerAccess.createMany({
        data: validAssets.map((a) => ({
          userId: user.id,
          assetId: a.id,
          grantedByUserId: adminUser.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  revalidatePath("/admin/users");
  return user;
}

export async function updateUser(id: string, data: UpdateUserInput) {
  await requireRole("ADMIN");
  const validated = updateUserSchema.parse(data);

  if (validated.email) {
    const existing = await prisma.user.findFirst({
      where: { email: validated.email, NOT: { id } },
    });
    if (existing) throw new Error("A user with this email already exists");
  }

  const user = await prisma.user.update({
    where: { id },
    data: validated,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  revalidatePath("/admin/users");
  return user;
}

// ─── VIEWER per-asset access ────────────────────────────────────────────────
// VIEWER role (opdrachtgevers / clients) can only see the assets they're
// explicitly granted access to via AssetViewerAccess. ADMIN/EDITOR have full
// access; INVESTOR access is governed by AssetCompanyTracking and is unrelated.

/**
 * Returns the set of asset ids a given VIEWER user has access to. Used to
 * pre-populate the multi-select on the team-management UI.
 */
export async function getViewerAssetAccess(userId: string): Promise<string[]> {
  await requireRole("ADMIN");

  const rows = await prisma.assetViewerAccess.findMany({
    where: { userId },
    select: { assetId: true },
  });
  return rows.map((r) => r.assetId);
}

/**
 * Replace the full set of accessible asset ids for a VIEWER user. Ignores
 * non-VIEWER targets defensively (UI shouldn't expose the form for those
 * roles, but the server is the source of truth).
 *
 * Diffs in a single transaction so a partial failure can never grant or
 * revoke a subset.
 */
export async function setViewerAssetAccess(
  userId: string,
  assetIds: string[]
): Promise<{ ok: true; granted: number; revoked: number; total: number }> {
  const adminUser = await requireRole("ADMIN");

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!target) throw new Error("User not found");
  if (target.role !== "VIEWER") {
    throw new Error("Asset access is only configurable for VIEWER role users");
  }

  // Verify all submitted asset ids exist — drop any that don't to keep the
  // table free of dangling rows even if the client serialised stale ids.
  const validAssets = assetIds.length
    ? await prisma.asset.findMany({
        where: { id: { in: assetIds } },
        select: { id: true },
      })
    : [];
  const validIds = new Set(validAssets.map((a) => a.id));
  const desired = Array.from(validIds);

  const existing = await prisma.assetViewerAccess.findMany({
    where: { userId },
    select: { assetId: true },
  });
  const existingSet = new Set(existing.map((r) => r.assetId));
  const desiredSet = new Set(desired);

  const toGrant = desired.filter((id) => !existingSet.has(id));
  const toRevoke = Array.from(existingSet).filter((id) => !desiredSet.has(id));

  await prisma.$transaction(async (tx) => {
    if (toRevoke.length > 0) {
      await tx.assetViewerAccess.deleteMany({
        where: { userId, assetId: { in: toRevoke } },
      });
    }
    if (toGrant.length > 0) {
      await tx.assetViewerAccess.createMany({
        data: toGrant.map((assetId) => ({
          userId,
          assetId,
          grantedByUserId: adminUser.id,
        })),
        skipDuplicates: true,
      });
    }
    await tx.activityLog.create({
      data: {
        entityType: "User",
        entityId: userId,
        action: "VIEWER_ASSET_ACCESS_UPDATED",
        metadata: {
          granted: toGrant,
          revoked: toRevoke,
          totalAfter: desired.length,
        },
        userId: adminUser.id,
      },
    });
  });

  revalidatePath("/admin/users");
  return { ok: true, granted: toGrant.length, revoked: toRevoke.length, total: desired.length };
}

/**
 * Lightweight asset list for the access-management dialog. ADMIN-only.
 */
export async function listAssetsForViewerPicker(): Promise<
  Array<{ id: string; title: string; city: string; country: string }>
> {
  await requireRole("ADMIN");

  return prisma.asset.findMany({
    select: { id: true, title: true, city: true, country: true },
    orderBy: { updatedAt: "desc" },
  });
}

// ─── Pipeline Stage Management ──────────────────────────────────────────────

export async function getPipelineStages() {
  await requireRole("ADMIN");

  return prisma.pipelineStage.findMany({
    orderBy: { sequence: "asc" },
  });
}

export async function updatePipelineStage(
  id: string,
  data: { label?: string; sequence?: number; isActive?: boolean }
) {
  await requireRole("ADMIN");
  const validated = updatePipelineStageSchema.parse(data);

  const stage = await prisma.pipelineStage.update({
    where: { id },
    data: validated,
  });

  revalidatePath("/admin/pipeline");
  return stage;
}

export async function resetUserPassword(userId: string) {
  await requireRole("ADMIN");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  // Generate random 12-char password
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const newPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordChangedAt: null },
  });

  // Send email with new password
  try {
    await sendEmail({
      to: user.email,
      subject: "Your password has been reset — DILS Investment Portal",
      html: renderEmail({
        heading: "Your password has been reset",
        bodyHtml: `
          <p style="color: #101820; line-height: 1.6; font-size: 14px; margin: 0 0 24px 0;">
            An administrator has reset your password. Use the new credentials below to log in.
          </p>
          ${renderCredentialsTable([
            { label: "Email", value: user.email, mono: true },
            { label: "Password", value: newPassword, mono: true },
          ])}
          ${renderCta("Log in to portal", `${getAppUrl()}/login`)}
          <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0; border-top: 1px solid #E6E8EB; padding-top: 20px;">
            For your security, change this password after logging in. If you didn't request this reset, contact the deal team immediately.
          </p>
        `,
      }),
    });
  } catch (e) {
    console.error("Password reset email failed:", e);
  }

  await prisma.activityLog.create({
    data: {
      entityType: "User",
      entityId: userId,
      action: "PASSWORD_RESET",
      metadata: { email: user.email },
      userId: (await requireRole("ADMIN")).id,
    },
  });

  revalidatePath("/admin/users");
  return { success: true, email: user.email };
}
