/**
 * One-time backfill: apply the two NDA template corrections to every asset
 * that already has an HTML NDA.
 *
 * enableHtmlNda() copies DEFAULT_NDA_TEMPLATE.html into
 * AssetContent.htmlContent at the moment an admin turns the HTML flow on, so
 * fixing src/lib/html-nda-template.ts only reaches assets created afterwards.
 * Assets already live keep serving the defective text to new signers until
 * this runs.
 *
 * Corrections (see the header of src/lib/html-nda-template.ts):
 *   1. "Eigenaar" -> "Verkoper" in articles 3 and 5 (undefined party).
 *   2. Article 2f cross-reference "onder d." -> "onder e." (d. is not a use).
 *
 * Already-signed documents are NOT touched and must not be: each one snapshots
 * its own signedHtml into Document.fieldConfig at signing time, and that
 * snapshot is the executed instrument.
 *
 * Idempotent — a row whose text is already corrected has no match left to
 * replace and is reported as "already correct".
 *
 * Run:
 *   npx tsx scripts/backfill-nda-template-fixes.ts          # preview
 *   npx tsx scripts/backfill-nda-template-fixes.ts --apply  # write
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Each pair must match the corresponding edit in html-nda-template.ts. */
const CORRECTIONS: ReadonlyArray<readonly [from: string, to: string]> = [
  ["Gegadigde staat er jegens Eigenaar voor in,", "Gegadigde staat er jegens Verkoper voor in,"],
  [
    "is Gegadigde aansprakelijk &ndash; zowel jegens Eigenaar als enige andere partij",
    "is Gegadigde aansprakelijk &ndash; zowel jegens Verkoper als enige andere partij",
  ],
  ["Gegadigde vrijwaart Eigenaar en voormelde partijen", "Gegadigde vrijwaart Verkoper en voormelde partijen"],
  ["Eigenaar heeft het recht Gegadigde uit te sluiten", "Verkoper heeft het recht Gegadigde uit te sluiten"],
  [
    "noodzakelijk is met het oog op het onder d. bedoelde gebruik",
    "noodzakelijk is met het oog op het onder e. bedoelde gebruik",
  ],
];

function correct(html: string): { html: string; applied: number } {
  let out = html;
  let applied = 0;
  for (const [from, to] of CORRECTIONS) {
    if (!out.includes(from)) continue;
    out = out.replaceAll(from, to);
    applied++;
  }
  return { html: out, applied };
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}\n`);

  const rows = await prisma.assetContent.findMany({
    where: { stageKey: "nda", htmlContent: { not: null } },
    select: { id: true, assetId: true, htmlContent: true, asset: { select: { title: true } } },
  });

  let fixed = 0;
  let alreadyCorrect = 0;
  let partial = 0;

  for (const row of rows) {
    const { html, applied } = correct(row.htmlContent!);
    const label = `${row.asset.title} (${row.assetId})`;

    if (applied === 0) {
      alreadyCorrect++;
      continue;
    }

    // Fewer than all five means an EDITOR has since reworded part of this
    // asset's template. The matching passages are still corrected; the rest
    // is listed so it can be reviewed by hand.
    if (applied < CORRECTIONS.length) {
      partial++;
      console.log(`  ~ ${label}: ${applied}/${CORRECTIONS.length} passages matched — review manually`);
    } else {
      console.log(`  ✓ ${label}`);
    }

    if (apply) {
      await prisma.assetContent.update({ where: { id: row.id }, data: { htmlContent: html } });
    }
    fixed++;
  }

  console.log(
    `\n${rows.length} HTML NDA row(s): ${fixed} ${apply ? "updated" : "to update"}` +
      ` (${partial} partial), ${alreadyCorrect} already correct.`
  );
  if (!apply && fixed > 0) console.log("Re-run with --apply to write.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
