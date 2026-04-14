"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/permissions";
import {
  createCommentSchema,
  updateCommentSchema,
  type CreateCommentInput,
} from "@/lib/validators";

export async function createComment(data: CreateCommentInput) {
  const user = await requireRole("EDITOR");
  const validated = createCommentSchema.parse(data);

  // Simple HTML stripping (plain text only comments)
  const sanitizedBody = validated.body.replace(/<[^>]*>/g, '').trim();
  if (!sanitizedBody) throw new Error("Comment cannot be empty");

  const result = await prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        trackingId: validated.trackingId,
        authorUserId: user.id,
        body: sanitizedBody,
      },
      include: {
        tracking: { select: { assetId: true } },
      },
    });

    // Update latestCommentPreview on the tracking row
    const preview =
      sanitizedBody.length > 120
        ? sanitizedBody.slice(0, 120) + "..."
        : sanitizedBody;

    await tx.assetCompanyTracking.update({
      where: { id: validated.trackingId },
      data: { latestCommentPreview: preview },
    });

    // Create activity log
    await tx.activityLog.create({
      data: {
        entityType: "Comment",
        entityId: comment.id,
        action: "CREATED",
        metadata: {
          trackingId: validated.trackingId,
          preview,
        },
        userId: user.id,
      },
    });

    return comment;
  });

  revalidatePath(`/assets/${result.tracking.assetId}`);
  return result;
}

export async function updateComment(id: string, body: string) {
  const user = await requireUser();
  const validated = updateCommentSchema.parse({ body });

  const comment = await prisma.comment.findUniqueOrThrow({
    where: { id },
    include: { tracking: { select: { assetId: true } } },
  });

  // Only the author or an admin can update
  if (comment.authorUserId !== user.id && user.role !== "ADMIN") {
    throw new Error("Forbidden: you can only edit your own comments");
  }

  // Simple HTML stripping (plain text only comments)
  const sanitizedBody = validated.body.replace(/<[^>]*>/g, '').trim();
  if (!sanitizedBody) throw new Error("Comment cannot be empty");

  const updated = await prisma.comment.update({
    where: { id },
    data: { body: sanitizedBody },
  });

  revalidatePath(`/assets/${comment.tracking.assetId}`);
  return updated;
}

export async function deleteComment(id: string) {
  const user = await requireUser();

  const comment = await prisma.comment.findUniqueOrThrow({
    where: { id },
    include: { tracking: { select: { id: true, assetId: true } } },
  });

  // Only the author or an admin can delete
  if (comment.authorUserId !== user.id && user.role !== "ADMIN") {
    throw new Error("Forbidden: you can only delete your own comments");
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.delete({ where: { id } });

    // Refresh the latestCommentPreview with the next most recent comment
    const latestComment = await tx.comment.findFirst({
      where: { trackingId: comment.tracking.id },
      orderBy: { createdAt: "desc" },
    });

    await tx.assetCompanyTracking.update({
      where: { id: comment.tracking.id },
      data: {
        latestCommentPreview: latestComment
          ? latestComment.body.length > 120
            ? latestComment.body.slice(0, 120) + "..."
            : latestComment.body
          : null,
      },
    });
  });

  revalidatePath(`/assets/${comment.tracking.assetId}`);
}
