/**
 * Read-only diagnostic. For each Anderlechtlaan-tracked Company that has
 * 0 CompanyContacts, print its current Company.contactName and contactEmail
 * so we can tell whether the missing contacts are recoverable from the
 * legacy fields (just re-run the backfill) or from the source CSV (need a
 * separate import).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const asset = await prisma.asset.findFirst({
    where: { title: { contains: "Anderlechtlaan", mode: "insensitive" } },
    select: { id: true },
  });
  if (!asset) return;

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: { assetId: asset.id },
    include: {
      company: {
        include: { contacts: { select: { id: true } } },
      },
    },
    orderBy: { company: { name: "asc" } },
  });

  const noContact = trackings.filter((t) => t.company.contacts.length === 0);
  console.log(`Companies on Anderlechtlaan with 0 CompanyContacts: ${noContact.length}\n`);

  let hasEmail = 0;
  let hasNameOnly = 0;
  let hasNothing = 0;

  for (const t of noContact) {
    const c = t.company;
    const cn = c.contactName ?? "(null)";
    const ce = c.contactEmail ?? "(null)";
    if (c.contactEmail) hasEmail++;
    else if (c.contactName) hasNameOnly++;
    else hasNothing++;
    console.log(`  ${c.name}: contactName=${cn} | contactEmail=${ce}`);
  }
  console.log("");
  console.log(`Has Company.contactEmail set:        ${hasEmail}`);
  console.log(`Has Company.contactName but no email: ${hasNameOnly}`);
  console.log(`Has neither:                          ${hasNothing}`);
}

main()
  .catch((e) => { console.error("FAIL:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
