/* One-shot generator for .claude/skills/brand-style/tokens.css
   Emits the full Geist color system (light + dark) extracted from the
   production brand export. Run: node scripts/gen-brand-tokens.cjs        */
const fs = require("fs");
const path = require("path");

const LIGHT = {"gray-100":"0, 0%, 95%","gray-200":"0, 0%, 92%","gray-300":"0, 0%, 90%","gray-400":"0, 0%, 92%","gray-500":"0, 0%, 79%","gray-600":"0, 0%, 66%","gray-700":"0, 0%, 56%","gray-800":"0, 0%, 49%","gray-900":"0, 0%, 30%","gray-1000":"0, 0%, 9%","background-100":"0, 0%, 100%","background-200":"0, 0%, 98%","blue-100":"212, 100%, 97%","blue-200":"210, 100%, 96%","blue-300":"210, 100%, 94%","blue-400":"209, 100%, 90%","blue-500":"209, 100%, 80%","blue-600":"208, 100%, 66%","blue-700":"212, 100%, 48%","blue-800":"212, 100%, 41%","blue-900":"211, 100%, 42%","blue-1000":"211, 100%, 15%","red-100":"0, 100%, 97%","red-200":"0, 100%, 96%","red-300":"0, 100%, 95%","red-400":"0, 90%, 92%","red-500":"0, 82%, 85%","red-600":"359, 90%, 71%","red-700":"358, 75%, 59%","red-800":"358, 70%, 52%","red-900":"358, 66%, 48%","red-1000":"355, 49%, 15%","amber-100":"39, 100%, 95%","amber-200":"44, 100%, 92%","amber-300":"43, 96%, 90%","amber-400":"42, 100%, 78%","amber-500":"38, 100%, 71%","amber-600":"36, 90%, 62%","amber-700":"39, 100%, 57%","amber-800":"35, 100%, 52%","amber-900":"30, 100%, 32%","amber-1000":"20, 79%, 17%","green-100":"120, 60%, 96%","green-200":"120, 60%, 95%","green-300":"120, 60%, 91%","green-400":"122, 60%, 86%","green-500":"124, 60%, 75%","green-600":"125, 60%, 64%","green-700":"131, 41%, 46%","green-800":"132, 43%, 39%","green-900":"133, 50%, 32%","green-1000":"128, 29%, 15%","teal-100":"169, 70%, 96%","teal-200":"167, 70%, 94%","teal-300":"168, 70%, 90%","teal-400":"170, 70%, 85%","teal-500":"170, 70%, 72%","teal-600":"170, 70%, 57%","teal-700":"173, 80%, 36%","teal-800":"173, 83%, 30%","teal-900":"174, 91%, 25%","teal-1000":"171, 80%, 13%","purple-100":"276, 100%, 97%","purple-200":"277, 87%, 97%","purple-300":"274, 78%, 95%","purple-400":"276, 71%, 92%","purple-500":"274, 70%, 82%","purple-600":"273, 72%, 73%","purple-700":"272, 51%, 54%","purple-800":"272, 47%, 45%","purple-900":"274, 71%, 43%","purple-1000":"276, 100%, 15%","pink-100":"330, 100%, 96%","pink-200":"340, 90%, 96%","pink-300":"340, 82%, 94%","pink-400":"341, 76%, 91%","pink-500":"340, 75%, 84%","pink-600":"341, 75%, 73%","pink-700":"336, 80%, 58%","pink-800":"336, 74%, 51%","pink-900":"336, 65%, 45%","pink-1000":"333, 74%, 15%"};
const DARK = {"gray-100":"0, 0%, 10%","gray-200":"0, 0%, 12%","gray-300":"0, 0%, 16%","gray-400":"0, 0%, 18%","gray-500":"0, 0%, 27%","gray-600":"0, 0%, 53%","gray-700":"0, 0%, 56%","gray-800":"0, 0%, 49%","gray-900":"0, 0%, 63%","gray-1000":"0, 0%, 93%","background-100":"0, 0%, 4%","background-200":"0, 0%, 0%","blue-100":"216, 50%, 12%","blue-200":"214, 59%, 15%","blue-300":"213, 71%, 20%","blue-400":"212, 78%, 23%","blue-500":"211, 86%, 27%","blue-600":"206, 100%, 50%","blue-700":"212, 100%, 48%","blue-800":"212, 100%, 41%","blue-900":"210, 100%, 66%","blue-1000":"206, 100%, 96%","red-100":"357, 37%, 12%","red-200":"357, 46%, 16%","red-300":"356, 54%, 22%","red-400":"357, 55%, 26%","red-500":"357, 60%, 32%","red-600":"358, 75%, 59%","red-700":"358, 75%, 59%","red-800":"358, 69%, 52%","red-900":"358, 100%, 69%","red-1000":"353, 90%, 96%","amber-100":"35, 100%, 8%","amber-200":"32, 100%, 10%","amber-300":"33, 100%, 15%","amber-400":"35, 100%, 17%","amber-500":"35, 91%, 22%","amber-600":"39, 85%, 49%","amber-700":"39, 100%, 57%","amber-800":"35, 100%, 52%","amber-900":"39, 90%, 50%","amber-1000":"40, 94%, 93%","green-100":"136, 50%, 9%","green-200":"137, 50%, 12%","green-300":"136, 50%, 14%","green-400":"135, 70%, 16%","green-500":"135, 70%, 23%","green-600":"135, 70%, 34%","green-700":"131, 41%, 46%","green-800":"132, 43%, 39%","green-900":"131, 43%, 57%","green-1000":"136, 73%, 94%","teal-100":"169, 78%, 7%","teal-200":"170, 74%, 9%","teal-300":"171, 75%, 13%","teal-400":"171, 85%, 13%","teal-500":"172, 85%, 20%","teal-600":"172, 85%, 32%","teal-700":"173, 80%, 36%","teal-800":"173, 83%, 30%","teal-900":"174, 90%, 41%","teal-1000":"166, 71%, 93%","purple-100":"283, 30%, 12%","purple-200":"281, 38%, 16%","purple-300":"279, 44%, 23%","purple-400":"277, 46%, 28%","purple-500":"274, 49%, 35%","purple-600":"272, 51%, 54%","purple-700":"272, 51%, 54%","purple-800":"272, 47%, 45%","purple-900":"275, 80%, 71%","purple-1000":"281, 73%, 96%","pink-100":"335, 32%, 12%","pink-200":"335, 43%, 16%","pink-300":"335, 47%, 21%","pink-400":"335, 51%, 22%","pink-500":"335, 57%, 27%","pink-600":"336, 75%, 40%","pink-700":"336, 80%, 58%","pink-800":"336, 74%, 51%","pink-900":"341, 90%, 67%","pink-1000":"333, 90%, 96%"};
const ALPHA_LIGHT={100:"#0000000d",200:"#00000014",300:"#0000001a",400:"#00000014",500:"#00000036",600:"#00000057",700:"#00000070",800:"#00000082",900:"#000000b3",1000:"#000000e8"};
const ALPHA_DARK={100:"#ffffff0f",200:"#ffffff17",300:"#ffffff21",400:"#ffffff24",500:"#ffffff3d",600:"#ffffff82",700:"#ffffff8a",800:"#ffffff78",900:"#ffffff9c",1000:"#ffffffeb"};
const fams=["gray","blue","red","amber","green","teal","purple","pink"];
const steps=[100,200,300,400,500,600,700,800,900,1000];

