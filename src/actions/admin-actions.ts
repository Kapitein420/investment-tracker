"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
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
      subject: "Your password has been reset — Investment Portal",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #b8860b, #daa520); padding: 32px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 600;">Password Reset</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1a1a1a; margin-top: 0;">Your password has been reset</h2>
            <p style="color: #4b5563; line-height: 1.6;">
              An administrator has reset your password. Use the new credentials below to log in.
            </p>
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #6b7280; padding: 6px 0; font-size: 14px; width: 80px;">Email</td>
                  <td style="color: #1a1a1a; padding: 6px 0; font-size: 14px; font-weight: 600;">${user.email}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; padding: 6px 0; font-size: 14px;">Password</td>
                  <td style="color: #1a1a1a; padding: 6px 0; font-size: 14px; font-weight: 600; font-family: monospace; letter-spacing: 1px;">${newPassword}</td>
                </tr>
              </table>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${process.env.NEXTAUTH_URL}/login" style="background: linear-gradient(135deg, #b8860b, #daa520); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Log in to Portal
              </a>
            </div>
          </div>
        </div>
      `,
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
