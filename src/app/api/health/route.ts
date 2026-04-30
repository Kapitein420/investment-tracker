/**
 * Health check endpoint for diagnosing the signing stack in production.
 *
 * Visit: /api/health?secret=<your-health-secret>
 * Requires env var HEALTH_SECRET to prevent public abuse.
 *
 * Returns JSON showing:
 *   - env vars present (without revealing values)
 *   - Supabase connection
 *   - pdf-lib load
 *   - pdfjs-dist load
 *   - Node version
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const expected = process.env.HEALTH_SECRET;

  // Detailed health diagnostics are gated by an env-var-shared secret.
  // Both unauthorized cases (secret unset OR secret mismatch) return an
  // identical 401 with an opaque body — this avoids two failure modes:
  // (a) leaking the literal env-var name into a public 5xx body, and
  // (b) returning 503 for an *authorization* problem, which broke any
  //     uptime monitor pointed at this URL into perpetual false alerts.
  if (process.env.NODE_ENV === "production") {
    if (!expected || secret !== expected) {
      return NextResponse.json(
        { status: "unauthorized" },
        { status: 401 }
      );
    }
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
      VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    },
  };

  // Test database connection
  try {
    const { prisma } = await import("@/lib/db");
    const count = await prisma.user.count();
    checks.database = { ok: true, userCount: count };
  } catch (e: any) {
    checks.database = { ok: false, error: e.message };
  }

  // Test pdf-lib loads
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    checks.pdfLib = { ok: true, testPdfBytes: bytes.length };
  } catch (e: any) {
    checks.pdfLib = { ok: false, error: e.message };
  }

  // Test pdfjs-dist loads (placeholder scanner)
  try {
    // @ts-ignore
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    checks.pdfjsDist = { ok: true, version: pdfjs.version ?? "loaded" };
  } catch (e: any) {
    checks.pdfjsDist = { ok: false, error: e.message };
  }

  // Test Supabase storage connection
  try {
    const { getSignedUrl } = await import("@/lib/supabase-storage");
    // Try generating a signed URL for a known-missing path.
    // Supabase returns a signed URL even if the file doesn't exist, so
    // success here just confirms the client is configured correctly.
    await getSignedUrl("health-check-does-not-exist.pdf", 60);
    checks.supabaseStorage = { ok: true };
  } catch (e: any) {
    checks.supabaseStorage = { ok: false, error: e.message };
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