function scale(map,ind){
  let s="";
  for(const fam of fams) for(const st of steps) s+=`${ind}--${fam}-${st}: hsl(${map[fam+"-"+st]});\n`;
  s+=`${ind}--background-100: hsl(${map["background-100"]});\n`;
  s+=`${ind}--background-200: hsl(${map["background-200"]});\n`;
  return s;
}
function alpha(a,ind){ let s=""; for(const st of steps) s+=`${ind}--gray-alpha-${st}: ${a[st]};\n`; return s; }

const APOS = String.fromCharCode(39); // avoid apostrophe literals in template

const header =
"/* ============================================================================\n" +
"   BRAND STYLE TOKENS  -  Geist design system (extracted from production)\n" +
"   ----------------------------------------------------------------------------\n" +
"   Drop this file in and reference the variables below. Light theme is the\n" +
"   default; dark theme activates via [data-theme=\"dark\"], .dark, or the OS\n" +
"   preference. Every color is a real token pulled from the live brand app.\n" +
"\n" +
"   Color model: 100 = subtlest (tints / backgrounds) up to 1000 = strongest\n" +
"   (text / solid fills). 700 is the canonical brand step for accent hues.\n" +
"   Accent hues are SEMANTIC: use them for state, not decoration. The system\n" +
"   is monochrome-first - gray plus one accent.\n" +
"   ============================================================================ */\n\n";

