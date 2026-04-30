"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { renderEmail, renderCredentialsTable, renderCta } from "@/lib/email-template";
import { getAppUrl } from "@/lib/app-url";

/**
 * Self-serve password reset.
 *
 * Flow: investor enters their email → if a user exists for that email
 * (case-insensitive trim), we generate a fresh 12-char random password,
 * bcrypt-hash it, persist it, and email the plaintext copy. Same model
 * as the admin-side `resetUserPassword` so the UX matches what an admin
 * already sees when issuing a reset on someone's behalf.
 *
 * Security notes:
 *  - We always return `{ ok: true }` regardless of whether the email
 *    exists. That avoids leaking which emails are registered.
 *  - We log every request to ActivityLog (success or no-op) so abuse is
 *    auditable. No global rate-limit yet — a follow-up should add an
 *    upstash limit per email + IP (~3 / 15 min) to mitigate abuse-via-
 *    overwrite (the legitimate user's password gets rotated even when
 *    they didn't ask).
 *  - Plaintext-password emails are technically less secure than a
 *    "click this reset link" flow, but Noah specifically requested
 *    parity with the admin flow already shipped.
 */
export async function requestPasswordReset(
  rawEmail: string
): Promise<{ ok: true }> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    // Treat invalid input the same as a no-op so the response is uniform.
    return { ok: true };
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (!user) {
    // Don't reveal that this email isn't registered. ActivityLog rows
    // require a userId by schema, so we can't persist a "no-user"
    // attempt directly — log to the server console instead. A follow-up
    // can introduce a separate AuthAuditEvent table if we need queryable
    // unknown-email audit.
    console.info(`[requestPasswordReset] no user for email "${email}"`);
    return { ok: true };
  }

  if (!user.isActive) {
    // Same uniform response — don't tell attackers an account is disabled.
    try {
      await prisma.activityLog.create({
        data: {
          entityType: "User",
          entityId: user.id,
          action: "PASSWORD_RESET_REQUESTED_INACTIVE",
          metadata: { email: user.email },
          userId: user.id,
        },
      });
    } catch {}
    return { ok: true };
  }

  // Same character set + length as the admin reset flow — keeps emails
  // visually consistent and avoids ambiguous chars (0/O, 1/l, etc.).
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const newPassword = Array.from({ length: 12 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("");

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  try {
    await sendEmail({
      to: user.email,
      subject: "Your password has been reset — DILS Investment Portal",
      html: renderEmail({
        heading: "Password reset requested",
        bodyHtml: `
          <p style="color: #101820; line-height: 1.6; font-size: 14px; margin: 0 0 12px 0;">
            We received a request to reset the password for your DILS Investment Portal account.
            Use the new credentials below to sign in.
          </p>
          ${renderCredentialsTable([
            { label: "Email", value: user.email, mono: true },
            { label: "Password", value: newPassword, mono: true },
          ])}
          ${renderCta("Sign in", `${getAppUrl()}/login`)}
          <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0; border-top: 1px solid #E6E8EB; padding-top: 20px;">
            If you didn't request this reset, contact the deal team immediately — your previous password
            has been invalidated.
          </p>
        `,
      }),
    });
  } catch (e) {
    console.error("[requestPasswordReset] email failed:", e);
    // Don't surface — the password rotation already succeeded server-side.
  }

  try {
    await prisma.activityLog.create({
      data: {
        entityType: "User",
        entityId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        metadata: { email: user.email, source: "self-serve" },
        userId: user.id,
      },
    });
  } catch {}

  return { ok: true };
}
