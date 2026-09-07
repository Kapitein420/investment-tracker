/**
 * Vercel Cron entrypoint for the data-retention purge (see
 * compliance/data-retention-schedule.md and src/lib/purge.ts). Scheduled
 * daily at 03:30 UTC in vercel.json.
 *
 * Auth: Vercel sets `Authorization: Bearer ${CRON_SECRET}` automatically on
 * cron-triggered requests when the CRON_SECRET env var exists — same header
 * shape as src/app/api/health/route.ts, compared in constant time so the
 * secret can't be probed byte-by-byte.
 *
 * PURGE_ENABLED gates real deletion: unset/anything but "true" runs
 * dry-run (count only, no writes) until the retention periods are signed
 * off. See .env.example and compliance/README.md.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { runPurge } from "@/lib/purge";

export const runtime = "nodejs";

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : "";
  const expected = process.env.CRON_SECRET;

  if (!expected || !timingSafeEqualStr(bearer, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = process.env.PURGE_ENABLED !== "true";
  const counts = await runPurge({ dryRun });

  await prisma.activityLog.create({
    data: {
      entityType: "System",
      entityId: "purge-cron",
      action: "DATA_PURGE_RUN",
      metadata: { ...counts, dryRun },
      userId: null,
    },
  });

  return NextResponse.json({ dryRun, counts });
}
