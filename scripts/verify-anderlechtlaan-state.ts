/**
 * Read-only audit: counts the Anderlechtlaan asset's trackings, companies,
 * and contacts so we can compare against the imported CSVs. Pure SELECTs.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const asset = await prisma.asset.findFirst({
    where: { title: { contains: "Anderlechtlaan", mode: "insensitive" } },
    select: { id: true, title: true },
  });
  if (!asset) {
    console.log("Asset not found.");
    return;
  }
  console.log(`Asset: ${asset.title} (${asset.id})\n`);

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: { assetId: asset.id },
    include: {
      company: {
        include: {
          contacts: {
            select: { name: true, email: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
    orderBy: { company: { name: "asc" } },
  });

  console.log(`Tracked companies on this asset: ${trackings.length}`);
  const totalContacts = trackings.reduce((sum, t) => sum + t.company.contacts.length, 0);
  console.log(`Total CompanyContacts across those companies: ${totalContacts}`);
  console.log("");

  const multi = trackings.filter((t) => t.company.contacts.length > 1);
  console.log(`Companies with >1 contact: ${multi.length}`);
  for (const t of multi) {
    console.log(`  ${t.company.name} (${t.company.contacts.length} contacts):`);
    for (const c of t.company.contacts) {
      console.log(`    - ${c.name ?? "(no name)"} <${c.email}>`);
    }
  }
  console.log("");

  const noContact = trackings.filter((t) => t.company.contacts.length === 0);
  console.log(`Companies with 0 contacts: ${noContact.length}`);
  for (const t of noContact) {
    console.log(`  ${t.company.name}`);
  }
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
