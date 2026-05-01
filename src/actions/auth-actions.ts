"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { renderEmail, renderCredentialsTable, renderCta } from "@/lib/email-template";
import { getAppUrl } from "@/lib/app-url";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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
/** Email tone variants. Both rotate the password the same way; only the
 *  subject line + body copy + heading change. */
export type AccessRequestFlavor = "reset" | "welcome";

export async function requestPasswordReset(
  rawEmail: string,
  opts?: { flavor?: AccessRequestFlavor; restrictToInvestor?: boolean }
): Promise<{ ok: true }> {
  // Kill switch: setting INVITES_PAUSED=true on Vercel pauses every
  // self-serve credential rotation without a redeploy. Used to halt
  // mid-rollout if Mailgun reputation tanks or a wave goes sideways.
  if (process.env.INVITES_PAUSED === "true") {
    console.info("[requestPasswordReset] INVITES_PAUSED=true — silently no-op");
    return { ok: true };
  }

  const flavor: AccessRequestFlavor = opts?.flavor ?? "reset";
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    // Treat invalid input the same as a no-op so the response is uniform.
    return { ok: true };
  }

  // Rate limit per-email (3/hr) AND per-IP (10/hr). Either being hit
  // returns the standard ok-true response so the attacker can't tell
  // they were blocked. Legit users retry the next hour.
  //
  // AUTH_LIMIT_BOOST triples both caps for launch windows (9 email /
  // 30 IP per hour). See src/lib/auth.ts and the /launch-mode skill.
  const boost = process.env.AUTH_LIMIT_BOOST === "true";
  const ip = await getClientIp();
  const [emailLimit, ipLimit] = await Promise.all([
    checkRateLimit(`pwreset:email:${email}`, boost ? 9 : 3, 60 * 60),
    checkRateLimit(`pwreset:ip:${ip}`, boost ? 30 : 10, 60 * 60),
  ]);
  if (!emailLimit.allowed || !ipLimit.allowed) {
    console.warn(
      `[requestPasswordReset] rate-limited email=${email} ip=${ip} ` +
        `emailRemaining=${emailLimit.remaining} ipRemaining=${ipLimit.remaining}`
    );
    return { ok: true };
  }

  const user = await prisma.user.findFirst({
    where: opts?.restrictToInvestor
      ? { email: { equals: email, mode: "insensitive" }, role: "INVESTOR" }
      : { email: { equals: email, mode: "insensitive" } },
  });

  if (!user) {
    // Don't reveal that this email isn't registered. ActivityLog rows
    // require a userId by schema, so we can't persist a "no-user"
    // attempt directly — log to the server console instead. A follow-up
    // can introduce a separate AuthAuditEvent table if we need queryable
    // unknown-email audit.
    console.info(`[requestPasswordReset] no user for email "${email}" (flavor=${flavor})`);
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
          metadata: { email: user.email, flavor },
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
    data: { passwordHash, passwordChangedAt: null },
  });

  // Email content varies by flavor so a "first-time access" request from
  // /request-access doesn't sound like a "you forgot your password" notice.
  // Both branches rotate the password identically — only the copy differs.
  const emailContent =
    flavor === "welcome"
      ? {
          subject: "Your DILS Investor Portal login",
          heading: "Your DILS Investor Portal login is ready",
          intro: `
            <p style="color: #101820; line-height: 1.6; font-size: 14px; margin: 0 0 12px 0;">
              Following up on the access request from the DILS Investor Portal — your sign-in
              details are below. Sign in to see the live deal opportunities your DILS contact has
              shared with you.
            </p>
          `,
          ctaLabel: "Sign in to the portal",
          footer: `
            <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0; border-top: 1px solid #E6E8EB; padding-top: 20px;">
              If you didn't request access, you can safely ignore this email — no action is
              needed and your account stays inactive. For questions, reply to your DILS broker
              directly.
            </p>
          `,
        }
      : {
          subject: "Your password has been reset — DILS Investor Portal",
          heading: "Password reset requested",
          intro: `
            <p style="color: #101820; line-height: 1.6; font-size: 14px; margin: 0 0 12px 0;">
              We received a request to reset the password for your DILS Investor Portal account.
              Use the new credentials below to sign in.
            </p>
          `,
          ctaLabel: "Sign in",
          footer: `
            <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0; border-top: 1px solid #E6E8EB; padding-top: 20px;">
              If you didn't request this reset, contact the deal team immediately — your previous password
              has been invalidated.
            </p>
          `,
        };

  // Use a broker-style From for welcome emails when configured (closes
  // the cross-domain trust gap after a marketing email from
  // broker@dils.com — investor sees credentials arrive from the same
  // brand instead of mg.dils.com). Falls back to MAILGUN_FROM if the
  // override env var isn't set. Operator note: the chosen From domain
  // must be DKIM/SPF/DMARC-verified in Mailgun before this is safe.
  const accessFrom =
    flavor === "welcome"
      ? process.env.MAILGUN_FROM_ACCESS || process.env.MAILGUN_FROM
      : undefined;
  const replyTo = process.env.MAILGUN_REPLY_TO || undefined;

  try {
    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      from: accessFrom,
      replyTo,
      html: renderEmail({
        heading: emailContent.heading,
        bodyHtml: `
          ${emailContent.intro}
          ${renderCredentialsTable([
            { label: "Email", value: user.email, mono: true },
            { label: "Password", value: newPassword, mono: true },
          ])}
          ${renderCta(emailContent.ctaLabel, `${getAppUrl()}/login`)}
          ${emailContent.footer}
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
        action: flavor === "welcome" ? "ACCESS_REQUESTED" : "PASSWORD_RESET_REQUESTED",
        metadata: { email: user.email, source: "self-serve", flavor },
        userId: user.id,
      },
    });
  } catch {}

  return { ok: true };
}

/**
 * Convenience wrapper for the "broker sends a marketing email via
 * ActiveCampaign with a 'request access' link" flow.
 *
 * Behaves identically to `requestPasswordReset` (silent no-op if email
 * isn't pre-loaded), but locked to INVESTOR role so an attacker who
 * harvests an admin email from somewhere can't use the public access
 * page to rotate that admin's password. Uses welcome-tone email copy so
 * first-time recipients don't see a "your password was reset" notice
 * they never asked for.
 */
export async function requestAccessEmail(rawEmail: string) {
  return requestPasswordReset(rawEmail, { flavor: "welcome", restrictToInvestor: true });
}
