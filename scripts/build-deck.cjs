/* Build the "How it works" deck: Geist brand style + DILS fonts + real app
   screenshots, fully self-contained. Run: node scripts/build-deck.cjs        */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SKILL = path.join(ROOT, ".claude", "skills", "brand-style");
const SHOTS = path.join(ROOT, "docs", "screenshots");
const TOKENS = fs.readFileSync(path.join(SKILL, "tokens.css"), "utf8");
const OUT = path.join(ROOT, "docs", "how-it-works.html");

// Embed the DILS brand fonts (woff2) as base64 @font-face — self-contained.
function fontFace(family, file, { weight = "400", style = "normal" } = {}) {
  const b64 = fs.readFileSync(path.join(SKILL, "fonts", file)).toString("base64");
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:${weight};font-style:${style};font-display:swap;}`;
}
const FONTS = [
  fontFace("IvyMode", "ivymode-semibold.woff2", { weight: "600" }),
  fontFace("Nunito Sans", "nunito-sans.woff2", { weight: "200 1000" }),
  fontFace("Nunito Sans", "nunito-sans-italic.woff2", { weight: "200 1000", style: "italic" }),
].join("\n");

async function dataUri(name) {
  const buf = await sharp(path.join(SHOTS, name + ".png"))
    .resize({ width: 1700, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return "data:image/jpeg;base64," + buf.toString("base64");
}

(async () => {
  const names = [
    "admin-01-dashboard", "admin-02-asset-overview", "admin-03-pipeline-table",
    "admin-05-invites", "admin-06-stages",
    "investor-01-portal", "investor-02-deal-journey", "viewer-02-asset-overview",
  ];
  const img = {};
  for (const n of names) { img[n] = await dataUri(n); console.log("embedded", n); }

  const frame = (name, label) => `
    <figure class="frame">
      <div class="frame-bar"><span class="d"></span><span class="d"></span><span class="d"></span><span class="frame-url">app.dils.com${label || ""}</span></div>
      <img src="${img[name]}" alt="${name}" loading="lazy" />
    </figure>`;

  const slides = [];

  // 1 — TITLE
  slides.push(`<section class="slide title">
    <div class="stagger">
      <div class="brand">DILS · Investor Portal</div>
      <h1>Investment&nbsp;Tracker</h1>
      <div class="accent-bar"></div>
      <p class="lead">A first look at one tool from the transformation team — how it works across the three people who use it, and where it's headed.</p>
      <div class="chips">
        <span class="chip"><span class="dot" style="background:var(--dils-red)"></span> Admin &amp; Editor</span>
        <span class="chip"><span class="dot" style="background:var(--gray-700)"></span> Investor</span>
        <span class="chip"><span class="dot" style="background:var(--gray-500)"></span> Viewer</span>
      </div>
    </div>
    <div class="hint">→ / ← or Space to navigate · F for fullscreen</div>
  </section>`);

  // 1a — WHY WE BUILD OUR OWN
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>The transformation team</span><h2>Why we build our own</h2></header>
    <p class="lead">DILS Next is where everything is heading. But a system that big has to move deliberately — and some day-to-day gaps can't wait for the roadmap. So a small team builds lightweight tools to close them now.</p>
    <div class="grid g3 stagger grow">
      <div class="card"><div class="ic">⚡</div><h3>Small &amp; fast</h3><p>A focused team ships working software in days, not quarters — and iterates straight from the people using it.</p></div>
      <div class="card"><div class="ic">◇</div><h3>Bridges, not detours</h3><p>Each tool targets a real gap DILS Next can't cover immediately, and is built so the work folds back into it later.</p></div>
      <div class="card"><div class="ic">∞</div><h3>Time compounds</h3><p>These take real effort to make — but the more we invest in our own tooling, the more it gives back. Each app makes the next one faster.</p></div>
    </div>
  </section>`);

  // 1a2 — A 0.5 APP, ON PURPOSE
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>What this is — and isn't</span><h2>A 0.5 app, on purpose</h2></header>
    <p class="lead">This is a <b>0.5</b> — deliberately lightweight and early. We only build tools that can be integrated and eventually taken over by the system. It exists to <b>enhance DILS Next</b>, never to compete with it.</p>
    <div class="cancan grow stagger">
      <div><h4 class="ok">What it is</h4><ul class="ticks tight"><li>A lightweight, focused tool</li><li>A fast way to prove &amp; de-risk functionality</li><li>Built to be absorbed into DILS Next</li><li>A temporary bridge, by design</li></ul></div>
      <div><h4 class="no">What it isn't</h4><ul class="ticks tight cross"><li>A replacement for DILS Next</li><li>A competitor to the main CRM</li><li>A permanent, standalone system</li><li>A finished, hands-off product</li></ul></div>
    </div>
  </section>`);

  // 1a3 — HOW IT FITS (diagram: apps absorbed into DILS Next)
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>How it fits</span><h2>Small apps in — capability folded into DILS Next</h2></header>
    <div class="grow center-v">
      <div class="fitmap stagger">
        <div class="fitcol">
          <div class="fitlabel">The team ships</div>
          <div class="apptile current"><span>Investment Tracker</span><span class="t05">0.5</span></div>
          <div class="apptile ghost"><span>Next 0.5 app</span></div>
          <div class="apptile ghost"><span>…</span></div>
        </div>
        <div class="fitflow"><span class="fitarrow">→</span><span class="fitflow-l">prove · de-risk · hand over</span></div>
        <div class="fitsys">
          <div class="fitsys-h">DILS Next</div>
          <div class="fitsys-sub">the system everything folds into</div>
          <div class="fitsys-inner">
            <span class="syschip">Main CRM</span>
            <span class="syschip">Core platform</span>
            <span class="syschip done">✓ Investment Tracker, absorbed</span>
          </div>
        </div>
      </div>
      <p class="cap fitcap">We build a focused 0.5, prove it works in real use, then hand it over — DILS&nbsp;Next absorbs the capability. The main CRM stays the main CRM; nothing is replaced.</p>
    </div>
  </section>`);

  // 2 — BIG PICTURE (roles + pipeline)
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>The big picture</span><h2>One system, three vantage points</h2></header>
    <p class="lead">Every deal is an <b>Asset</b>. Around it the platform tracks each interested <b>company</b> through a staged pipeline — and what you see depends entirely on who you are.</p>
    <div class="grid g3 stagger" style="margin-top:2.4vh">
      <div class="card"><div class="ic">⚙</div><h3>The operators</h3><p>Admin &amp; Editor build assets, drive the pipeline, invite investors, publish content, approve NDAs and record bids.</p><span class="tag tag-red">Admin / Editor</span></div>
      <div class="card"><div class="ic">↗</div><h3>The investor</h3><p>Sees only their own deals in a private portal and moves through a guided journey, step by step.</p><span class="tag">Investor</span></div>
      <div class="card"><div class="ic">◔</div><h3>The viewer</h3><p>The selling-side client. Watches deal flow &amp; bids for their own assets — read-only, no internal identities.</p><span class="tag">Viewer</span></div>
    </div>
    <div class="stagestrip stagger">
      <span class="sslabel">The deal lifecycle</span>
      <span class="sschip">Teaser</span><span class="ssar">→</span>
      <span class="sschip">NDA</span><span class="ssar">→</span>
      <span class="sschip">IM</span><span class="ssar">→</span>
      <span class="sschip">Viewing</span><span class="ssar">→</span>
      <span class="sschip">NBO</span>
      <span class="ssnote">configurable · same spine drives every view</span>
    </div>
    <footer class="foot"><span class="mono">investment-tracker</span><span>Next.js · Prisma · PostgreSQL · NextAuth · server-side RBAC</span></footer>
  </section>`);

  // 3 — ADMIN: PIPELINE TABLE (HERO)
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>Admin &amp; Editor · running a deal</span><h2>The pipeline table does the work</h2></header>
    <div class="hero-wrap grow">
      ${frame("admin-03-pipeline-table", "/assets/…")}
      <div class="hero-notes">
        <p><b>One row per company.</b> Inline-edit stage status, lifecycle, interest &amp; owner.</p>
        <p><b>Bids</b> recorded per investor; <b>comments</b> threaded per row.</p>
        <p><b>Stale rows</b> (14 days+) flagged. <b>Filter, search &amp; CSV export.</b></p>
        <p class="mono note-dim">Every change → Stage History + Activity Log</p>
      </div>
    </div>
  </section>`);

  // 4 — ADMIN: DASHBOARD + OVERVIEW
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>Admin &amp; Editor · the workspace</span><h2>Run the whole portfolio from one place</h2></header>
    <div class="two-up grow stagger">
      <div>${frame("admin-01-dashboard", "/")}<p class="cap"><b>Dashboard</b> — every asset with sector tint &amp; pipeline count, plus portfolio KPIs: 2 assets · 23 investors in pipeline · 2 active deals.</p></div>
      <div>${frame("admin-02-asset-overview", "/assets/…")}<p class="cap"><b>Per-asset overview</b> — the stage funnel with conversion, action banners (NDAs to approve, viewings requested) and the lifecycle split.</p></div>
    </div>
  </section>`);

  // 5 — ADMIN: ONBOARD + CONFIGURE
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>Admin · onboard &amp; configure</span><h2>Invite investors. Tune the pipeline.</h2></header>
    <div class="two-up grow stagger">
      <div>${frame("admin-05-invites", "/admin/invites")}<p class="cap"><b>Investors</b> — invite, resend &amp; track delivered / opened with account status. Publish per-stage content &amp; the master NDA, then <b>approve</b> the signed NDA to unlock the IM.</p></div>
      <div>${frame("admin-06-stages", "/admin/stages")}<p class="cap"><b>Stages &amp; Team</b> — rename, reorder and toggle the pipeline stages that drive every deal; manage users, roles and password resets.</p></div>
    </div>
  </section>`);

  // 6 — INVESTOR (portal + journey)
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>Investor · the private portal</span><h2>Pursue the deal, step by step</h2></header>
    <div class="two-up grow stagger">
      <div>${frame("investor-01-portal", "/portal")}<p class="cap"><b>“Your active opportunities”</b> — a separate branded portal showing only their deals (by company membership), each with a live stage tracker.</p></div>
      <div>${frame("investor-02-deal-journey", "/portal/…")}<p class="cap"><b>The guided journey</b> — stages unlock progressively: sign the NDA, access the IM, request a viewing and submit a bid — all in the browser.</p></div>
    </div>
  </section>`);

  // 7 — VIEWER
  slides.push(`<section class="slide split">
    <div class="col-text">
      <header class="shead"><span class="kicker"><i></i>Viewer · the client lens</span><h2>Transparency, scoped &amp; read-only</h2></header>
      <div class="cancan stagger">
        <div><h4 class="ok">Can see</h4><ul class="ticks tight"><li>Only <b>their</b> assets (per-asset grant)</li><li>Pipeline progress &amp; conversion</li><li>Bids &amp; offer documents</li><li>Lifecycle status</li></ul></div>
        <div><h4 class="no">Cannot</h4><ul class="ticks tight cross"><li>Edit anything (read-only)</li><li>See individual contacts / emails</li><li>See DILS staff identities</li><li>See deals not granted</li></ul></div>
      </div>
      <span class="tag">Viewer · READ-ONLY</span>
    </div>
    <div class="col-img">${frame("viewer-02-asset-overview", "/assets/…")}</div>
  </section>`);

  // 7b — FOLLOW ONE DEAL (the three roles converge)
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>One deal, every hand</span><h2>Watch a single deal move through the system</h2></header>
    <div class="timeline grow stagger">
      <div class="tstep"><div class="tnum">1</div><div class="tbody"><span class="trole admin">Admin</span><p>Invites the investor by email — a portal account, scoped to this deal, is created.</p></div></div>
      <div class="tstep"><div class="tnum">2</div><div class="tbody"><span class="trole investor">Investor</span><p>Logs in, reviews the teaser and <b>signs the NDA</b> in the browser.</p></div></div>
      <div class="tstep"><div class="tnum">3</div><div class="tbody"><span class="trole admin">Admin</span><p>Reviews and <b>approves</b> the NDA — the Information Memorandum unlocks for that investor.</p></div></div>
      <div class="tstep"><div class="tnum">4</div><div class="tbody"><span class="trole investor">Investor</span><p>Reads the IM and <b>requests a viewing</b>; the deal team is notified.</p></div></div>
      <div class="tstep"><div class="tnum">5</div><div class="tbody"><span class="trole investor">Investor</span><p>After the viewing, submits a <b>€24.5M non-binding offer</b>.</p></div></div>
      <div class="tstep payoff"><div class="tnum">✓</div><div class="tbody"><span class="trole admin">Admin</span><span class="trole viewer">Viewer</span><p>The bid lands <b>instantly</b> on the admin pipeline table <i>and</i> the seller's read-only view — same deal, three vantage points, one source of truth.</p></div></div>
    </div>
    <footer class="foot"><span class="mono">investment-tracker</span><span>No spreadsheets, no email chains — the deal record moves with the deal</span></footer>
  </section>`);

  // 7c — ANIMATED BACKEND / SECURITY WORKFLOW
  const flowSvcs = [
    { y: 80,  name: "PostgreSQL",        via: "Supabase · connection pooling", badge: "PRO" },
    { y: 172, name: "Object storage",    via: "Supabase · signed URLs",        badge: "" },
    { y: 264, name: "Auth + rate-limit", via: "NextAuth · Upstash Redis",      badge: "PRO" },
    { y: 356, name: "Email API",         via: "Mailgun · paid domain",         badge: "PAID" },
  ];
  const svgServices = flowSvcs.map((s, idx) => `
      <path class="fl-base" d="M752,278 C 840,278 832,${s.y} 918,${s.y}"/>
      <path class="fl-dash" d="M752,278 C 840,278 832,${s.y} 918,${s.y}" style="animation-delay:${(idx * 0.18).toFixed(2)}s"/>
      <rect class="n-box" x="920" y="${s.y - 34}" width="252" height="68" rx="10"/>
      <text class="n-title" x="940" y="${s.y - 5}" font-size="16.5">${s.name}</text>
      <text class="n-item" x="940" y="${s.y + 16}" font-size="12.5">${s.via}</text>
      ${s.badge ? `<g class="glow"><rect class="badge-pro" x="1112" y="${s.y - 28}" width="48" height="19" rx="9.5"/><text class="badge-txt" x="1136" y="${s.y - 14.5}" font-size="10.5" text-anchor="middle">${s.badge}</text></g>` : ""}`).join("");

  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>Backend workflow · live</span><h2>How it connects — and where security runs</h2></header>
    <div class="grow flowwrap">
      <svg viewBox="0 0 1200 560" class="flowsvg" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        <rect class="n-box" x="30" y="232" width="172" height="96" rx="12"/>
        <text class="n-title" x="116" y="276" font-size="18" text-anchor="middle">Client</text>
        <text class="n-sub" x="116" y="298" font-size="11.5" text-anchor="middle">Browser · all roles</text>
        <path class="fl-base" d="M202,284 C 320,284 320,278 430,278"/>
        <path class="fl-dash" d="M202,284 C 320,284 320,278 430,278"/>
        <rect class="n-app" x="430" y="150" width="322" height="252" rx="16"/>
        <text class="n-title" x="450" y="185" font-size="20">Our servers · Vercel</text>
        <text class="n-sub" x="450" y="206" font-size="12">Next.js 14 · Edge · WAF firewall</text>
        <rect class="seclayer" x="450" y="224" width="282" height="62" rx="10"/>
        <text class="n-eyebrow" x="464" y="245" font-size="10">SECURITY LAYER</text>
        <text class="n-item" x="464" y="266" font-size="12.5">Server-side RBAC · rate-limit · signed URLs</text>
        <text class="n-item" x="450" y="320" font-size="12.5">Server Components · Server Actions · API routes</text>
        <g class="glow"><circle cx="718" cy="176" r="15" fill="var(--dils-red)" opacity="0.16"/><text x="718" y="182" font-size="15" text-anchor="middle">🔒</text></g>
        <text class="n-eyebrow" x="836" y="34" font-size="10" text-anchor="middle">REST APIs</text>
        ${svgServices}
        <rect class="n-agents" x="430" y="442" width="322" height="104" rx="14"/>
        <text class="n-title" x="450" y="478" font-size="18">AI security agents</text>
        <text class="n-item" x="450" y="500" font-size="12.5">QA · pen-test · load-test · ISO 27001</text>
        <text class="n-sub" x="450" y="521" font-size="11.5">Continuous automated security runs</text>
        <path class="fl-base" d="M591,442 L591,402"/>
        <path class="fl-dash" d="M591,442 L591,402" style="animation-delay:.3s"/>
        <circle class="scanring" cx="591" cy="255" r="6" fill="none" stroke="var(--dils-red)" stroke-width="1.5"/>
      </svg>
    </div>
    <p class="cap flowcap"><span class="legdot"></span> Live data flow · <b>paid tiers (PRO)</b> add the WAF, connection pooling, deliverability &amp; security headroom — and our <b>AI agents audit it continuously</b>.</p>
  </section>`);

  // 8 — SECURITY
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>Trust by design</span><h2>Security underneath every role</h2></header>
    <div class="grid g3 stagger grow">
      <div class="card"><div class="ic">▣</div><h3>Server-side RBAC</h3><p>Roles checked on every protected route &amp; action — the UI never grants what the backend hasn't.</p></div>
      <div class="card"><div class="ic">≣</div><h3>Full audit trail</h3><p>Stage History + Activity Log record who changed what, when.</p></div>
      <div class="card"><div class="ic">⟲</div><h3>Session invalidation</h3><p>Deactivating a user or rotating a password kills live sessions immediately.</p></div>
      <div class="card"><div class="ic">◷</div><h3>Rate-limited auth</h3><p>Login fails closed under attack; <span class="mono">/launch-mode</span> safely triples limits for onboarding bursts.</p></div>
      <div class="card"><div class="ic">⛓</div><h3>Signed, expiring URLs</h3><p>Documents &amp; images served via short-lived links — no permanent public files.</p></div>
      <div class="card"><div class="ic">⁘</div><h3>Unguessable tokens</h3><p>Invite &amp; signing tokens are CSPRNG secrets with expiry, required explicitly.</p></div>
    </div>
  </section>`);

  // 9 — MATRIX
  slides.push(`<section class="slide">
    <header class="shead"><span class="kicker"><i></i>At a glance</span><h2>Who can do what</h2></header>
    <div class="grow center-v">
    <table class="matrix">
      <thead><tr><th>Capability</th><th>Admin</th><th>Editor</th><th>Investor</th><th>Viewer</th></tr></thead>
      <tbody>
        <tr><td>Create &amp; edit assets / pipeline</td><td class="y">●</td><td class="y">●</td><td class="n">—</td><td class="n">—</td></tr>
        <tr><td>Invite investors &amp; publish content</td><td class="y">●</td><td class="y">●</td><td class="n">—</td><td class="n">—</td></tr>
        <tr><td>Approve NDAs · manage users &amp; stages</td><td class="y">●</td><td class="n">—</td><td class="n">—</td><td class="n">—</td></tr>
        <tr><td>Sign NDA · request viewing · bid</td><td class="n">—</td><td class="n">—</td><td class="y">●</td><td class="n">—</td></tr>
        <tr><td>Private portal of own deals</td><td class="n">—</td><td class="n">—</td><td class="y">●</td><td class="n">—</td></tr>
        <tr><td>Scoped deal flow &amp; bids (read-only)</td><td class="y">●</td><td class="y">●</td><td class="n">—</td><td class="y">●</td></tr>
        <tr><td>See individual contacts / staff (PII)</td><td class="y">●</td><td class="y">●</td><td class="y">●</td><td class="n">—</td></tr>
      </tbody>
    </table>
    </div>
    <footer class="foot"><span class="mono">investment-tracker</span><span>One platform · three vantage points · deal-flow end to end</span></footer>
  </section>`);

  // CLOSING — a working start, built to hand over
  slides.push(`<section class="slide title">
    <div class="stagger">
      <div class="brand">DILS · Transformation Team</div>
      <h1>A working start —<br>built to hand over.</h1>
      <div class="accent-bar"></div>
      <p class="lead">For now it runs under close watch — it's a 0.5, not a finished product. But it's real, it's in use, and it's exactly the kind of tool meant to fold into DILS Next. This could be the first one we hand over.</p>
      <div class="chips">
        <span class="chip">Real &amp; in use</span>
        <span class="chip">Light &amp; absorbable</span>
        <span class="chip">First hand-over candidate</span>
      </div>
    </div>
    <div class="hint">Thank you · ← to review</div>
  </section>`);

  const CSS = `
  :root { --dils-red: #e5302a; --accent: var(--dils-red); --focus-ring: var(--dils-red); }
  * { box-sizing: border-box; margin: 0; }
  html, body { height: 100%; }
  body { font-family: var(--font-sans); background: #0a0a0a; color: var(--foreground); -webkit-font-smoothing: antialiased; overflow: hidden; }
  #deck { position: relative; width: 100vw; height: 100vh; }

  .slide { position: absolute; inset: 0; display: none; flex-direction: column; padding: 5.4vh 5.2vw; background: var(--background-100); overflow: hidden; }
  .slide.active { display: flex; animation: fade .45s ease both; }
  @keyframes fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .grow { flex: 1; min-height: 0; }
  .center-v { display: flex; flex-direction: column; justify-content: center; }

  .slide.active .stagger > * { animation: rise .5s cubic-bezier(.2,.7,.2,1) both; }
  .slide.active .stagger > *:nth-child(1){animation-delay:.04s}
  .slide.active .stagger > *:nth-child(2){animation-delay:.10s}
  .slide.active .stagger > *:nth-child(3){animation-delay:.16s}
  .slide.active .stagger > *:nth-child(4){animation-delay:.22s}
  @keyframes rise { from { opacity:0; transform: translateY(12px);} to {opacity:1; transform:none;} }

  .kicker { display: inline-flex; align-items: center; gap: .55rem; font-size: .72rem; font-weight: 600; letter-spacing: .16em; text-transform: uppercase; color: var(--foreground-subtle); }
  .kicker i { width: 22px; height: 2px; background: var(--dils-red); display: inline-block; }
  h1 { font-family: var(--font-display); font-size: clamp(2.3rem, 5.2vw, 4.2rem); font-weight: 600; letter-spacing: -.01em; line-height: 1.05; }
  h2 { font-family: var(--font-display); font-size: clamp(1.6rem, 2.9vw, 2.5rem); font-weight: 600; letter-spacing: -.01em; margin-top: .5rem; line-height: 1.08; }
  h3 { font-size: 1.02rem; font-weight: 700; letter-spacing: -.01em; }
  .lead { font-size: clamp(.95rem, 1.35vw, 1.15rem); color: var(--foreground-muted); max-width: 70ch; line-height: 1.55; }
  .mono { font-family: var(--font-mono); }
  .shead { margin-bottom: 2.2vh; }

  .grid { display: grid; gap: 1rem; }
  .grid.grow { align-content: center; }
  .g3 { grid-template-columns: repeat(3, 1fr); }
  .card { background: var(--background-100); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.3rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: .5rem; }
  .card .ic { width: 36px; height: 36px; border-radius: var(--radius); background: var(--background-200); border: 1px solid var(--border); display: grid; place-items: center; font-size: 1.05rem; color: var(--foreground); }
  .card p { font-size: .9rem; color: var(--foreground-subtle); line-height: 1.5; flex: 1; }
  .tag { align-self: flex-start; font-size: .66rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: .3rem .6rem; border-radius: var(--radius-full); background: var(--gray-100); color: var(--gray-900); border: 1px solid var(--gray-alpha-300); }
  .tag-red { background: var(--dils-red); color: #fff; border-color: transparent; }

  /* stage strip */
  .stagestrip { display: flex; align-items: center; gap: .55rem; flex-wrap: wrap; margin-top: 2.6vh; padding-top: 2.4vh; border-top: 1px solid var(--border); }
  .sslabel { font-size: .7rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--foreground-subtle); margin-right: .4rem; }
  .sschip { font-size: .92rem; font-weight: 600; color: var(--foreground); background: var(--background-200); border: 1px solid var(--border); border-radius: var(--radius-full); padding: .34rem .85rem; }
  .ssar { color: var(--gray-500); font-weight: 700; }
  .ssnote { font-size: .8rem; color: var(--foreground-subtle); margin-left: .6rem; }

  ul.ticks { list-style: none; display: flex; flex-direction: column; gap: .85rem; margin: .3rem 0 1.4rem; }
  ul.ticks.tight { gap: .5rem; margin: .4rem 0 0; }
  ul.ticks li { position: relative; padding-left: 1.5rem; font-size: .96rem; color: var(--foreground-muted); line-height: 1.5; }
  ul.ticks.tight li { font-size: .9rem; }
  ul.ticks li::before { content: "→"; position: absolute; left: 0; top: 0; color: var(--dils-red); font-weight: 700; }
  ul.ticks.cross li::before { content: "×"; }
  ul.ticks li b { color: var(--foreground); font-weight: 600; }

  .frame { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-lg); background: var(--background-100); width: 100%; }
  .frame-bar { display: flex; align-items: center; gap: .4rem; padding: .55rem .8rem; background: var(--background-200); border-bottom: 1px solid var(--border); }
  .frame-bar .d { width: 9px; height: 9px; border-radius: 50%; background: var(--gray-400); }
  .frame-url { margin-left: .6rem; font-family: var(--font-mono); font-size: .68rem; color: var(--foreground-subtle); background: var(--background-100); border: 1px solid var(--border); border-radius: var(--radius-full); padding: .12rem .7rem; }
  .frame img { display: block; width: 100%; height: auto; }

  .slide.split { display: none; }
  .slide.split.active { display: grid; grid-template-columns: 0.92fr 1.08fr; gap: 3vw; align-items: center; }
  .col-text { display: flex; flex-direction: column; justify-content: center; }
  .col-img { display: flex; align-items: center; }

  .hero-wrap { display: grid; grid-template-columns: 1.55fr 1fr; gap: 2vw; align-items: center; }
  .hero-notes { display: flex; flex-direction: column; gap: 1rem; }
  .hero-notes p { font-size: .95rem; color: var(--foreground-muted); line-height: 1.45; }
  .hero-notes p b { color: var(--foreground); }
  .note-dim { color: var(--foreground-subtle); font-size: .8rem; border-top: 1px solid var(--border); padding-top: 1rem; }

  .two-up { display: grid; grid-template-columns: 1fr 1fr; gap: 2.4vw; align-items: start; }
  .cap { font-size: .9rem; color: var(--foreground-subtle); line-height: 1.5; margin-top: 1rem; }
  .cap b { color: var(--foreground); }

  .cancan { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6rem; margin: .4rem 0 1.4rem; }
  h4.ok, h4.no { font-size: .74rem; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; }
  h4.ok { color: var(--success); } h4.no { color: var(--error); }

  /* before / after */
  .beforeafter { display: grid; grid-template-columns: 1fr 1fr; gap: 1.6rem; align-content: center; }
  .ba { border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.5rem 1.6rem; background: var(--background-100); }
  .ba.before { background: var(--background-200); }
  .ba.after { box-shadow: var(--shadow-md); }
  .ba-head { display: flex; flex-direction: column; gap: .55rem; margin-bottom: 1.1rem; }
  .lbl { align-self: flex-start; font-size: .64rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: .28rem .6rem; border-radius: var(--radius-full); }
  .lbl-gray { background: var(--gray-200); color: var(--gray-900); }
  .lbl-red { background: var(--dils-red); color: #fff; }
  .ba ul { list-style: none; display: flex; flex-direction: column; gap: .8rem; }
  .ba li { position: relative; padding-left: 1.5rem; font-size: .94rem; line-height: 1.45; color: var(--foreground-muted); }
  .ba.before li { color: var(--foreground-subtle); }
  .ba.before li::before { content: "×"; position: absolute; left: 0; color: var(--gray-500); font-weight: 700; }
  .ba.after li::before { content: "→"; position: absolute; left: 0; color: var(--dils-red); font-weight: 700; }

  /* how-it-fits diagram */
  .fitmap { display: grid; grid-template-columns: auto auto 1fr; gap: 2.4vw; align-items: center; }
  .fitcol { display: flex; flex-direction: column; gap: .7rem; }
  .fitlabel { font-size: .66rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--foreground-subtle); margin-bottom: .1rem; }
  .apptile { border: 1px solid var(--border); border-radius: var(--radius); padding: .75rem .9rem; background: var(--background-100); box-shadow: var(--shadow-sm); display: flex; align-items: center; justify-content: space-between; gap: .7rem; font-weight: 600; font-size: .92rem; min-width: 210px; }
  .apptile.current { border-color: var(--dils-red); box-shadow: var(--shadow-md); }
  .apptile .t05 { font-family: var(--font-mono); font-size: .64rem; font-weight: 700; color: #fff; background: var(--dils-red); border-radius: var(--radius-full); padding: .14rem .5rem; }
  .apptile.ghost { background: var(--background-200); border-style: dashed; color: var(--foreground-subtle); font-weight: 500; box-shadow: none; }
  .fitflow { display: flex; flex-direction: column; align-items: center; gap: .35rem; }
  .fitarrow { font-size: 1.7rem; color: var(--dils-red); line-height: 1; }
  .fitflow-l { font-size: .68rem; letter-spacing: .03em; max-width: 96px; text-align: center; line-height: 1.35; color: var(--foreground-subtle); }
  .fitsys { border: 1.5px solid var(--gray-1000); border-radius: var(--radius-lg); padding: 1.4rem 1.6rem; background: var(--background-200); box-shadow: var(--shadow-md); }
  .fitsys-h { font-family: var(--font-display); font-size: 1.55rem; font-weight: 600; line-height: 1; }
  .fitsys-sub { font-size: .84rem; color: var(--foreground-subtle); margin: .35rem 0 1rem; }
  .fitsys-inner { display: flex; flex-wrap: wrap; gap: .5rem; }
  .syschip { font-size: .82rem; font-weight: 600; padding: .42rem .8rem; border-radius: var(--radius-full); background: var(--background-100); border: 1px solid var(--border); }
  .syschip.done { border-color: transparent; background: var(--green-100); color: var(--green-900); }
  .fitcap { margin-top: 2.2rem; max-width: 82ch; }

  /* architecture diagram */
  .arch { display: grid; grid-template-columns: 1fr auto 1.25fr auto 1fr; gap: 1.2vw; align-items: stretch; }
  .arch-box { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--background-100); box-shadow: var(--shadow-sm); padding: 1.2rem 1.3rem; display: flex; flex-direction: column; }
  .arch-box.app { border: 1.5px solid var(--dils-red); box-shadow: var(--shadow-md); }
  .arch-h { font-family: var(--font-display); font-size: 1.15rem; font-weight: 600; line-height: 1.1; }
  .arch-sub { font-size: .68rem; color: var(--foreground-subtle); margin: .3rem 0 .9rem; text-transform: uppercase; letter-spacing: .06em; }
  .arch-box ul { list-style: none; display: flex; flex-direction: column; gap: .5rem; }
  .arch-box li { font-size: .86rem; color: var(--foreground-muted); padding-left: 1rem; position: relative; line-height: 1.35; }
  .arch-box li::before { content: "·"; position: absolute; left: .15rem; color: var(--dils-red); font-weight: 700; }
  .arch-arrow { display: flex; align-items: center; justify-content: center; color: var(--dils-red); font-size: 1.5rem; }
  .stackline { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: 2.4vh; }
  .stackchip { font-size: .74rem; font-weight: 600; font-family: var(--font-mono); color: var(--foreground-subtle); background: var(--background-200); border: 1px solid var(--border); border-radius: var(--radius-full); padding: .26rem .6rem; }
  .archcap { margin-top: 1.6rem; max-width: 84ch; }

  /* animated backend / security workflow */
  .flowwrap { display: flex; align-items: center; justify-content: center; }
  .flowsvg { width: 100%; height: 100%; max-height: 66vh; }
  .n-box { fill: var(--background-100); stroke: var(--border); stroke-width: 1.5; }
  .n-app { fill: var(--background-100); stroke: var(--dils-red); stroke-width: 2; }
  .n-agents { fill: var(--background-200); stroke: var(--border); stroke-width: 1.5; }
  .seclayer { fill: var(--background-200); stroke: var(--gray-alpha-300); stroke-width: 1; }
  .n-title { fill: var(--foreground); font-family: var(--font-display); font-weight: 600; }
  .n-sub { fill: var(--foreground-subtle); font-family: var(--font-sans); }
  .n-item { fill: var(--foreground-muted); font-family: var(--font-sans); }
  .n-eyebrow { fill: var(--foreground-subtle); font-family: var(--font-sans); font-weight: 700; letter-spacing: .12em; }
  .badge-pro { fill: var(--dils-red); }
  .badge-txt { fill: #fff; font-family: var(--font-mono); font-weight: 700; }
  .fl-base { fill: none; stroke: var(--gray-300); stroke-width: 2; }
  .fl-dash { fill: none; stroke: var(--dils-red); stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 2.5 14; }
  .slide.active .fl-dash { animation: flowdash 1s linear infinite; }
  @keyframes flowdash { to { stroke-dashoffset: -33; } }
  .slide.active .glow { animation: softglow 2s ease-in-out infinite; }
  @keyframes softglow { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
  .slide.active .scanring { animation: scanring 2.2s ease-out infinite; }
  @keyframes scanring { 0% { r: 6; opacity: .55; } 100% { r: 34; opacity: 0; } }
  .flowcap { margin-top: 1.4vh; display: flex; align-items: center; gap: .5rem; }
  .legdot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--dils-red); flex: none; }

  /* lifecycle timeline */
  .timeline { display: flex; flex-direction: column; justify-content: center; gap: 0; }
  .tstep { display: grid; grid-template-columns: 40px 1fr; gap: 1.1rem; padding: .62rem 0; position: relative; }
  .tstep:not(:last-child)::before { content: ""; position: absolute; left: 19px; top: 38px; bottom: -4px; width: 2px; background: var(--border); }
  .tnum { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border); background: var(--background-100); display: grid; place-items: center; font-family: var(--font-mono); font-weight: 700; font-size: .9rem; color: var(--foreground); z-index: 1; box-shadow: var(--shadow-sm); }
  .tbody { display: flex; align-items: center; gap: .7rem; flex-wrap: wrap; min-height: 40px; }
  .trole { font-size: .6rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: .26rem .55rem; border-radius: var(--radius-full); }
  .trole.admin { background: var(--dils-red); color: #fff; }
  .trole.investor { background: var(--gray-1000); color: #fff; }
  .trole.viewer { background: var(--gray-200); color: var(--gray-900); border: 1px solid var(--gray-alpha-300); }
  .tstep p { font-size: .98rem; color: var(--foreground-muted); line-height: 1.4; }
  .tstep p b { color: var(--foreground); font-weight: 600; }
  .tstep.payoff .tnum { background: var(--dils-red); color: #fff; border-color: transparent; }
  .tstep.payoff p { color: var(--foreground); }

  table.matrix { width: 100%; border-collapse: collapse; border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
  table.matrix th, table.matrix td { padding: .85rem 1.1rem; text-align: left; font-size: .92rem; border-bottom: 1px solid var(--border); }
  table.matrix thead th { background: var(--gray-1000); color: #fff; font-size: .7rem; letter-spacing: .08em; text-transform: uppercase; font-weight: 600; }
  table.matrix th:not(:first-child), table.matrix td:not(:first-child) { text-align: center; width: 13%; }
  table.matrix tbody td:first-child { font-weight: 500; color: var(--foreground); }
  table.matrix tbody tr:nth-child(even) { background: var(--background-200); }
  table.matrix tbody tr:last-child td { border-bottom: none; }
  table.matrix .y { color: var(--success); font-weight: 800; }
  table.matrix .n { color: var(--gray-500); }

  .slide.title { background: #0a0a0a; justify-content: center; }
  .slide.title * { color: #fff; }
  .slide.title .lead { color: rgba(255,255,255,.66); max-width: 60ch; }
  .brand { font-size: .82rem; font-weight: 700; letter-spacing: .26em; text-transform: uppercase; color: rgba(255,255,255,.7) !important; }
  .title h1 { margin: 1.3rem 0 0; max-width: 16ch; }
  .accent-bar { width: 56px; height: 4px; background: var(--dils-red); border-radius: 4px; margin: 1.4rem 0; }
  .chips { display: flex; gap: .7rem; margin-top: 2.2rem; flex-wrap: wrap; }
  .chip { display: inline-flex; align-items: center; gap: .55rem; font-size: .86rem; color: rgba(255,255,255,.85) !important; border: 1px solid rgba(255,255,255,.16); padding: .5rem .9rem; border-radius: var(--radius); }
  .dot { width: 9px; height: 9px; border-radius: 50%; }

  .foot { margin-top: auto; padding-top: 2.4vh; padding-right: 160px; display: flex; justify-content: space-between; align-items: center; font-size: .72rem; color: var(--foreground-subtle); border-top: 1px solid var(--border); }
  .foot .mono { color: var(--foreground-muted); }
  .hint { position: absolute; left: 5.2vw; bottom: 4vh; font-size: .74rem; color: rgba(255,255,255,.4) !important; }

  #progress { position: fixed; top: 0; left: 0; height: 3px; background: var(--dils-red); width: 0; z-index: 60; transition: width .35s ease; }
  #chrome { position: fixed; bottom: 1.3rem; right: 1.6rem; z-index: 60; display: flex; align-items: center; gap: .7rem; background: rgba(10,10,10,.82); backdrop-filter: blur(8px); padding: .45rem .6rem; border-radius: var(--radius-full); border: 1px solid rgba(255,255,255,.12); }
  #chrome button { background: none; border: none; color: #fff; cursor: pointer; font-size: 1.1rem; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; }
  #chrome button:hover { background: rgba(255,255,255,.14); }
  #counter { color: #fff; font-size: .78rem; font-variant-numeric: tabular-nums; min-width: 50px; text-align: center; font-weight: 600; }
  #dots { position: fixed; bottom: 1.55rem; left: 1.6rem; z-index: 60; display: flex; gap: .35rem; }
  #dots .dt { width: 7px; height: 7px; border-radius: 50%; background: var(--gray-alpha-400); cursor: pointer; transition: all .25s; }
  #dots .dt.on { background: var(--dils-red); width: 20px; border-radius: 4px; }

  @media (max-width: 860px) {
    .g3, .hero-wrap, .cancan, .two-up { grid-template-columns: 1fr; display: grid; }
    .slide.split.active { grid-template-columns: 1fr; }
    .slide { overflow-y: auto; }
  }
  `;

  const html = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Investment Tracker — How It Works</title>
