/**
 * Lightweight rate-limit abstraction for auth-adjacent endpoints.
 *
 * Backends, in order of preference:
 *  1. Upstash Redis REST API — distributed across all Vercel function
 *     instances. Configured by setting UPSTASH_REDIS_REST_URL +
 *     UPSTASH_REDIS_REST_TOKEN. Uses raw fetch (no @upstash/ratelimit
 *     dependency) so the bundle stays slim and the fallback below kicks
 *     in cleanly when env vars are absent.
 *  2. In-memory Map — per-Vercel-instance, fine for local dev. Doesn't
 *     coordinate across cold-started function containers, so it's NOT a
 *     true protection in production. Logs a warning on first use so the
 *     misconfiguration is visible in Vercel logs.
 *
 * Returns { allowed, remaining, resetAt }. Callers decide their own
 * policy on what "denied" means (silent ok-true on password reset,
 * CredentialsSignin null on auth, etc.).
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const memoryStore = new Map<string, { count: number; resetAt: number }>();
let warnedNoUpstash = false;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch ms when the window resets and the counter goes back to 0. */
  resetAt: number;
}

/**
 * Increment the counter for `key`, allow up to `limit` events per
 * `windowSec`. Returns whether the current event is allowed.
 *
 * On Upstash failure we fall OPEN (allow=true) and log — don't take down
 * the site because a Redis blip happened. Caller-side fail-closed
 * decisions can layer on top by checking `result.allowed` plus their own
 * defensive logic.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      // INCR + EXPIRE in a pipeline. Upstash REST accepts a JSON array
      // of commands and returns results in order.
      const res = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["EXPIRE", key, String(windowSec), "NX"],
          ["PTTL", key],
        ]),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Upstash ${res.status}`);
      const data = (await res.json()) as Array<{ result: number | string }>;
      const count = Number(data[0]?.result ?? 0);
      const pttlMs = Number(data[2]?.result ?? windowSec * 1000);
      const resetAt = Date.now() + Math.max(pttlMs, 0);
      const allowed = count <= limit;
      return { allowed, remaining: Math.max(0, limit - count), resetAt };
    } catch (e) {
      console.warn("[rate-limit] upstash failed, falling open:", e);
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowSec * 1000 };
    }
  }

  if (!warnedNoUpstash) {
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL / _TOKEN not set — using in-memory limiter (per-instance only, NOT effective in production)."
    );
    warnedNoUpstash = true;
  }

  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowSec * 1000 };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/**
 * Best-effort caller IP extraction. NextAuth + server actions don't pass
 * the Request object directly, so we read the standard Vercel forwarded
 * headers via next/headers. Returns "unknown" when run in a context
 * without a request (e.g. unit tests). Used purely as a rate-limit key —
 * spoofing only hurts the attacker (they can't abuse a honest user's IP
 * that way, since the email key still locks them out).
 */
export async function getClientIp(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const h = headers();
    const forwarded =
      h.get("x-forwarded-for") ||
      h.get("x-real-ip") ||
      h.get("cf-connecting-ip");
    if (forwarded) return forwarded.split(",")[0].trim();
  } catch {
    // headers() throws when called outside a request scope — fall through
  }
  return "unknown";
}
