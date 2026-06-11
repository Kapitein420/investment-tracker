/**
 * Health check endpoint for diagnosing the signing stack in production.
 *
 * Auth: requires HEALTH_SECRET in EVERY environment. Pass it as
 *   Authorization: Bearer <secret>
 * (preferred — keeps it out of access logs / browser history) or, as a
 * fallback, ?secret=<secret>.
 *
 * Returns JSON showing subsystem health as booleans only — no row counts,
 * no raw exception strings (those are server-logged), so the endpoint can't
 * be used to fingerprint the deployment.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7)
    : null;
  const provided = bearer ?? url.searchParams.get("secret") ?? "";
  const expected = process.env.HEALTH_SECRET;

  // Require the secret in all environments — a non-production preview deploy
  // must not expose this publicly.
  if (!expected) {
    return NextResponse.json(
      { error: "HEALTH_SECRET not configured" },
      { status: 503 }
    );
  }
  if (!timingSafeEqualStr(provided, expected)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const checks: Record<string, any> = {
    nodeVersion: process.version,
    runtime: "nodejs",
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      NEXTAUTH_URL: Boolean(process.env.NEXTAUTH_URL),
      NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
      NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      MAILGUN_API_KEY: Boolean(process.env.MAILGUN_API_KEY),
      MAILGUN_DOMAIN: Boolean(process.env.MAILGUN_DOMAIN),
      VERCEL_PROJECT_PRODUCTION_URL: Boolean(
        process.env.VERCEL_PROJECT_PRODUCTION_URL
      ),
    },
  };

  // Test database connection — confirm reachability without leaking the
  // user count.
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true };
  } catch (e: any) {
    console.error("[health] database check failed:", e?.message ?? e);
    checks.database = { ok: false };
  }

  // Test pdf-lib loads
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    doc.addPage();
    await doc.save();
    checks.pdfLib = { ok: true };
  } catch (e: any) {
    console.error("[health] pdf-lib check failed:", e?.message ?? e);
    checks.pdfLib = { ok: false };
  }

  // Test pdfjs-dist loads (placeholder scanner)
  try {
    // @ts-ignore
    await import("pdfjs-dist/legacy/build/pdf.mjs");
    checks.pdfjsDist = { ok: true };
  } catch (e: any) {
    console.error("[health] pdfjs-dist check failed:", e?.message ?? e);
    checks.pdfjsDist = { ok: false };
  }

  // Test Supabase storage connection
  try {
    const { getSignedUrl } = await import("@/lib/supabase-storage");
    await getSignedUrl("health-check-does-not-exist.pdf", 60);
    checks.supabaseStorage = { ok: true };
  } catch (e: any) {
    console.error("[health] supabase check failed:", e?.message ?? e);
    checks.supabaseStorage = { ok: false };
  }

  const allOk =
    checks.database?.ok &&
    checks.pdfLib?.ok &&
    checks.pdfjsDist?.ok &&
    checks.supabaseStorage?.ok;

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      ...checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
