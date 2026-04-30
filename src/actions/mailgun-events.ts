"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";
import { actorTag } from "@/lib/email";

const MAILGUN_API_BASE =
  process.env.MAILGUN_API_BASE || "https://api.eu.mailgun.net/v3";
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;

export interface MailgunEvent {
  id: string;
  timestamp: number;
  event: string;
  recipient: string;
  subject: string | null;
  /** Top-level reason or smtp message — present on failed / rejected */
  reason: string | null;
  /** Mailgun's deliveryStatus.code (smtp 5xx etc) when available */
  smtpCode: number | null;
  /** Severity bucket so the table can colour-code without re-deriving */
  status: "delivered" | "accepted" | "failed" | "rejected" | "complained" | "opened" | "clicked" | "stored" | "other";
  /** Original message-id (with angle brackets stripped) for correlation */
  messageId: string | null;
  /** Tags attached at send time (we tag by entity type / id where possible) */
  tags: string[];
}

export interface MailgunEventsResult {
  ok: boolean;
  events: MailgunEvent[];
  /** Set when the API call itself blew up — UI surfaces this so the admin
   *  can tell "no events" from "couldn't reach Mailgun". */
  error?: string;
  /** Always present so the UI knows the credential setup before rendering. */
  configured: boolean;
}

function classify(event: string): MailgunEvent["status"] {
  switch (event) {
    case "delivered":
      return "delivered";
    case "accepted":
      return "accepted";
    case "failed":
      return "failed";
    case "rejected":
      return "rejected";
    case "complained":
      return "complained";
    case "opened":
      return "opened";
    case "clicked":
      return "clicked";
    case "stored":
      return "stored";
    default:
      return "other";
  }
}

/**
 * Fetch recent Mailgun events for the **current admin** — i.e. only emails
 * that the logged-in admin caused to be sent.
 *
 * Scoping: every send tags the message with `actor-<userId>` (see
 * `sendEmail` in `lib/email.ts`). This action filters Mailgun's events
 * API by that tag so each admin sees their own activity, not the entire
 * domain pipeline. Emails sent before this scoping was wired up — and
 * system / cron emails with no actor — won't appear in any admin's view.
 *
 * Failures (network, auth, rate limit) come back as `{ ok: false, error }`.
 */
export async function getRecentMailgunEvents(opts?: {
  limit?: number;
  recipient?: string;
}): Promise<MailgunEventsResult> {
  await requireRole("ADMIN");

  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    return { ok: false, events: [], configured: false, error: "Mailgun not configured (MAILGUN_API_KEY / MAILGUN_DOMAIN missing in env)." };
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: unknown } | undefined)?.id;
  if (typeof userId !== "string" || userId.length === 0) {
    // requireRole already guarantees a session, but if the id is missing
    // we'd otherwise leak the domain-wide feed — fail closed.
    return { ok: true, events: [], configured: true };
  }

  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 300);
  const params = new URLSearchParams({ limit: String(limit) });
  params.set("tags", actorTag(userId));
  if (opts?.recipient) params.set("recipient", opts.recipient);

  const auth = Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64");

  let res: Response;
  try {
    res = await fetch(`${MAILGUN_API_BASE}/${MAILGUN_DOMAIN}/events?${params}`, {
      headers: { Authorization: `Basic ${auth}` },
      // Mailgun events API; let the response be fresh on every admin click.
      cache: "no-store",
    });
  } catch (e: any) {
    return {
      ok: false,
      events: [],
      configured: true,
      error: `Network error reaching Mailgun: ${e?.message ?? String(e)}`,
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      events: [],
      configured: true,
      error: `Mailgun returned ${res.status}: ${text.slice(0, 240) || res.statusText}`,
    };
  }

  let json: any;
  try {
    json = await res.json();
  } catch (e: any) {
    return { ok: false, events: [], configured: true, error: "Mailgun response wasn't valid JSON." };
  }

  const items: any[] = Array.isArray(json?.items) ? json.items : [];
  const events: MailgunEvent[] = items.map((it) => {
    // Best-effort plucking — Mailgun's payload shape varies per event type.
    const eventName = String(it.event ?? "other");
    const recipient =
      it.recipient ??
      it["recipient-domain"] ??
      it.envelope?.targets ??
      "—";
    const subject =
      it.message?.headers?.subject ??
      it["user-variables"]?.subject ??
      null;
    const reason =
      it["delivery-status"]?.message ??
      it.reason ??
      it.severity ??
      null;
    const smtpCode = (() => {
      const c = it["delivery-status"]?.code;
      return typeof c === "number" ? c : null;
    })();
    const messageId = (() => {
      const raw = it.message?.headers?.["message-id"] ?? it["message-id"] ?? null;
      return raw ? String(raw).replace(/^<|>$/g, "") : null;
    })();
    const tagsRaw = it.tags ?? it["user-variables"]?.tags ?? [];
    const tags = Array.isArray(tagsRaw) ? tagsRaw.map(String) : [];

    return {
      id: String(it.id ?? `${it.timestamp}-${recipient}-${eventName}`),
      timestamp: Number(it.timestamp ?? 0),
      event: eventName,
      recipient: String(recipient),
      subject: subject ? String(subject) : null,
      reason: reason ? String(reason) : null,
      smtpCode,
      status: classify(eventName),
      messageId,
      tags,
    };
  });

  return { ok: true, events, configured: true };
}
