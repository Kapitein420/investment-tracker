"use server";

import { prisma } from "@/lib/db";
import { hashUnusablePassword } from "@/lib/security";
import { issuePasswordSetToken } from "@/lib/password-set-token";
import { sendEmail } from "@/lib/email";
import { renderEmail, renderCta } from "@/lib/email-template";
import { getAppUrl } from "@/lib/app-url";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ensureUserCompanyMembership } from "@/lib/user-companies";
import { redactEmail, redactIp } from "@/lib/log-redact";
import { unsubscribeUrl } from "@/lib/unsubscribe";

/**
 * Self-serve password reset.
 *
 * Flow: investor enters their email → if a user exists for that email
 * (case-insensitive trim), we mint a one-time set-password token and email
 * the link. Same model as the admin-side `resetUserPassword`.
 *
 * Security notes:
 *  - We always return `{ ok: true }` regardless of whether the email
 *    exists. That avoids leaking which emails are registered.
 *  - The live password is NOT rotated on request (compliance gap G9). It
 *    used to be, which meant anyone who knew an address could invalidate
 *    that person's password at will; now nothing changes until the link is
 *    redeemed, and redeeming it is what invalidates their other sessions.
 *  - We log every request to ActivityLog (success or no-op) so abuse is
 *    auditable, on top of the per-email / per-IP caps below.
 */
/** Email tone variants. Both issue the same one-time link; only the
 *  subject line + body copy + heading change. */
export type AccessRequestFlavor = "reset" | "welcome";

export async function requestPasswordReset(
  rawEmail: string,
  opts?: { flavor?: AccessRequestFlavor; restrictToInvestor?: boolean }
): Promise<{ ok: true }> {
  // Kill switch: setting INVITES_PAUSED=true on Vercel pauses every
  // self-serve set-password email without a redeploy. Used to halt
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

  // Rate limit per-email (2/hr) AND per-IP (6/hr). Either being hit
  // returns the standard ok-true response so the attacker can't tell
  // they were blocked. Legit users retry the next hour. Tightened from
  // 3/10 back when this endpoint rotated a LIVE password on every call;
  // kept at that level as mailbox-flood protection.
  //
  // AUTH_LIMIT_BOOST triples both caps for launch windows (6 email /
  // 18 IP per hour). See src/lib/auth.ts and the /launch-mode skill.
  const boost = process.env.AUTH_LIMIT_BOOST === "true";
  const ip = await getClientIp();
  const [emailLimit, ipLimit] = await Promise.all([
    checkRateLimit(`pwreset:email:${email}`, boost ? 6 : 2, 60 * 60),
    checkRateLimit(`pwreset:ip:${ip}`, boost ? 18 : 6, 60 * 60),
  ]);
  if (!emailLimit.allowed || !ipLimit.allowed) {
    console.warn(
      `[requestPasswordReset] rate-limited email=${redactEmail(email)} ip=${redactIp(ip)} ` +
        `emailRemaining=${emailLimit.remaining} ipRemaining=${ipLimit.remaining}`
    );
    return { ok: true };
  }

  let user = await prisma.user.findFirst({
    where: opts?.restrictToInvestor
      ? { email: { equals: email, mode: "insensitive" }, role: "INVESTOR" }
      : { email: { equals: email, mode: "insensitive" } },
  });

  // JIT-bootstrap from CompanyContact. The "Add tracking / Bulk Import"
  // flow seeds CompanyContact rows without creating User accounts (intent:
  // track relationships without blasting invites). When such a contact
  // later hits /request-access from the broker's marketing email, the
  // User lookup above returns null and the function silently no-ops —
  // they never get their credentials. Promote them now so the welcome
  // flow works end-to-end without requiring the admin to click "Send
  // invite" first.
  //
  // Only fires for the public /request-access entry (welcome flavor +
  // restrictToInvestor). The /forgot-password path is unchanged.
  if (!user && opts?.restrictToInvestor && flavor === "welcome") {
    // Don't shadow an existing admin/editor/viewer that shares this email.
    const anyExistingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (!anyExistingUser) {
      const contacts = await prisma.companyContact.findMany({
        where: { email: { equals: email, mode: "insensitive" } },
        include: {
          company: { select: { id: true, name: true, contactName: true } },
        },
      });
      if (contacts.length > 0) {
        const primary = contacts[0];
        user = await prisma.user.create({
          data: {
            email: email,
            name:
              primary.name ||
              primary.company.contactName ||
              primary.company.name,
            passwordHash: await hashUnusablePassword(),
            role: "INVESTOR",
            companyId: primary.companyId,
            // passwordChangedAt left NULL — matches sendInvestorInvite so
            // the first-login force-change gate (when enabled) still works.
          },
        });
        // Mirror sendInvestorInvite: 1 User, N memberships if the same
        // email is tracked across multiple companies.
        for (const c of contacts) {
          await ensureUserCompanyMembership(user.id, c.companyId);
        }
        console.info(
          `[requestPasswordReset] JIT-created User from CompanyContact email="${redactEmail(email)}" (${contacts.length} membership${contacts.length === 1 ? "" : "s"})`
        );
      }
    }
  }

  if (!user) {
    // Don't reveal that this email isn't registered. ActivityLog rows
    // require a userId by schema, so we can't persist a "no-user"
    // attempt directly — log to the server console instead. A follow-up
    // can introduce a separate AuthAuditEvent table if we need queryable
    // unknown-email audit.
    console.info(`[requestPasswordReset] no user for email "${redactEmail(email)}" (flavor=${flavor})`);
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

  // One-time link instead of a password in the email body. The account's
  // current password keeps working until the link is redeemed.
  const link = await issuePasswordSetToken(user.id, "RESET");

  // Email content varies by flavor so a "first-time access" request from
  // /request-access doesn't sound like a "you forgot your password" notice.
  // Both branches issue the same link — only the copy differs.
  const emailContent =
    flavor === "welcome"
      ? {
          subject: "Your DILS Investor Portal login",
          heading: "Your DILS Investor Portal login is ready",
          intro: `
            <p style="color: #101820; line-height: 1.6; font-size: 14px; margin: 0 0 12px 0;">
              Following up on the access request from the DILS Investor Portal — choose a password
              below and you're in. You'll then see the live deal opportunities your DILS contact
              has shared with you.
            </p>
          `,
          ctaLabel: "Set your password",
          footer: `
            <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0; border-top: 1px solid #E6E8EB; padding-top: 20px;">
              If you didn't request access, you can safely ignore this email — no action is
              needed and your account stays inactive. For questions, reply to your DILS broker
              directly.
            </p>
          `,
        }
      : {
          subject: "Set a new password — DILS Investor Portal",
          heading: "Password reset requested",
          intro: `
            <p style="color: #101820; line-height: 1.6; font-size: 14px; margin: 0 0 12px 0;">
              We received a request to reset the password for your DILS Investor Portal account.
              Use the button below to choose a new one.
            </p>
          `,
          ctaLabel: "Set a new password",
          footer: `
            <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0; border-top: 1px solid #E6E8EB; padding-top: 20px;">
              If you didn't request this reset, you can ignore this email — your current password
              keeps working and nothing changes until the link above is used.
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
          ${renderCta(emailContent.ctaLabel, link.url)}
          <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0 0 24px 0;">
            This link works once and expires in ${link.ttlLabel}. Signing in afterwards is at
            <a href="${getAppUrl()}/login" style="color: #101820;">${getAppUrl()}/login</a>.
          </p>
          ${emailContent.footer}
        `,
        unsubscribeUrl: unsubscribeUrl(user.email),
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
