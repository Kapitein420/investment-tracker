import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MAILGUN_API_BASE =
  process.env.MAILGUN_API_BASE || "https://api.eu.mailgun.net/v3";
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_FROM =
  process.env.MAILGUN_FROM ||
  "Investment Tracker <investments.netherlands@mg.dils.com>";

export interface SendEmailResult {
  messageId: string | null; // Mailgun's "id" — present when delivered to MX, used to correlate webhooks
}

// Mailgun tag values must be ASCII [\w.-]+. Prisma cuids are already
// alphanumeric, but coerce defensively in case a future caller passes
// an email or other value.
function actorTag(userId: string): string {
  const safe = userId.replace(/[^A-Za-z0-9_.-]/g, "-");
  return `actor-${safe}`;
}

export { actorTag };

export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
  actor,
}: {
  to: string;
  subject: string;
  html: string;
  /** Override the global MAILGUN_FROM. Used by the access/credential
   *  flow so the credential email arrives from the broker's domain
   *  instead of the mg.dils.com transactional subdomain — preserves
   *  the trust chain after a marketing email from broker@dils.com.
   *  Caller must ensure DKIM/SPF on the chosen domain. */
  from?: string;
  /** Optional Reply-To. Useful when the From is a broker mailbox but
   *  the team wants replies to land on a shared inbox. */
  replyTo?: string;
  /** Who initiated this send. Tagged on the Mailgun message so the
   *  email-log can scope events to "emails I caused".
   *  - undefined (default) → auto-pick from the current request session
   *  - a userId string → tag with that explicit actor
   *  - null → skip tagging (system / cron / unauthenticated callers) */
  actor?: string | null;
}): Promise<SendEmailResult> {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    // Silent skip in dev; loud failure in production. Previously this branch
    // returned silently in every environment, which let an admin think they'd
    // sent an invite when no email actually went out.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Email service not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN missing in env)."
      );
    }
    console.log(
      `[Email skipped - Mailgun not configured] To: ${to}, Subject: ${subject}`,
    );
    return { messageId: null };
  }

  const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");
  const body = new URLSearchParams({
    from: from ?? MAILGUN_FROM,
    to,
    subject,
    html,
  });
  if (replyTo) body.set("h:Reply-To", replyTo);

  // Resolve the actor: explicit override beats session pickup, null skips.
  let resolvedActor: string | null = null;
  if (actor === undefined) {
    try {
      const session = await getServerSession(authOptions);
      const id = (session?.user as { id?: unknown } | undefined)?.id;
      if (typeof id === "string" && id.length > 0) resolvedActor = id;
    } catch {
      // No request scope (cron / webhook / build-time render) — just don't tag.
    }
  } else if (actor) {
    resolvedActor = actor;
  }
  if (resolvedActor) body.append("o:tag", actorTag(resolvedActor));

  const res = await fetch(
    `${MAILGUN_API_BASE}/${MAILGUN_DOMAIN}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Mailgun email failed (${res.status}): ${errorText}`);
  }

  // Mailgun returns { id: "<...@<domain>>", message: "Queued. Thank you." }.
  // Strip the angle brackets so we can match it against webhook events
  // later, where Mailgun normalises the same id without them.
  let messageId: string | null = null;
  try {
    const json = (await res.json()) as { id?: string };
    if (json.id) messageId = json.id.replace(/^<|>$/g, "");
  } catch {
    // Non-fatal; we still return the queued state.
  }
  return { messageId };
}