const light =
":root {\n" +
"  /* ---- type (DILS brand fonts — load via fonts.css) ---- */\n" +
"  --font-display: \"IvyMode\", \"Iowan Old Style\", Georgia, \"Times New Roman\", serif;\n" +
"  --font-sans: \"Nunito Sans\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;\n" +
"  --font-mono: ui-monospace, \"SF Mono\", \"Menlo\", \"Consolas\", monospace;\n\n" +
"  /* ---- radius (base 6px) ---- */\n" +
"  --radius-sm: 4px;\n  --radius: 6px;\n  --radius-md: 8px;\n  --radius-lg: 12px;\n  --radius-full: 9999px;\n\n" +
"  /* ---- spacing (4px grid) + layout ---- */\n  --space: 4px;\n  --page-width: 1200px;\n\n" +
"  /* ---- control heights ---- */\n  --height-sm: 32px;\n  --height-md: 40px;\n  --height-lg: 48px;\n\n" +
"  /* ---- color scales (light) ---- */\n" + scale(LIGHT,"  ") +
"  /* ---- transparent grays (light = black @ alpha) ---- */\n" + alpha(ALPHA_LIGHT,"  ") +
"  /* ---- semantic aliases ---- */\n" +
"  --background: var(--background-100);\n" +
"  --background-subtle: var(--background-200);\n" +
"  --foreground: var(--gray-1000);\n" +
"  --foreground-muted: var(--gray-900);\n" +
"  --foreground-subtle: var(--gray-700);\n" +
"  --border: var(--gray-alpha-400);\n" +
"  --border-strong: var(--gray-alpha-600);\n" +
"  --accent: var(--blue-700);\n" +
"  --accent-hover: var(--blue-800);\n" +
"  --success: var(--green-700);\n" +
"  --warning: var(--amber-700);\n" +
"  --error: var(--red-700);\n" +
"  --focus-ring: var(--blue-700);\n\n" +
"  /* ---- elevation: signature 1px hairline + ultra-soft layered shadow ---- */\n" +
"  --shadow-border: 0 0 0 1px var(--gray-alpha-400);\n" +
"  --shadow-sm: 0 0 0 1px var(--gray-alpha-200), 0px 1px 1px #00000005;\n" +
"  --shadow-md: 0 0 0 1px var(--gray-alpha-200), 0px 2px 2px #0000000a, 0px 8px 8px -8px #0000000a;\n" +
"  --shadow-lg: 0 0 0 1px var(--gray-alpha-200), 0px 2px 2px #0000000a, 0px 8px 16px -4px #0000000a;\n" +
"  --shadow-menu: 0 0 0 1px var(--gray-alpha-200), 0px 1px 1px #00000005, 0px 4px 8px -4px #0000000a, 0px 16px 24px -8px #0000000f;\n" +
"  --shadow-modal: 0 0 0 1px var(--gray-alpha-200), 0px 1px 1px #00000005, 0px 8px 16px -4px #0000000a, 0px 24px 32px -8px #0000000f;\n" +
"}\n\n";

const dark =
"/* ============================ DARK THEME ============================ */\n" +
".dark, [data-theme=\"dark\"] {\n" + scale(DARK,"  ") + alpha(ALPHA_DARK,"  ") +
"  --background: var(--background-100);\n" +
"  --background-subtle: var(--background-200);\n" +
"  --foreground: var(--gray-1000);\n" +
"  --accent: var(--blue-700);\n" +
"  --shadow-border: 0 0 0 1px var(--gray-alpha-400);\n" +
"  --shadow-sm: 0 0 0 1px var(--gray-alpha-300), 0px 1px 1px #00000040;\n" +
"  --shadow-md: 0 0 0 1px var(--gray-alpha-300), 0px 2px 2px #00000052, 0px 8px 8px -8px #00000029;\n" +
"  --shadow-lg: 0 0 0 1px var(--gray-alpha-300), 0px 2px 2px #00000052, 0px 8px 16px -4px #00000029;\n" +
"  --shadow-menu: 0 0 0 1px var(--gray-alpha-300), 0px 4px 8px -4px #00000052;\n" +
"  --shadow-modal: 0 0 0 1px var(--gray-alpha-300), 0px 8px 16px -4px #00000052, 0px 24px 32px -8px #00000040;\n" +
"}\n" +
"@media (prefers-color-scheme: dark) {\n" +
"  :root:not([data-theme=\"light\"]):not(.light) {\n" + scale(DARK,"    ") + alpha(ALPHA_DARK,"    ") +
"    --background: var(--background-100);\n    --foreground: var(--gray-1000);\n  }\n}\n\n";

const base =
"/* ============================ BASE / RESET ============================ */\n" +
"*, *::before, *::after { box-sizing: border-box; }\n" +
"* { margin: 0; }\n" +
"html { -webkit-text-size-adjust: 100%; font-feature-settings: \"rlig\" 1, \"calt\" 1; }\n" +
"body {\n" +
"  font-family: var(--font-sans);\n" +
"  background: var(--background);\n" +
"  color: var(--foreground);\n" +
"  font-size: 14px;\n  line-height: 1.5;\n" +
"  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n" +
"h1,h2,h3,h4,h5,h6 { line-height: 1.12; font-weight: 600; letter-spacing: -0.01em; }\n" +
"h1, h2 { font-family: var(--font-display); letter-spacing: -0.005em; }\n" +
"code, kbd, pre, samp { font-family: var(--font-mono); }\n" +
"a { color: var(--accent); text-decoration: none; }\n" +
"a:hover { text-decoration: underline; }\n" +
":focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }\n" +
"::selection { background: var(--blue-200); }\n";

const out = header + light + dark + base;
const dest = path.join(__dirname, "..", ".claude", "skills", "brand-style", "tokens.css");
fs.writeFileSync(dest, out);
console.log("wrote", dest, out.length, "bytes");
