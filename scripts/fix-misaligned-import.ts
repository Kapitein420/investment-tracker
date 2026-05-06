/**
 * One-shot data fix for the bulk-import column-misalignment bug.
 *
 * The bulk-import CSV parser was positional (no header check), so a CSV
 * with the bulk-invite shape (`company_name,contact_name,email`) silently
 * produced rows where:
 *   - tracking.relationshipType  = the contact's NAME
 *   - Company.contactName        = the email
 *   - Company.contactEmail       = empty
 *
 * This script swaps those fields back into their correct columns. It is
 * dry-run by default — pass `--apply` to actually write.
 *
 * Run:
 *   npx tsx scripts/fix-misaligned-import.ts                # preview
 *   npx tsx scripts/fix-misaligned-import.ts --apply        # write
 *   npx tsx scripts/fix-misaligned-import.ts --asset <id>   # scope to one asset
 *
 * Detection heuristic — a row is broken iff ALL of:
 *   1. Company.contactName contains "@" (looks like an email)
 *   2. Company.contactEmail is null/empty (would be set if import had been correct)
 *   3. tracking.relationshipType is NOT one of the canonical types
 *      ("Investor"/"Broker"/"Advisor"/"Tenant"/"Other", case-insensitive)
 *
 * All three together are a tight enough signal that no correctly-imported
 * row will match. Companies that have legitimate non-canonical relationship
 * labels (e.g. someone typed "Co-investor") are preserved unless their
 * Company.contactName ALSO happens to look like an email AND Company has
 * no email — vanishingly unlikely.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CANONICAL_TYPES = new Set(["investor", "broker", "advisor", "tenant", "other"]);

interface BrokenRow {
  trackingId: string;
  assetId: string;
  assetTitle: string;
  companyId: string;
  companyName: string;
  before: {
    relationshipType: string;
    contactName: string | null;
    contactEmail: string | null;
  };
  after: {
    relationshipType: string;
    contactName: string;
    contactEmail: string;
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const assetIdx = process.argv.indexOf("--asset");
  const assetId = assetIdx >= 0 ? process.argv[assetIdx + 1] : undefined;

  console.log(`Mode: ${apply ? "APPLY (will write)" : "DRY-RUN (no writes)"}`);
  if (assetId) console.log(`Scope: asset ${assetId}`);
  console.log("");

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: assetId ? { assetId } : {},
    include: {
      company: { select: { id: true, name: true, contactName: true, contactEmail: true } },
      asset: { select: { id: true, title: true } },
    },
  });

  const broken: BrokenRow[] = [];

  for (const t of trackings) {
    const c = t.company;
    if (!c) continue;

    const contactNameLooksLikeEmail = !!c.contactName && c.contactName.includes("@");
    const noContactEmail = !c.contactEmail || c.contactEmail.trim() === "";
    const relTypeNonCanonical =
      !!t.relationshipType && !CANONICAL_TYPES.has(t.relationshipType.toLowerCase());

    if (contactNameLooksLikeEmail && noContactEmail && relTypeNonCanonical) {
      broken.push({
        trackingId: t.id,
        assetId: t.asset.id,
        assetTitle: t.asset.title,
        companyId: c.id,
        companyName: c.name,
        before: {
          relationshipType: t.relationshipType,
          contactName: c.contactName,
          contactEmail: c.contactEmail,
        },
        after: {
          relationshipType: "Investor",
          contactName: t.relationshipType,
          contactEmail: c.contactName!,
        },
      });
    }
  }

  if (broken.length === 0) {
    console.log("No misaligned rows detected. Nothing to fix.");
    return;
  }

  console.log(`Found ${broken.length} misaligned row(s):`);
  console.log("");
  for (const b of broken) {
    console.log(`  ${b.companyName} (${b.assetTitle})`);
    console.log(`    relationshipType: "${b.before.relationshipType}" -> "${b.after.relationshipType}"`);
    console.log(`    Company.contactName:  ${JSON.stringify(b.before.contactName)} -> ${JSON.stringify(b.after.contactName)}`);
    console.log(`    Company.contactEmail: ${JSON.stringify(b.before.contactEmail)} -> ${JSON.stringify(b.after.contactEmail)}`);
    console.log("");
  }

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to write these fixes.");
    return;
  }

  // Group by companyId so a Company touched by multiple trackings is updated
  // exactly once (shouldn't happen in this bug pattern, but defensive).
  const companyUpdates = new Map<string, { contactName: string; contactEmail: string }>();
  for (const b of broken) {
    if (!companyUpdates.has(b.companyId)) {
      companyUpdates.set(b.companyId, {
        contactName: b.after.contactName,
        contactEmail: b.after.contactEmail,
      });
    }
  }

  let companiesUpdated = 0;
  let trackingsUpdated = 0;

  for (const [companyId, data] of Array.from(companyUpdates.entries())) {
    await prisma.company.update({
      where: { id: companyId },
      data,
    });
    companiesUpdated++;
  }
  for (const b of broken) {
    await prisma.assetCompanyTracking.update({
      where: { id: b.trackingId },
      data: { relationshipType: "Investor" },
    });
    trackingsUpdated++;
  }

  console.log(`Applied: ${companiesUpdated} compan${companiesUpdated === 1 ? "y" : "ies"}, ${trackingsUpdated} tracking row(s) updated.`);
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
