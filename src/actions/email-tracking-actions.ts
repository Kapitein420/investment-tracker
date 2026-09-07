"use server";

import { requireUser } from "@/lib/permissions";
import { getClientIp } from "@/lib/rate-limit";
import { hasTrackingConsent, grantTrackingConsent, revokeTrackingConsent } from "@/lib/email-tracking";

export interface TrackingConsentResult {
  ok: boolean;
  consented: boolean;
  error?: string;
}

/** Current consent state for the signed-in investor's own email. */
export async function getMyTrackingConsent(): Promise<TrackingConsentResult> {
  const user = await requireUser();
  return { ok: true, consented: await hasTrackingConsent(user.email) };
}

/**
 * Set the signed-in investor's own tracking consent from the portal
 * preferences page. Always acts on the session's own email — there's no
 * path here for setting consent on someone else's behalf.
 */
export async function setMyTrackingConsent(consented: boolean): Promise<TrackingConsentResult> {
  const user = await requireUser();

  if (consented) {
    const ip = await getClientIp();
    await grantTrackingConsent({ email: user.email, userId: user.id, ip });
  } else {
    await revokeTrackingConsent(user.email);
  }

  return { ok: true, consented };
}
