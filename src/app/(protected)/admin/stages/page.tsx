import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { StagesAdmin } from "@/components/admin/stages-admin";

export default async function AdminStagesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/");

  const stages = await prisma.pipelineStage.findMany({
    orderBy: { sequence: "asc" },
  });

  return <StagesAdmin stages={stages} />;
}
