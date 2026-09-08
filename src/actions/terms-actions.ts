"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/permissions";
import { getClientIp, getClientUserAgent } from "@/lib/rate-limit";
import { recordTermsAcceptance, TERMS_VERSION } from "@/lib/terms";

/**
 * Investor click-accepts the current terms version from /portal/terms
 * (G13). Captures IP/user agent as acceptance evidence alongside the
 * version and timestamp, then sends the investor into the portal — the
 * (gated) layout re-checks and lets them through now that a row exists.
 */
export async function acceptTerms(formData: FormData): Promise<void> {
  const sessionUser = await requireUser();

  // The checkbox's `required` attribute only stops an unchecked submit in
  // the browser — a direct POST to this action bypasses it entirely. Same
  // re-check server-side as signHtmlNda's intent-confirmed checkbox
  // (html-nda-actions.ts): the click-accept is the legal evidence, so it
  // has to be enforced where it can't be skipped.
  try {
    z.literal("on").parse(formData.get("accepted"));
  } catch {
    throw new Error("Please confirm you accept the terms before submitting.");
  }

  const ip = await getClientIp();
  const userAgent = await getClientUserAgent();

  await recordTermsAcceptance({ userId: (sessionUser as any).id as string, ip, userAgent });

  await prisma.activityLog.create({
    data: {
      entityType: "User",
      entityId: (sessionUser as any).id as string,
      action: "TERMS_ACCEPTED",
      metadata: { termsVersion: TERMS_VERSION, ip, userAgent },
      userId: (sessionUser as any).id as string,
    },
  });

  redirect("/portal");
}
