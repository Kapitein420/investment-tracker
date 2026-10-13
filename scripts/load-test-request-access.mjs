// Load test for the invite → /request-access → "get your password" flow.
//
// Simulates N investors opening /request-access and submitting an email.
// Every email is unique and unregistered (loadtest-<run>-<n>@example.invalid),
// so the server takes the "no user" branch: rate-limit check + DB reads only.
// No Mailgun send, no DB writes, no real mailbox is touched. Safe for prod.
//
// Limits of a single-machine run: the per-IP reset cap (18/h boosted, 6/h
// default) short-circuits everything past the first few requests from one IP,
// and Vercel overwrites x-forwarded-for so it can't be spoofed. Past the cap
// the test still measures edge/function concurrency and Upstash, not the DB.
// Vercel's automatic DDoS mitigation also challenges (403, x-vercel-mitigated:
// challenge) a burst from one IP — keep CONCURRENCY low (<=5) or expect it.
//
// Usage:
//   node scripts/load-test-request-access.mjs
//   TOTAL=200 CONCURRENCY=200 BASE_URL=https://... node scripts/load-test-request-access.mjs

const BASE_URL = process.env.BASE_URL || "https://www.dils-investorportal.nl";
const TOTAL = parseInt(process.env.TOTAL ?? "200", 10);
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "50", 10);
const RUN = Date.now().toString(36);

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function latencyLine(label, arr) {
  if (!arr.length) return `  ${label.padEnd(8)} no data`;
  const f = (n) => n.toFixed(0);
  return `  ${label.padEnd(8)} ${f(Math.min(...arr))} · ${f(pct(arr, 50))} · ${f(pct(arr, 95))} · ${f(pct(arr, 99))} · ${f(Math.max(...arr))}`;
}

// The action ID is baked into the page's JS chunks and changes every build.
async function findActionId() {
  const html = await (await fetch(`${BASE_URL}/request-access`)).text();
  const scripts = [...new Set([...html.matchAll(/\/_next\/static\/[^"']*\.js/g)].map((m) => m[0]))];
  for (const src of scripts) {
    const js = await (await fetch(`${BASE_URL}${src}`)).text();
    const m = js.match(/createServerReference\)\("([0-9a-f]+)"[^)]*"requestAccessEmail"\)/);
    if (m) return m[1];
  }
  throw new Error("requestAccessEmail action ID not found in page chunks");
}

async function timed(fn) {
  const start = performance.now();
  try {
    return { ...(await fn()), _ms: performance.now() - start };
  } catch (e) {
    return { error: e.message, _ms: performance.now() - start };
  }
}

let firstBlocked;

async function visitor(n, actionId) {
  const page = await timed(async () => {
    const res = await fetch(`${BASE_URL}/request-access`);
    await res.arrayBuffer();
    if (res.status !== 200) firstBlocked ??= { step: "page", status: res.status, headers: Object.fromEntries(res.headers), body: (await res.text()).slice(0, 400) };
    return { status: res.status };
  });
  const submit = await timed(async () => {
    const res = await fetch(`${BASE_URL}/request-access`, {
      method: "POST",
      headers: { "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" },
      body: JSON.stringify([`loadtest-${RUN}-${n}@example.invalid`]),
    });
    const text = await res.text();
    if (res.status !== 200) firstBlocked ??= { step: "submit", status: res.status, headers: Object.fromEntries(res.headers), body: text.slice(0, 400) };
    return { status: res.status, okBody: text.includes('"ok":true') };
  });
  return {
    pageStatus: page.status ?? 0,
    pageMs: page._ms,
    submitStatus: submit.status ?? 0,
    submitMs: submit._ms,
    submitOk: submit.okBody === true,
    error: page.error ?? submit.error,
  };
}

async function run() {
  const actionId = await findActionId();
  console.log(`\nTarget ${BASE_URL} · action ${actionId.slice(0, 10)}… · ${TOTAL} visitors · concurrency ${CONCURRENCY} · run ${RUN}\n`);

  const results = [];
  let next = 0;
  const wallStart = performance.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < TOTAL) {
        const n = next++;
        const r = await visitor(n, actionId);
        results.push(r);
        process.stdout.write(r.submitOk && r.pageStatus === 200 ? "." : "x");
      }
    })
  );
  const wallMs = performance.now() - wallStart;

  const good = results.filter((r) => r.submitOk && r.pageStatus === 200);
  const errors = results.filter((r) => r.error);
  const codes = {};
  for (const r of results) {
    for (const k of [`page:${r.pageStatus}`, `submit:${r.submitStatus}`]) codes[k] = (codes[k] ?? 0) + 1;
  }

  console.log(`\n\nWall time:   ${(wallMs / 1000).toFixed(1)}s`);
  console.log(`Succeeded:   ${good.length}/${results.length}`);
  console.log(`Net errors:  ${errors.length}`);
  console.log("Status codes:", JSON.stringify(codes));
  console.log("\nLatency ms — min · p50 · p95 · p99 · max:");
  console.log(latencyLine("page", results.map((r) => r.pageMs)));
  console.log(latencyLine("submit", results.map((r) => r.submitMs)));
  if (firstBlocked) console.log("\nFirst non-200:", JSON.stringify(firstBlocked, null, 1));
  if (errors.length) console.log("\nFirst errors:", errors.slice(0, 5).map((e) => e.error));
  console.log("\nJSON_SUMMARY=" + JSON.stringify({ run: RUN, total: results.length, ok: good.length, errors: errors.length, wallMs, codes }));
}

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
