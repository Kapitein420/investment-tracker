import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * Vercel serverless functions are stateless — each container holds its
 * own Prisma client and, by default, opens an unbounded number of
 * connections. With Supabase's Session-mode pooler capped at 15 clients,
 * this manifests as `EMAXCONNSESSION: max clients reached` whenever a
 * burst of admin pages renders concurrently (multiple tabs, page reloads,
 * the live email-log poll, etc.). Bound each container to a small fixed
 * number so the worst case is `concurrent_functions × connection_limit`
 * connections — predictable instead of runaway.
 *
 * `pool_timeout` makes Prisma fail fast (20s) instead of hanging on a
 * starved pool, so the request returns a 500 with a clear log entry
 * rather than timing out the whole serverless invocation.
 *
 * If the env URL already specifies these, we leave it alone — admin can
 * still tune it on Vercel.
 */
function buildDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  let url = raw;
  if (!/[?&]connection_limit=/i.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "connection_limit=3";
  }
  if (!/[?&]pool_timeout=/i.test(url)) {
    url += "&pool_timeout=20";
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl() } },
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
