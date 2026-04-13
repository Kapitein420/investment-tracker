import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { DealCard } from "@/components/investor/deal-card";
import { Building, Briefcase } from "lucide-react";

export default async function InvestorPortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "INVESTOR" && user.role !== "ADMIN") redirect("/");
  if (!user.companyId && user.role === "INVESTOR") redirect("/login");

  const companyId = user.companyId!;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: {
      companyId,
      lifecycleStatus: { in: ["ACTIVE", "COMPLETED", "ON_HOLD"] },
    },
    include: {
      asset: true,
      stageStatuses: {
        include: { stage: true },
        orderBy: { stage: { sequence: "asc" } },
      },
      documents: {
        include: { stage: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {company?.name ?? user.name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your active investment opportunities
        </p>
      </div>

      {trackings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20">
          <Briefcase className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">No active deals at the moment</p>
          <p className="text-xs text-muted-foreground/60">
            You&apos;ll see your investment opportunities here once invited
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {trackings.map((tracking) => (
            <DealCard key={tracking.id} tracking={tracking} />
          ))}
        </div>
      )}
    </div>
  );
}
