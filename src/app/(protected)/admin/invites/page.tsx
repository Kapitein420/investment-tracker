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

  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, contactEmail: true },
  });

  const assets = await prisma.asset.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return <InvitesAdmin invites={invites} companies={companies} assets={assets} />;
}
