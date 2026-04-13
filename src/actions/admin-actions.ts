"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
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
