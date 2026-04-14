import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const assets = await prisma.asset.findMany({
    include: {
      _count: { select: { trackings: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return <DashboardContent assets={assets} userRole={user.role} />;
}
