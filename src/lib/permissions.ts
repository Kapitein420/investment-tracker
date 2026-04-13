import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireRole(minimumRole: Role) {
  const user = await requireUser();
  const hierarchy: Record<Role, number> = {
    VIEWER: 0,
    EDITOR: 1,
    ADMIN: 2,
  };
  if (hierarchy[user.role] < hierarchy[minimumRole]) {
    throw new Error("Forbidden");
  }
  return user;
}

export function canEdit(role: Role) {
  return role === "ADMIN" || role === "EDITOR";
}

export function isAdmin(role: Role) {
  return role === "ADMIN";
}
