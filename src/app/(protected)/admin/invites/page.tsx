import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { InvitesAdmin, type InviteEvents } from "@/components/admin/invites-admin";
import { normalise } from "@/lib/email-tracking";
import { TERMS_VERSION } from "@/lib/terms";

export default async function AdminInvitesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/");

  const invites = await prisma.investorInvite.findMany({
    include: {
      company: { select: { id: true, name: true } },
      asset: { select: { id: true, title: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Pull the INVESTOR User records linked to any of the invited investors.
  // Keyed by `${companyId}|${email.toLowerCase()}` on the client so the
  // Investors page can show account status alongside invite status.
  const investorUsers = await prisma.user.findMany({
    where: { role: "INVESTOR" },
    select: {
      id: true,
      email: true,
      companyId: true,
      isActive: true,
      createdAt: true,
    },
  });

  // Terms-of-use acceptance (G13) — one query for the whole page rather
  // than N+1 per investor row. investorUsers is already the full INVESTOR
  // list above; this just narrows it to who has accepted the current
  // version (see components/admin/invites-admin.tsx "Terms" indicator).
  const investorUserIds = investorUsers.map((u) => u.id);
  const termsAcceptances =
    investorUserIds.length === 0
      ? []
      : await prisma.termsAcceptance.findMany({
          where: { userId: { in: investorUserIds }, termsVersion: TERMS_VERSION },
          select: { userId: true },
        });
  const termsAcceptedUserIds = termsAcceptances.map((t) => t.userId);

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, contactEmail: true },
  });

  const assets = await prisma.asset.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  // One shared email list feeds both per-recipient email-status lookups:
  // who opted out of commercial mail (EmailSuppression) and who turned
  // open/click tracking on (EmailTrackingConsent). Two queries total
  // regardless of invite count — no N+1 per row. Both tables store the
  // address normalised, so key off `normalise` going in and coming out.
  const inviteEmails = Array.from(new Set(invites.map((i) => normalise(i.email))));
  const [suppressions, trackingConsents] =
    inviteEmails.length === 0
      ? [[] as { email: string }[], [] as { email: string }[]]
      : await Promise.all([
          prisma.emailSuppression.findMany({
            where: { email: { in: inviteEmails } },
            select: { email: true },
          }),
          prisma.emailTrackingConsent.findMany({
            where: { email: { in: inviteEmails }, revokedAt: null },
            select: { email: true },
          }),
        ]);
  const suppressedEmails = suppressions.map((s) => s.email);
  const trackingConsentEmails = trackingConsents.map((c) => c.email);

  // Fold every invite-related ActivityLog event into a per-invite summary:
  //   - did the email send succeed?
  //   - did Mailgun deliver / open / bounce / complain afterwards (webhook events)?
  //   - what was the most recent error message?
  // Keyed by inviteId so the client can render a status icon per chip.
  const inviteIds = invites.map((i) => i.id);
  const events =
    inviteIds.length === 0
      ? []
      : await prisma.activityLog.findMany({
          where: {
            entityType: "InvestorInvite",
            entityId: { in: inviteIds },
            action: {
              in: [
                "INVITE_SENT",
                "INVITE_CREATED_EMAIL_FAILED",
                "EMAIL_DELIVERED",
                "EMAIL_OPENED",
                "EMAIL_CLICKED",
                "EMAIL_FAILED",
                "EMAIL_COMPLAINED",
                "EMAIL_UNSUBSCRIBED",
                "EMAIL_TEMPORARY_FAILURE",
                "EMAIL_PERMANENT_FAILURE",
              ],
            },
          },
          select: { entityId: true, action: true, createdAt: true, metadata: true },
          orderBy: { createdAt: "asc" },
        });

  const inviteEvents: Record<string, InviteEvents> = {};
  for (const e of events) {
    const m = (e.metadata as { emailError?: string; reason?: string } | null) ?? {};
    const summary = inviteEvents[e.entityId] ?? {
      sent: false,
      sentAt: null,
      delivered: false,
      opened: false,
      bounced: false,
      latestError: null,
      latestEvent: null,
      latestEventAt: null,
    };
    if (e.action === "INVITE_SENT") {
      summary.sent = true;
      summary.sentAt = e.createdAt;
    } else if (e.action === "INVITE_CREATED_EMAIL_FAILED") {
      summary.sent = false;
      summary.latestError = m.emailError ?? "Send failed";
    } else if (e.action === "EMAIL_DELIVERED") {
      summary.delivered = true;
    } else if (e.action === "EMAIL_OPENED" || e.action === "EMAIL_CLICKED") {
      summary.opened = true;
    } else if (
      e.action === "EMAIL_FAILED" ||
      e.action === "EMAIL_PERMANENT_FAILURE" ||
      e.action === "EMAIL_TEMPORARY_FAILURE" ||
      e.action === "EMAIL_COMPLAINED"
    ) {
      summary.bounced = true;
      summary.latestError = m.reason ?? summary.latestError ?? "Bounced";
    }
    summary.latestEvent = e.action;
    summary.latestEventAt = e.createdAt;
    inviteEvents[e.entityId] = summary;
  }

  return (
    <InvitesAdmin
      invites={invites}
      investorUsers={investorUsers}
      companies={companies}
      assets={assets}
      inviteEvents={inviteEvents}
      suppressedEmails={suppressedEmails}
      trackingConsentEmails={trackingConsentEmails}
      termsAcceptedUserIds={termsAcceptedUserIds}
      termsVersion={TERMS_VERSION}
    />
  );
}
