import { PDFDocument, StandardFonts } from "pdf-lib";
import { scanPlaceholders } from "../src/lib/pdf-placeholder-scan";

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 200]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Hello {{NAME}}, signed at {{DATE}}.", { x: 30, y: 100, font, size: 12 });
  const bytes = await doc.save();

  console.log("Generated PDF:", bytes.length, "bytes");

  const map = await scanPlaceholders(Buffer.from(bytes));
  console.log("Scan result:", JSON.stringify(map, null, 2));
  console.log("Keys found:", Object.keys(map).length);

  if (Object.keys(map).length === 0) {
    console.error("FAIL: scanner returned 0 keys");
    process.exit(1);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
