import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { suppressEmail } from "@/lib/unsubscribe";
import { hasTrackingConsent } from "@/lib/email-tracking";

/**
 * Mailgun webhook endpoint.
 *
 * Configure in Mailgun: Sending → Webhooks → add events for
 *   delivered, opened, clicked, permanent_failure, temporary_failure,
 *   complained, unsubscribed
 * and point them at:
 *   https://<your-app>/api/mailgun/webhook
 *
 * unsubscribed/complained events add the recipient to EmailSuppression
 * straight away, before any correlation to an invite — the opt-out is
 * binding whether or not we can match the message.
 *
 * opened/clicked only arrive for recipients who granted tracking consent in
 * their portal preferences — sendEmail() sends o:tracking*=no otherwise, so
 * Mailgun doesn't fire these events at all for most recipients. The check
 * below is belt-and-braces for events queued before a revoke or a stray
 * domain-default send.
 *
 * Then add MAILGUN_WEBHOOK_SIGNING_KEY (the HTTP webhook signing key from
 * Mailgun's "Webhooks" page, NOT the API key) to the Vercel env.
 *
 * Each event becomes an ActivityLog row with action EMAIL_<EVENT>, keyed
 * by the originating InvestorInvite (looked up via the messageId we
 * stored when sending). The admin invites page reads these to show
 * delivery status.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Mailgun puts the signature outside event-data
  const signature = body?.signature;
  const eventData = body?.["event-data"];

  if (!signature || !eventData) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  // Verify signature: HMAC-SHA256(timestamp + token) with the signing key
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) {
    console.error("[mailgun webhook] MAILGUN_WEBHOOK_SIGNING_KEY missing");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }
  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(signature.timestamp + signature.token)
    .digest("hex");
  // Constant-time comparison so the verification can't be probed byte-by-byte
  // via response timing. timingSafeEqual requires equal-length buffers, so
  // guard the length (and the type) first.
  const provided =
    typeof signature.signature === "string" ? signature.signature : "";
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  // Reject events more than 5 minutes old to limit replay attacks. (A
  // captured event can still be replayed within this window — eliminating
  // that fully needs a persisted seen-token store; tracked as a follow-up.)
  const ts = parseInt(signature.timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return NextResponse.json({ error: "Stale event" }, { status: 401 });
  }

  // Mailgun event:
  //   event: "delivered" | "opened" | "clicked" | "failed" | "complained" | "unsubscribed"
  //   message.headers.message-id: same id we stored on send
  //   recipient: "noah@example.com"
  //   severity (on failed): "permanent" | "temporary"
  const event: string = eventData.event ?? "unknown";
  const messageId: string | undefined =
    eventData.message?.headers?.["message-id"];
  const recipient: string | undefined = eventData.recipient;
  const reason: string | undefined =
    eventData["delivery-status"]?.description ?? eventData.reason;

  // Suppress future commercial sends immediately — independent of whether
  // this event can be correlated to a tracked InvestorInvite below. The
  // opt-out/complaint is binding regardless of our own message bookkeeping.
  if (recipient && (event === "unsubscribed" || event === "complained")) {
    await suppressEmail(
      recipient,
      event === "unsubscribed" ? "UNSUBSCRIBED" : "COMPLAINED",
      "mailgun"
    );
  }

  if (!messageId) {
    return NextResponse.json({ ok: true, ignored: "no message-id" });
  }

  if (
    (event === "opened" || event === "clicked") &&
    recipient &&
    !(await hasTrackingConsent(recipient))
  ) {
    return NextResponse.json({ ok: true, ignored: "tracking not consented" });
  }

  // Find the InvestorInvite this event belongs to by searching the audit
  // log for our INVITE_SENT entry that recorded the same messageId.
  const inviteSentLog = await prisma.activityLog.findFirst({
    where: {
      entityType: "InvestorInvite",
      action: { in: ["INVITE_SENT"] },
      metadata: { path: ["messageId"], equals: messageId },
    },
    select: { entityId: true, userId: true },
  });

  if (!inviteSentLog) {
    // Event for an email we didn't track (or that predates message-id capture).
    // 200 so Mailgun stops retrying — nothing actionable.
    return NextResponse.json({ ok: true, ignored: "no matching invite" });
  }

  const action = `EMAIL_${event.toUpperCase()}`.replace(/[^A-Z_]/g, "_");

  await prisma.activityLog.create({
    data: {
      entityType: "InvestorInvite",
      entityId: inviteSentLog.entityId,
      action,
      metadata: {
        messageId,
        recipient,
        reason,
        rawEvent: event,
        eventTimestamp: ts,
      },
      userId: inviteSentLog.userId,
    },
  });

  return NextResponse.json({ ok: true });
}
