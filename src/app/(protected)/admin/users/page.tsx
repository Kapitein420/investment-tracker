import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { UsersAdmin } from "@/components/admin/users-admin";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/");

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "EDITOR", "VIEWER"] } },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return <UsersAdmin users={users} />;
}
