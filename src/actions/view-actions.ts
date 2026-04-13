"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/permissions";
import { savedViewSchema } from "@/lib/validators";

export async function saveView(data: {
  name: string;
  assetId?: string;
  filterConfig: Record<string, unknown>;
}) {
  const user = await requireUser();
  const validated = savedViewSchema.parse(data);

  const view = await prisma.savedView.create({
    data: {
      userId: user.id,
      name: validated.name,
      assetId: validated.assetId ?? null,
      filterConfig: validated.filterConfig,
    },
  });

  revalidatePath("/assets");
  return view;
}

export async function getViews() {
  const user = await requireUser();

  return prisma.savedView.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteView(id: string) {
  const user = await requireUser();

  const view = await prisma.savedView.findUniqueOrThrow({
    where: { id },
  });

  if (view.userId !== user.id) {
    throw new Error("Forbidden: you can only delete your own views");
  }

  await prisma.savedView.delete({ where: { id } });

  revalidatePath("/assets");
}
