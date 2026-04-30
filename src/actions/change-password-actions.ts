"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/permissions";

/** Minimum password length we accept on the change-password form. We're
 *  not enforcing complexity here on purpose — the bigger risk is users
 *  picking a too-short string and being stuck typing it on a phone, not
 *  password complexity. 10 chars matches what NIST SP 800-63B suggests. */
const MIN_LENGTH = 10;

export interface ChangeMyPasswordResult {
  ok: boolean;
  error?: string;
}

/**
 * Change the signed-in user's password to one they pick themselves.
 * Used by the /portal/change-password page after the middleware gate
 * funnels first-login users there.
 *
 * Requires the current password as a defence against session-jacking —
 * a stolen cookie alone shouldn't be enough to swap the user's
 * credentials out from under them.
 */
export async function changeMyPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ChangeMyPasswordResult> {
  const sessionUser = await requireUser();

  const newPassword = input.newPassword?.trim();
  if (!newPassword || newPassword.length < MIN_LENGTH) {
    return { ok: false, error: `New password must be at least ${MIN_LENGTH} characters.` };
  }
  if (!input.currentPassword) {
    return { ok: false, error: "Enter your current password to confirm the change." };
  }

  // Re-fetch the actual hash from DB — never trust the session blob for
  // anything that touches credentials. requireUser() returns the JWT
  // session shape, which doesn't contain the hash.
  const dbUser = await prisma.user.findUnique({
    where: { id: (sessionUser as any).id as string },
    select: { id: true, passwordHash: true, isActive: true, email: true },
  });
  if (!dbUser || !dbUser.isActive) {
    return { ok: false, error: "Account not found or inactive." };
  }

  const valid = await bcrypt.compare(input.currentPassword, dbUser.passwordHash);
  if (!valid) {
    return { ok: false, error: "Current password is incorrect." };
  }

  if (input.currentPassword === newPassword) {
    return { ok: false, error: "New password must be different from your current password." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: dbUser.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
    },
  });

  try {
    await prisma.activityLog.create({
      data: {
        entityType: "User",
        entityId: dbUser.id,
        action: "PASSWORD_CHANGED_BY_USER",
        metadata: { email: dbUser.email },
        userId: dbUser.id,
      },
    });
  } catch {}

  return { ok: true };
}
