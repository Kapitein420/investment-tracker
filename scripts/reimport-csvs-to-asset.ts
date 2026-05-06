/**
 * Idempotent re-import: reads bulk-invite-format CSVs from disk and
 * reconciles the live DB against them as the source of truth.
 *
 * For each (companyName, contactName, email) row:
 *   - Find Company by name (case-insensitive, trimmed)
 *   - If found:
 *       - If Company.contactName looks like an email AND we have a real
 *         name from the CSV, swap: contactName <- csv.name, contactEmail
 *         <- the email that was in contactName.
 *       - Else, fill any missing legacy fields (contactName, contactEmail)
 *         from the CSV without overwriting good data.
 *       - Reset tracking.relationshipType to "Investor" if non-canonical.
 *       - Upsert CompanyContact for (companyId, lower(email)).
 *   - If not found: create Company + AssetCompanyTracking + StageStatus
 *     + CompanyContact end-to-end.
 *
 * No emails sent. Pure data reconciliation.
 *
 * Run:
 *   npx tsx scripts/reimport-csvs-to-asset.ts \
 *     --asset <assetId> \
 *     --csv path/to/batch1.csv path/to/batch2.csv ...
 *
 *   Add --apply to write. Default is dry-run.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

const CANONICAL_TYPES = new Set(["investor", "broker", "advisor", "tenant", "other"]);

interface CsvRow {
  companyName: string;
  contactName: string;
  email: string;
  source: string; // file:line for error reporting
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function findCol(header: string[], names: string[]): number {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i !== -1) return i;
  }
  return -1;
}

function readCsv(path: string): CsvRow[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const colCompany = findCol(header, ["company", "company_name", "name"]);
  const colName = findCol(header, ["contact_name", "contact", "first_name"]);
  const colEmail = findCol(header, ["email", "contact_email", "e-mail"]);
  if (colCompany === -1 || colEmail === -1) {
    throw new Error(`${path}: CSV must have a company and email column.`);
  }
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    const companyName = (parts[colCompany] ?? "").trim();
    if (!companyName) continue;
    rows.push({
      companyName,
      contactName: colName >= 0 ? (parts[colName] ?? "").trim() : "",
      email: (parts[colEmail] ?? "").trim().toLowerCase(),
      source: `${path}:${i + 1}`,
    });
  }
  return rows;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const assetIdx = args.indexOf("--asset");
  const csvIdx = args.indexOf("--csv");
  if (assetIdx === -1 || csvIdx === -1) {
    console.error("Usage: --asset <id> --csv <path1> [path2] ... [--apply]");
    process.exit(1);
  }
  const assetId = args[assetIdx + 1];
  const csvPaths = args
    .slice(csvIdx + 1)
    .filter((a) => a !== "--apply" && !a.startsWith("--"));

  const asset = await prisma.asset.findUniqueOrThrow({
    where: { id: assetId },
    select: { id: true, title: true },
  });
  const stages = await prisma.pipelineStage.findMany({
    where: { isActive: true },
    orderBy: { sequence: "asc" },
  });

  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);
  console.log(`Asset: ${asset.title} (${asset.id})`);
  console.log(`CSVs: ${csvPaths.length}`);

  const allRows: CsvRow[] = [];
  for (const p of csvPaths) {
    const rows = readCsv(p);
    console.log(`  ${p}: ${rows.length} rows`);
    allRows.push(...rows);
  }
  console.log(`Total CSV rows: ${allRows.length}\n`);

  let companyCreated = 0;
  let trackingCreated = 0;
  let companyFieldsFixed = 0;
  let relTypeReset = 0;
  let contactCreated = 0;
  let contactExisted = 0;
  let skippedNoEmail = 0;

  for (const row of allRows) {
    if (!row.email || !row.email.includes("@")) {
      skippedNoEmail++;
      continue;
    }

    let company = await prisma.company.findFirst({
      where: { name: { equals: row.companyName, mode: "insensitive" } },
    });

    if (!company) {
      if (apply) {
        company = await prisma.company.create({
          data: {
            name: row.companyName,
            type: "INVESTOR",
            contactName: row.contactName || null,
            contactEmail: row.email,
          },
        });
      } else {
        // Dry-run: pretend we created so we can count downstream work, but
        // skip the per-row checks that need a real id.
        console.log(`  WOULD CREATE Company: ${row.companyName} (${row.contactName || "—"} <${row.email}>)`);
        companyCreated++;
        continue;
      }
      companyCreated++;
    } else {
      // Fix legacy contactName/contactEmail if they got the misalign treatment.
      const updates: Record<string, string | null> = {};
      const cnLooksLikeEmail = !!company.contactName && company.contactName.includes("@");
      const ceMissing = !company.contactEmail;
      if (cnLooksLikeEmail && ceMissing && row.contactName) {
        updates.contactName = row.contactName;
        updates.contactEmail = row.email;
      } else {
        if (!company.contactName && row.contactName) updates.contactName = row.contactName;
        if (!company.contactEmail) updates.contactEmail = row.email;
      }
      if (Object.keys(updates).length > 0) {
        if (apply) {
          company = await prisma.company.update({
            where: { id: company.id },
            data: updates,
          });
        }
        companyFieldsFixed++;
      }
    }

    // Tracking
    let tracking = await prisma.assetCompanyTracking.findUnique({
      where: { assetId_companyId: { assetId, companyId: company.id } },
    });
    if (!tracking) {
      if (apply) {
        tracking = await prisma.assetCompanyTracking.create({
          data: {
            assetId,
            companyId: company.id,
            relationshipType: "Investor",
          },
        });
        if (stages.length > 0) {
          await prisma.stageStatus.createMany({
            data: stages.map((s) => ({
              trackingId: tracking!.id,
              stageId: s.id,
              status: "NOT_STARTED" as const,
            })),
          });
        }
      }
      trackingCreated++;
    } else if (tracking.relationshipType && !CANONICAL_TYPES.has(tracking.relationshipType.toLowerCase())) {
      if (apply) {
        await prisma.assetCompanyTracking.update({
          where: { id: tracking.id },
          data: { relationshipType: "Investor" },
        });
      }
      relTypeReset++;
    }

    // Contact
    const existing = await prisma.companyContact.findUnique({
      where: { companyId_email: { companyId: company.id, email: row.email } },
    });
    if (existing) {
      contactExisted++;
      if (!existing.name && row.contactName && apply) {
        await prisma.companyContact.update({
          where: { id: existing.id },
          data: { name: row.contactName },
        });
      }
    } else {
      if (apply) {
        await prisma.companyContact.create({
          data: {
            companyId: company.id,
            name: row.contactName || null,
            email: row.email,
          },
        });
      }
      contactCreated++;
    }
  }

  console.log("");
  console.log(`Companies created:        ${companyCreated}`);
  console.log(`Companies fields fixed:   ${companyFieldsFixed}`);
  console.log(`Trackings created:        ${trackingCreated}`);
  console.log(`relationshipType reset:   ${relTypeReset}`);
  console.log(`Contacts created:         ${contactCreated}`);
  console.log(`Contacts already existed: ${contactExisted}`);
  console.log(`Skipped (no email):       ${skippedNoEmail}`);
  if (!apply) console.log("\nDry-run only. Re-run with --apply to write.");
}

main()
  .catch((e) => { console.error("FAIL:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
