/* Regenerate the brand-style starter demo, self-contained with the DILS brand
   fonts (IvyMode + Nunito Sans) embedded. Run: node scripts/build-starter.cjs */
const fs = require("fs");
const path = require("path");

const SKILL = path.join(__dirname, "..", ".claude", "skills", "brand-style");
const TOKENS = fs.readFileSync(path.join(SKILL, "tokens.css"), "utf8");

function fontFace(family, file, { weight = "400", style = "normal" } = {}) {
  const b64 = fs.readFileSync(path.join(SKILL, "fonts", file)).toString("base64");
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:${weight};font-style:${style};font-display:swap;}`;
}
const FONTS = [
  fontFace("IvyMode", "ivymode-semibold.woff2", { weight: "600" }),
  fontFace("Nunito Sans", "nunito-sans.woff2", { weight: "200 1000" }),
  fontFace("Nunito Sans", "nunito-sans-italic.woff2", { weight: "200 1000", style: "italic" }),
].join("\n");

const DEMO_CSS = `
  .page { max-width: 880px; margin: 0 auto; padding: 40px 24px; }
  .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .page-title { font-family: var(--font-display); font-size: 30px; font-weight: 600; letter-spacing: -0.01em; }
  .section { margin-top: 36px; }
  .section > h2 { font-family: var(--font-sans); font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--foreground-subtle); margin-bottom: 14px; font-weight: 600; }
  .display-row { font-family: var(--font-display); font-weight: 600; color: var(--foreground); }
  .display-row .xl { font-size: 40px; letter-spacing: -.01em; display: block; }
  .display-row .lg { font-size: 26px; letter-spacing: -.01em; display: block; margin-top: 6px; color: var(--foreground-muted); }
  .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .btn { display: inline-flex; align-items: center; gap: 6px; height: var(--height-sm); padding: 0 12px; font: 600 14px/1 var(--font-sans); border-radius: var(--radius); border: 1px solid transparent; cursor: pointer; }
  .btn-primary { background: var(--gray-1000); color: var(--background-100); }
  .btn-secondary { background: var(--background-100); color: var(--foreground); border-color: var(--border); }
  .btn-ghost { background: transparent; color: var(--foreground); }
  .btn-danger { background: var(--error); color: #fff; }
  .badge { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; font: 600 12px/1 var(--font-sans); border-radius: var(--radius-full); border: 1px solid transparent; }
  .badge .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .badge-gray { background: var(--gray-100); color: var(--gray-900); border-color: var(--gray-alpha-300); }
  .badge-success { background: var(--green-100); color: var(--green-900); }
  .badge-warning { background: var(--amber-100); color: var(--amber-900); }
  .badge-error { background: var(--red-100); color: var(--red-900); }
  .badge-accent { background: var(--blue-100); color: var(--blue-900); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
  .card { background: var(--background-100); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px 18px; box-shadow: var(--shadow-sm); }
  .card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
  .card-title { font-size: 15px; font-weight: 700; }
  .text-muted { color: var(--foreground-subtle); font-size: 13px; }
  .mono { font-family: var(--font-mono); font-size: 13px; }
  .input { height: var(--height-md); padding: 0 12px; font: 400 14px/1 var(--font-sans); color: var(--foreground); background: var(--background-100); border: 1px solid var(--border); border-radius: var(--radius); max-width: 320px; width: 100%; }
  .input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--blue-200); }
  .swatches { display: flex; flex-wrap: wrap; gap: 6px; }
  .sw { width: 34px; height: 34px; border-radius: var(--radius-sm); box-shadow: var(--shadow-border); }
`;

const BODY = `
<div class="page">
  <div class="page-header">
    <h1 class="page-title">Brand style starter</h1>
    <button class="btn btn-secondary" onclick="document.documentElement.setAttribute('data-theme', document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark')">Toggle theme</button>
  </div>
  <p class="text-muted">Built only from <span class="mono">tokens.css</span> + the DILS brand fonts (IvyMode + Nunito Sans).</p>

  <div class="section"><h2>Type</h2>
    <div class="display-row"><span class="xl">IvyMode display heading</span><span class="lg">Section heading in IvyMode</span></div>
    <p style="margin-top:10px; max-width:60ch; color:var(--foreground-muted)">Body copy is set in <b>Nunito Sans</b> — humanist, legible, with <i>italics</i> and <b>bold</b> available across the variable weight range.</p>
  </div>

  <div class="section"><h2>Buttons</h2>
    <div class="row"><button class="btn btn-primary">Deploy</button><button class="btn btn-secondary">Cancel</button><button class="btn btn-ghost">Skip</button><button class="btn btn-danger">Delete</button></div>
  </div>

  <div class="section"><h2>Status</h2>
    <div class="row">
      <span class="badge badge-gray"><span class="dot"></span>Draft</span>
      <span class="badge badge-success"><span class="dot"></span>Ready</span>
      <span class="badge badge-warning"><span class="dot"></span>Building</span>
      <span class="badge badge-error"><span class="dot"></span>Error</span>
      <span class="badge badge-accent"><span class="dot"></span>Preview</span>
    </div>
  </div>

  <div class="section"><h2>Cards</h2>
    <div class="grid">
      <div class="card"><div class="card-head"><span class="card-title">Production</span><span class="badge badge-success">Ready</span></div><p class="text-muted">Deployed 2h ago · <span class="mono">main@b50f733</span></p></div>
      <div class="card"><div class="card-head"><span class="card-title">Preview</span><span class="badge badge-warning">Building</span></div><p class="text-muted">Triggered just now · <span class="mono">feat/portal</span></p></div>
    </div>
  </div>

  <div class="section"><h2>Field</h2><input class="input" type="text" placeholder="Project name" /></div>

  <div class="section"><h2>Gray scale</h2>
    <div class="swatches">${[100,200,300,400,500,600,700,800,900,1000].map(s=>`<div class="sw" style="background:var(--gray-${s})"></div>`).join("")}</div>
    <h2 style="margin-top:16px">Accent hues (700)</h2>
    <div class="swatches">${["blue","red","amber","green","teal","purple","pink"].map(h=>`<div class="sw" style="background:var(--${h}-700)"></div>`).join("")}</div>
  </div>
</div>`;

const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Brand style — starter</title>
<style>
${FONTS}
${TOKENS}
${DEMO_CSS}
</style>
</head>
<body>
${BODY}
</body>
</html>`;

fs.writeFileSync(path.join(SKILL, "examples", "starter.html"), html);
console.log("wrote starter.html", (html.length / 1024).toFixed(0), "KB");
