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
    INVESTOR: 0,
    VIEWER: 1,
    EDITOR: 2,
    ADMIN: 3,
  };
  if (hierarchy[user.role] < hierarchy[minimumRole]) {
    throw new Error("Forbidden");
  }
  return user;
}

export async function requireInvestor() {
  const user = await requireUser();
  if (user.role !== "INVESTOR") throw new Error("Forbidden: investor access only");
  return user;
}

export function canEdit(role: Role) {
  return role === "ADMIN" || role === "EDITOR";
}

export function isAdmin(role: Role) {
  return role === "ADMIN";
}

export function isInvestor(role: Role) {
  return role === "INVESTOR";
}
