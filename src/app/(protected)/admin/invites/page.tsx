import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { InvitesAdmin, type InviteEvents } from "@/components/admin/invites-admin";

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

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, contactEmail: true },
  });

  const assets = await prisma.asset.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

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
    />
  );
}
