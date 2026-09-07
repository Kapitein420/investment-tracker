import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { hasTrackingConsent } from "@/lib/email-tracking";
import { EmailPreferencesClient } from "@/components/email-preferences-client";

export default async function EmailPreferencesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const consented = await hasTrackingConsent(user.email);
  return <EmailPreferencesClient userEmail={user.email} initialConsent={consented} />;
}
