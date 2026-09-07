import { NextResponse } from "next/server";
import { verifyUnsubscribeToken, suppressEmail } from "@/lib/unsubscribe";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * RFC 8058 one-click unsubscribe endpoint — the target of the
 * List-Unsubscribe-Post header. Mail clients (Gmail, Outlook, ...) POST
 * here with body `List-Unsubscribe=One-Click` and no other auth; the `e`
 * (email) + `t` (token) query params are the only credential, so this
 * stays public like /api/mailgun/webhook.
 *
 * Same threat model as /sign/[token] (public token-in-URL lookup) — rate
 * limit per IP so a leaked/guessed token can't be hammered.
 */
export async function POST(req: Request) {
  const ip = await getClientIp();
  const rl = await checkRateLimit(`unsubscribe-post:${ip}`, 30, 60);
  if (!rl.allowed) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("e") ?? "";
  const token = url.searchParams.get("t") ?? "";

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return new NextResponse("Invalid or expired unsubscribe link", { status: 400 });
  }

  await suppressEmail(email, "UNSUBSCRIBED", "one-click");

  return new NextResponse("Unsubscribed", { status: 200 });
}
