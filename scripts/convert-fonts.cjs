/* Compress the DILS brand fonts (OTF/TTF) to woff2 and place them in the
   brand-style skill. Run once: node scripts/convert-fonts.cjs               */
const fs = require("fs");
const path = require("path");
const { compress } = require("wawoff2");

const DOWNLOADS = "C:/Users/noah_/Downloads";
const DEST = path.join(__dirname, "..", ".claude", "skills", "brand-style", "fonts");
fs.mkdirSync(DEST, { recursive: true });

const jobs = [
  { src: "IvyMode Semi Bold.otf", out: "ivymode-semibold.woff2" },
  { src: "NunitoSans-VariableFont_YTLC,opsz,wdth,wght.ttf", out: "nunito-sans.woff2" },
  { src: "NunitoSans-Italic-VariableFont_YTLC,opsz,wdth,wght.ttf", out: "nunito-sans-italic.woff2" },
];

(async () => {
  for (const j of jobs) {
    const input = fs.readFileSync(path.join(DOWNLOADS, j.src));
    const woff2 = Buffer.from(await compress(input));
    fs.writeFileSync(path.join(DEST, j.out), woff2);
    console.log(`${j.out.padEnd(26)} ${(input.length/1024).toFixed(0)}KB -> ${(woff2.length/1024).toFixed(0)}KB woff2`);
  }
  console.log("done ->", DEST);
})();