<style>
${FONTS}
${TOKENS}
${CSS}
</style>
</head>
<body>
<div id="progress"></div>
<div id="deck">
${slides.join("\n")}
</div>
<div id="dots"></div>
<div id="chrome"><button id="prev">‹</button><span id="counter">1</span><button id="next">›</button></div>
<script>
  const slides = [...document.querySelectorAll('.slide')];
  const total = slides.length, dotsWrap = document.getElementById('dots');
  let i = 0;
  const counter = document.getElementById('counter'), progress = document.getElementById('progress');
  slides.forEach((_, n) => { const d = document.createElement('div'); d.className='dt'+(n===0?' on':''); d.onclick=()=>go(n); dotsWrap.appendChild(d); });
  const dots = [...dotsWrap.children];
  function go(n){ n=Math.max(0,Math.min(total-1,n)); slides[i].classList.remove('active'); dots[i].classList.remove('on'); i=n; slides[i].classList.add('active'); dots[i].classList.add('on'); counter.textContent=(i+1)+' / '+total; progress.style.width=(i/(total-1)*100)+'%'; }
  const next=()=>go(i+1), prev=()=>go(i-1);
  document.getElementById('next').onclick=next; document.getElementById('prev').onclick=prev;
  document.addEventListener('keydown', e => {
    if(['ArrowRight',' ','PageDown'].includes(e.key)){e.preventDefault();next();}
    else if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();prev();}
    else if(e.key==='Home')go(0); else if(e.key==='End')go(total-1);
    else if(e.key.toLowerCase()==='f'){ if(!document.fullscreenElement)document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); }
  });
  let sx=0; document.addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true});
  document.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx; if(Math.abs(dx)>50)dx<0?next():prev();},{passive:true});
  go(0);
</script>
</body>
</html>`;

  fs.writeFileSync(OUT, html);
  console.log("\nwrote", OUT, (html.length/1024/1024).toFixed(2), "MB ·", slides.length, "slides");
})();
