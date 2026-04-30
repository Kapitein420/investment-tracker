import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { ChangePasswordClient } from "@/components/change-password-client";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <ChangePasswordClient userEmail={user.email ?? ""} />;
}
