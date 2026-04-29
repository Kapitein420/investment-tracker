import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { DealCard } from "@/components/investor/deal-card";
import { Briefcase } from "lucide-react";
import { getUserCompanyIds } from "@/lib/user-companies";

export default async function InvestorPortalPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "INVESTOR" && user.role !== "ADMIN") redirect("/");

  // Sprint B PR-2: pull every Company this investor belongs to (not just the
  // legacy User.companyId scalar). Pre-backfill, getUserCompanyIds falls back
  // to user.companyId so existing single-company investors are unaffected.
  // Post-backfill, the same investor seeing two deals across two firms gets
  // both in one logged-in session.
  const companyIds = await getUserCompanyIds(user.id);

  if (companyIds.length === 0) {
    // ADMIN without any membership → admin dashboard. INVESTOR with no
    // memberships → login (their account is broken; admin should re-invite).
    redirect(user.role === "ADMIN" ? "/" : "/login");
  }

  // Performance / failure mode: under burst load (100 concurrent landings)
  // we saw ~9% 500s on this page. Wrap the queries in a try/catch with a
  // diagnostic so the next load test surfaces the actual underlying error
  // (Prisma timeout, pgbouncer queue full, etc.) instead of a bare 500.
  let company;
  let trackings;
  try {
    [company, trackings] = await Promise.all([
      prisma.company.findFirst({
        where: { id: { in: companyIds } },
        orderBy: { createdAt: "asc" }, // Use the oldest membership as the "header" company name
      }),
      prisma.assetCompanyTracking.findMany({
        where: {
          companyId: { in: companyIds },
          lifecycleStatus: { in: ["ACTIVE", "COMPLETED", "ON_HOLD"] },
        },
        include: {
          asset: true,
          company: true, // Show which firm the deal is under when investor has multiple
          stageStatuses: {
            include: { stage: true },
            orderBy: { stage: { sequence: "asc" } },
          },
          documents: {
            include: { stage: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
  } catch (e: any) {
    console.error("[portal] failed to load investor dashboard:", {
      userId: user.id,
      companyIds,
      error: e?.message,
      code: e?.code,
    });
    throw e;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="dils-accent inline-block font-heading text-3xl font-bold tracking-tight text-dils-black">
          Welcome, {company?.name ?? user.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-prose">
          Your active investment opportunities
        </p>
      </div>

      {trackings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-dils-200 px-6 py-20 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground/60" strokeWidth={1.75} />
          <p className="mt-3 text-sm font-medium text-foreground">No active deals yet</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Invitations from the deal team will show up here. If you&apos;re expecting one, check your inbox or reach out to your DILS contact.
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
