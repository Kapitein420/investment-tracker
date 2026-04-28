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

  const passwordHash = await bcrypt.hash(validated.password, 12);

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

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
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
