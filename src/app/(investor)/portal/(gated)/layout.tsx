import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { hasAcceptedCurrentTerms } from "@/lib/terms";

// Terms-of-use gate (G13). A route-group layout rather than a path check in
// src/proxy.ts: every page under /portal EXCEPT /portal/terms lives in this
// (gated) group, so the group boundary alone keeps the terms page itself
// reachable without a pathname check, and the Prisma query below only ever
// runs for INVESTOR sessions (one query per request) rather than on every
// edge-middleware pass. ADMINs previewing the portal are never gated.
export default async function GatedPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user?.role === "INVESTOR" && !(await hasAcceptedCurrentTerms(user.id))) {
    redirect("/portal/terms");
  }
  return <>{children}</>;
}
