"use server";

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { sendInvestorInvite } from "@/actions/invite-actions";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

// Cap: 200 rows per call. Each row can take ~300ms (Mailgun call inside
// sendInvestorInvite). 200 × 300ms = 60s, which fits Vercel Pro's
// max function duration. The parent route (assets/[id]) sets
// maxDuration: 300 to bump the ceiling so this comfortably finishes.
// Hobby plan caps at 10s — admins on Hobby will see a timeout for
// batches > ~30 rows; bump to Pro before the wave.
const MAX_ROWS = 200;

export interface BulkInviteRow {
  companyName: string;
  contactName?: string;
  email: string;
}

export type BulkInviteRowResult =
  | {
      row: number;
      email: string;
      status: "invited" | "reinvited";
      companyId: string;
      companyName: string;
      emailSent: boolean;
      emailError?: string;
    }
  | {
      row: number;
      email: string;
      status: "error";
      message: string;
    };

export interface BulkInviteResult {
  batchId: string;
  totalRows: number;
  succeeded: number;
  failed: number;
  emailsSent: number;
  emailsFailed: number;
  results: BulkInviteRowResult[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Bulk-invite investors to one asset. Idempotent by company name + email:
 * if a Company already exists with that contactEmail (or that name), reuse
 * it. If a User already exists for (email, companyId), the underlying
 * sendInvestorInvite skips password regeneration when they've logged in.
 *
 * Per-row failures don't abort the batch — admin sees a results table
 * showing exactly which rows worked, which were re-invites, which failed
 * and why. Rows with malformed emails or empty company names are caught
 * early; downstream errors (Mailgun rejections, DB constraints) surface
 * in the result row.
 */
export async function bulkInviteInvestors({
  assetId,
  rows,
}: {
  assetId: string;
  rows: BulkInviteRow[];
}): Promise<BulkInviteResult> {
  const user = await requireRole("EDITOR");

  if (rows.length === 0) {
    throw new Error("No rows to import.");
  }
  if (rows.length > MAX_ROWS) {
    throw new Error(
      `Too many rows (${rows.length}). Maximum is ${MAX_ROWS} per batch — split the file and retry.`
    );
  }

  const asset = await prisma.asset.findUniqueOrThrow({
    where: { id: assetId },
    select: { id: true, title: true },
  });

  const batchId = randomUUID();
  await prisma.activityLog.create({
    data: {
      entityType: "Asset",
      entityId: assetId,
      action: "BULK_INVITE_BATCH_STARTED",
      metadata: { batchId, rowCount: rows.length, assetTitle: asset.title },
      userId: user.id,
    },
  });

  const results: BulkInviteRowResult[] = [];
  let emailsSent = 0;
  let emailsFailed = 0;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 1;
    const email = (r.email ?? "").trim().toLowerCase();
    const companyName = (r.companyName ?? "").trim();
    const contactName = (r.contactName ?? "").trim() || null;

    try {
      if (!email || !EMAIL_REGEX.test(email)) {
        throw new Error("Invalid email address");
      }
      if (!companyName) {
        throw new Error("Company name is required");
      }

      // Idempotent company match: prefer matching on contactEmail (most
      // specific), fall back to name. Prevents duplicate Company rows
      // when the same firm is bulk-imported across multiple deals.
      let company = await prisma.company.findFirst({
        where: {
          OR: [
            { contactEmail: email },
            { name: { equals: companyName, mode: "insensitive" } },
          ],
        },
      });

      if (!company) {
        company = await prisma.company.create({
          data: {
            name: companyName,
            type: "INVESTOR",
            contactName,
            contactEmail: email,
          },
        });
      } else if (!company.contactEmail || !company.contactName) {
        // Backfill missing fields from CSV without overwriting existing data.
        const updates: Record<string, string> = {};
        if (!company.contactEmail) updates.contactEmail = email;
        if (!company.contactName && contactName) updates.contactName = contactName;
        if (Object.keys(updates).length > 0) {
          company = await prisma.company.update({
            where: { id: company.id },
            data: updates,
          });
        }
      }

      // Mirror the bulk-import flow: capture every invited person as a
      // CompanyContact too, so the drawer's contacts list stays complete
      // when an admin invites someone who wasn't previously imported.
      // Idempotent — the (companyId, email) unique index dedupes if this
      // person was already captured via Bulk Import.
      const existingContact = await prisma.companyContact.findUnique({
        where: { companyId_email: { companyId: company.id, email } },
      });
      if (!existingContact) {
        await prisma.companyContact.create({
          data: {
            companyId: company.id,
            name: contactName,
            email,
          },
        });
      } else if (!existingContact.name && contactName) {
        await prisma.companyContact.update({
          where: { id: existingContact.id },
          data: { name: contactName },
        });
      }

      // Detect re-invite vs first invite for this (asset, company) pair —
      // purely informational so the admin sees in the results table whose
      // password got regenerated and whose didn't.
      const existingInvite = await prisma.investorInvite.findFirst({
        where: { assetId, companyId: company.id, email },
      });

      const inviteResult = await sendInvestorInvite({
        companyId: company.id,
        assetId,
        email,
      });

      if (inviteResult.emailSent) emailsSent += 1;
      else emailsFailed += 1;

      succeeded += 1;
      results.push({
        row: rowNum,
        email,
        status: existingInvite ? "reinvited" : "invited",
        companyId: company.id,
        companyName: company.name,
        emailSent: inviteResult.emailSent,
        emailError: inviteResult.emailError,
      });
    } catch (e: any) {
      failed += 1;
      results.push({
        row: rowNum,
        email,
        status: "error",
        message: e?.message ?? "Unknown error",
      });
    }
  }

  await prisma.activityLog.create({
    data: {
      entityType: "Asset",
      entityId: assetId,
      action: "BULK_INVITE_BATCH_COMPLETED",
      metadata: {
        batchId,
        totalRows: rows.length,
        succeeded,
        failed,
        emailsSent,
        emailsFailed,
      },
      userId: user.id,
    },
  });

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/admin/invites");

  return {
    batchId,
    totalRows: rows.length,
    succeeded,
    failed,
    emailsSent,
    emailsFailed,
    results,
  };
}
