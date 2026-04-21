import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { InvitesAdmin } from "@/components/admin/invites-admin";

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

  return (
    <InvitesAdmin
      invites={invites}
      investorUsers={investorUsers}
      companies={companies}
      assets={assets}
    />
  );
}
