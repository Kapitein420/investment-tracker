/**
 * Who hears about deal events (a viewing request, a submitted offer).
 *
 * The tracking owner when there is one. Otherwise the address(es) in
 * DEAL_TEAM_FALLBACK_EMAIL (comma-separated). We deliberately never fall back
 * to "every ADMIN user": those mails carry the investor's contact details and
 * bid amount, and admin accounts include people who should not see them.
 * With no owner and no fallback configured nothing is sent and a warning is
 * logged, so a misconfiguration is loud in the logs rather than a leak.
 */
export function dealTeamRecipients(
  ownerEmail: string | null | undefined,
  event: string
): string[] {
  if (ownerEmail) return [ownerEmail];

  const fallback = (process.env.DEAL_TEAM_FALLBACK_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (fallback.length > 0) return fallback;

  console.warn(
    `[deal-team] no tracking owner and DEAL_TEAM_FALLBACK_EMAIL is unset — "${event}" notification not sent`
  );
  return [];
}
