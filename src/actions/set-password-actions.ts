"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { BCRYPT_COST, generatePassword } from "@/lib/security";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  claimPasswordSetToken,
  hashPasswordSetToken,
} from "@/lib/password-set-token";

export type RevealPasswordResult =
  | { ok: true; password: string; email: string }
  | { ok: false; error: string };

/**
 * Redeem a one-time link (compliance gap G9): generate the account's new
 * password and return it to the page once. The password never travels by
 * email; the link is what the mailbox owner holds.
 *
 * Public and unauthenticated: the token in the URL is the only credential,
 * same trust model as /sign/[token]. Redeeming is a button press on the page
 * (not a GET) so mail scanners that prefetch links can't burn the link.
 */
export async function revealPasswordWithToken(
  token: string
): Promise<RevealPasswordResult> {
  // Same 30/min per-IP cap as the /sign/[token] page. The page itself is
  // limited too; this covers a client that posts the action directly.
  const ip = await getClientIp();
  const rl = await checkRateLimit(`set-password:${ip}`, 30, 60);
  if (!rl.allowed) {
    return { ok: false, error: "Too many attempts. Please wait a minute and try again." };
  }

  const tokenHash = hashPasswordSetToken(token ?? "");
  const row = await prisma.passwordSetToken.findUnique({
    where: { tokenHash },
    select: {
      purpose: true,
      user: { select: { id: true, email: true, isActive: true } },
    },
  });
  // A deactivated account stays deactivated: `removeInvestor` flips isActive
  // to false, and an old invite link must not undo that. Invited users are
  // created active, so an INVITE link never needs to activate anyone.
  if (!row || !row.user.isActive) {
    return { ok: false, error: "This link is no longer valid. Request a new one." };
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    await prisma.$transaction(async (tx) => {
      // Claim first: if another request already redeemed this link the
      // update matches zero rows and we abort before touching the password.
      const claimed = await claimPasswordSetToken(tx, tokenHash);
      if (!claimed) throw new Error("TOKEN_UNAVAILABLE");

      await tx.user.update({
        where: { id: row.user.id },
        data: {
          passwordHash,
          // Stamping this invalidates every session minted earlier (see the
          // jwt callback in lib/auth) and clears the first-login gate, so
          // the investor is not forced to pick a password of their own.
          passwordChangedAt: new Date(),
          // Any lock from failed guesses is moot once the password is
          // replaced by whoever controls the mailbox.
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });

      await tx.activityLog.create({
        data: {
          entityType: "User",
          entityId: row.user.id,
          action: "PASSWORD_SET_VIA_LINK",
          metadata: { email: row.user.email, purpose: row.purpose, generated: true },
          // The actor is the account holder redeeming their own link. There
          // is no session on this page, so unlike the /sign/[token] flow
          // (#172) the token's own userId IS the honest attribution.
          userId: row.user.id,
        },
      });
    });
  } catch (e: any) {
    if (e?.message === "TOKEN_UNAVAILABLE") {
      return { ok: false, error: "This link is no longer valid. Request a new one." };
    }
    console.error("[revealPasswordWithToken] failed:", e);
    return { ok: false, error: "Couldn't generate your password. Please try again." };
  }

  return { ok: true, password, email: row.user.email };
}
