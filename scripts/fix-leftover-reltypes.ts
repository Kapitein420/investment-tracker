/**
 * Follow-up to fix-misaligned-import.ts. The main script fixes Company
 * fields + tracking.relationshipType together — but only when ALL three
 * heuristic conditions match. For companies that pre-existed in the DB,
 * Company.contactName/contactEmail were correct from a prior import, so
 * the heuristic skipped them — but their tracking.relationshipType still
 * holds the wrong value (a person's name) from the misaligned import.
 *
 * This script finds trackings where relationshipType is clearly not a
 * canonical type (looks like a person's name: contains a space, or starts
 * with capital + has another capital later) and resets it to "Investor".
 *
 * Dry-run by default. `--apply` to write. `--asset <id>` to scope.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CANONICAL_TYPES = new Set(["investor", "broker", "advisor", "tenant", "other"]);

async function main() {
  const apply = process.argv.includes("--apply");
  const assetIdx = process.argv.indexOf("--asset");
  const assetId = assetIdx >= 0 ? process.argv[assetIdx + 1] : undefined;

  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  if (assetId) console.log(`Scope: asset ${assetId}`);
  console.log("");

  const trackings = await prisma.assetCompanyTracking.findMany({
    where: assetId ? { assetId } : {},
    include: {
      company: { select: { name: true } },
      asset: { select: { title: true } },
    },
  });

  // Reset criteria: relationshipType is set, NOT a canonical type, and
  // looks like a person's name (contains a space — canonical types are
  // single words, person names usually aren't).
  const broken = trackings.filter((t) => {
    if (!t.relationshipType) return false;
    if (CANONICAL_TYPES.has(t.relationshipType.toLowerCase())) return false;
    return t.relationshipType.includes(" ");
  });

  if (broken.length === 0) {
    console.log("No leftover trackings with non-canonical relationshipType. Nothing to fix.");
    return;
  }

  console.log(`Found ${broken.length} tracking(s) with a person-name in relationshipType:`);
  console.log("");
  for (const t of broken) {
    console.log(`  ${t.company?.name ?? "(?)"} (${t.asset.title})`);
    console.log(`    relationshipType: "${t.relationshipType}" -> "Investor"`);
    console.log("");
  }

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to write.");
    return;
  }

  let updated = 0;
  for (const t of broken) {
    await prisma.assetCompanyTracking.update({
      where: { id: t.id },
      data: { relationshipType: "Investor" },
    });
    updated++;
  }
  console.log(`Applied: ${updated} tracking row(s) updated.`);
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
