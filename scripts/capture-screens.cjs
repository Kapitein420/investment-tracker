/* Headless capture of real app screens for the presentation.
   Logs in as each role and saves PNGs to docs/screenshots/.
   Prereq: dev server running on http://localhost:3000 + DB seeded.
   Run: node scripts/capture-screens.cjs                                 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const BASE = "http://localhost:3000";
const OUT = path.join(__dirname, "..", "docs", "screenshots");
fs.mkdirSync(OUT, { recursive: true });

const ASSET_MAIN = "cmqjlabmc0009ttzkqx9y63ap"; // Generaal Vetterstraat 82 (18 cos)
const ASSET_TEST = "test_asset_001";            // Keizersgracht 250 (investor deal)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function attemptLogin(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector("input[type=email]", { timeout: 15000 });
  // Clear + fill (in case of a retry on the same page)
  await page.$eval("input[type=email]", (el) => (el.value = ""));
  await page.$eval("input[type=password]", (el) => (el.value = ""));
  await page.type("input[type=email]", email, { delay: 12 });
  await page.type("input[type=password]", password, { delay: 12 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Sign in");
    b && b.click();
  });
  // Wait until we actually leave /login (NextAuth does a client-side redirect,
  // not a full navigation) — poll the pathname for up to 20s.
  try {
    await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 20000 });
  } catch {
    return false;
  }
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {});
  return !page.url().includes("/login");
}

async function login(page, email, password) {
  for (let i = 1; i <= 3; i++) {
    if (await attemptLogin(page, email, password)) {
      console.log(`  ✓ logged in as ${email}`);
      return;
    }
    console.log(`  … login attempt ${i} for ${email} failed, retrying`);
    await sleep(2000);
  }
  throw new Error(`Login failed after 3 attempts: ${email} (rate limit? check dev server)`);
}

async function shot(page, url, name, { clickText, waitText, settle = 1400, fullPage = false } = {}) {
  if (url) await page.goto(`${BASE}${url}`, { waitUntil: "networkidle2" });
  await sleep(settle);
  if (clickText) {
    await page.evaluate((t) => {
      const el = [...document.querySelectorAll("button,[role=tab],a")].find((x) => x.textContent.trim() === t);
      el && el.click();
    }, clickText);
    await sleep(settle);
  }
  if (waitText) {
    try { await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 8000 }, waitText); } catch {}
  }
  // Guard: never silently save the login page for a protected route.
  const onLogin = await page.evaluate(() => /QUICK LOGIN/i.test(document.body.innerText) && location.pathname.startsWith("/login"));
  if (onLogin) throw new Error(`Bounced to /login while capturing ${name} — session lost`);
  const file = path.join(OUT, name + ".png");
  await page.screenshot({ path: file, fullPage });
  console.log("  saved", name + ".png");
}

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  async function freshPage() {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    return page;
  }

  // ---------------- ADMIN ----------------
  console.log("ADMIN");
  let page = await freshPage();
  await login(page, "admin@example.com", "password123");
  await shot(page, "/", "admin-01-dashboard", { waitText: "Assets" });
  await shot(page, `/assets/${ASSET_MAIN}`, "admin-02-asset-overview", { waitText: "Pipeline Stages" });
  await shot(page, null, "admin-03-pipeline-table", { clickText: "Table", waitText: "Company" });
  await shot(page, null, "admin-04-content", { clickText: "Content" });
  await shot(page, "/admin/invites", "admin-05-invites");
  await shot(page, "/admin/stages", "admin-06-stages");
  await shot(page, "/admin/users", "admin-07-team");
  await page.browserContext().close();

  // ---------------- INVESTOR ----------------
  console.log("INVESTOR");
  page = await freshPage();
  await login(page, "test.investor@example.com", "testtest123");
  await shot(page, "/portal", "investor-01-portal", { settle: 1800 });
  await shot(page, `/portal/${ASSET_TEST}`, "investor-02-deal-journey", { settle: 1800 });
  await page.browserContext().close();

  // ---------------- VIEWER ----------------
  console.log("VIEWER");
  page = await freshPage();
  await login(page, "viewer@example.com", "password123");
  await shot(page, "/", "viewer-01-dashboard", { waitText: "Assets" });
  await shot(page, `/assets/${ASSET_MAIN}`, "viewer-02-asset-overview", { settle: 1600 });
  await page.browserContext().close();

  await browser.close();
  console.log("\nDone. Files in docs/screenshots/");
}

run().catch((e) => { console.error(e); process.exit(1); });
