"use server";

import { redirect } from "next/navigation";
import { verifyUnsubscribeToken, suppressEmail } from "@/lib/unsubscribe";

/**
 * Confirms an unsubscribe click from /unsubscribe. Re-verifies the token
 * server-side (the page already checked it, but the action is a separate
 * request — never trust a hidden form field alone) before writing the
 * suppression row, then redirects back with `done=1` so the page renders
 * the confirmation copy instead of the form again.
 */
export async function confirmUnsubscribe(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const token = String(formData.get("token") ?? "");

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    redirect("/unsubscribe");
  }

  await suppressEmail(email, "UNSUBSCRIBED", "link");

  redirect(`/unsubscribe?e=${encodeURIComponent(email)}&t=${token}&done=1`);
}
