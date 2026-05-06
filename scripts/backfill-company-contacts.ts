/**
 * One-time backfill: derive a CompanyContact row from each existing
 * Company that has contactName + contactEmail. Run once after the
 * 2026-05-06-company-contact migration ships, so the new admin UI
 * (which lists CompanyContacts) doesn't look empty for the existing
 * book of business.
 *
 * Idempotent — re-runs are no-ops because the (companyId, email) unique
 * index dedupes any contact already promoted.
 *
 * Run:
 *   npx tsx scripts/backfill-company-contacts.ts          # preview
 *   npx tsx scripts/backfill-company-contacts.ts --apply  # write
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}\n`);

  const companies = await prisma.company.findMany({
    where: {
      contactEmail: { not: null },
    },
    select: {
      id: true,
      name: true,
      contactName: true,
      contactEmail: true,
    },
  });

  let toInsert = 0;
  let alreadyPresent = 0;
  let skipped = 0;

  for (const c of companies) {
    const email = (c.contactEmail ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      skipped++;
      continue;
    }
    const existing = await prisma.companyContact.findUnique({
      where: { companyId_email: { companyId: c.id, email } },
    });
    if (existing) {
      alreadyPresent++;
      continue;
    }
    if (!apply) {
      console.log(`  ${c.name}: + ${c.contactName ?? "(no name)"} <${email}>`);
    } else {
      await prisma.companyContact.create({
        data: {
          companyId: c.id,
          name: c.contactName,
          email,
        },
      });
    }
    toInsert++;
  }

  console.log("");
  console.log(`Companies scanned:   ${companies.length}`);
  console.log(`Contacts to insert:  ${toInsert}`);
  console.log(`Already present:     ${alreadyPresent}`);
  console.log(`Skipped (bad email): ${skipped}`);
  if (!apply && toInsert > 0) {
    console.log("\nDry-run only. Re-run with --apply to write.");
  }
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
