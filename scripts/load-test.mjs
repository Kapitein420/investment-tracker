// Investment-tracker stress test — vanilla Node fetch, no deps.
//
// Simulates N concurrent investor logins via NextAuth credentials flow,
// then hits /portal once authenticated. Captures per-request latency
// and surfaces p50/p95/p99 + error rates + status-code distribution.
//
// Read-only: only POSTs to /api/auth/callback/credentials (creates a
// session row but no business-data mutations). No emails, no document
// writes, no Mailgun calls. Safe to run against production.
//
// Usage:
//   node scripts/load-test.mjs                       # default: 10 users
//   CONCURRENCY=50 node scripts/load-test.mjs        # 50 concurrent
//   CONCURRENCY=100 BASE_URL=https://... node ...    # ramp to 100

const BASE_URL = process.env.BASE_URL || "https://investment-tracker-wd1b.vercel.app";
const CONCURRENCY = parseInt(process.env.CONCURRENCY ?? "10", 10);
const EMAIL = process.env.TEST_EMAIL || "anna@test.dils.com";
const PASSWORD = process.env.TEST_PASSWORD || "testtest123";
const ITERATIONS = parseInt(process.env.ITERATIONS ?? "1", 10); // per-worker iterations

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function timed(fn) {
  const start = performance.now();
  try {
    const result = await fn();
    return { ok: true, ms: performance.now() - start, ...result };
  } catch (e) {
    return { ok: false, ms: performance.now() - start, error: e.message };
  }
}

async function loginFlow(workerId) {
  // 1. Get the CSRF token (NextAuth requires it)
  const csrfRes = await timed(async () => {
    const res = await fetch(`${BASE_URL}/api/auth/csrf`, { redirect: "manual" });
    const json = await res.json();
    return { status: res.status, csrf: json.csrfToken, cookies: res.headers.getSetCookie() };
  });

  if (!csrfRes.ok || !csrfRes.csrf) {
    return { worker: workerId, step: "csrf", ms: csrfRes.ms, status: csrfRes.status ?? 0, error: csrfRes.error ?? "no csrf" };
  }

  // Carry the CSRF cookie forward
  const cookieHeader = (csrfRes.cookies || []).map((c) => c.split(";")[0]).join("; ");

  // 2. Submit credentials — NextAuth credentials provider
  const loginRes = await timed(async () => {
    const body = new URLSearchParams({
      csrfToken: csrfRes.csrf,
      email: EMAIL,
      password: PASSWORD,
      callbackUrl: `${BASE_URL}/portal`,
      redirect: "false",
      json: "true",
    });
    const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader,
      },
      body,
      redirect: "manual",
    });
    const text = await res.text();
    return { status: res.status, sessionCookies: res.headers.getSetCookie(), bodySnippet: text.slice(0, 80) };
  });

  if (!loginRes.ok) {
    return { worker: workerId, step: "login", ms: loginRes.ms, status: loginRes.status ?? 0, error: loginRes.error };
  }

  const sessionCookieHeader = [
    ...(csrfRes.cookies || []),
    ...(loginRes.sessionCookies || []),
  ]
    .map((c) => c.split(";")[0])
    .join("; ");

  // 3. Session check (NextAuth session endpoint)
  const sessionRes = await timed(async () => {
    const res = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: sessionCookieHeader },
    });
    const json = await res.json();
    return { status: res.status, hasSession: !!json?.user };
  });

  // 4. Hit the portal page (this is what the investor would see)
  const portalRes = await timed(async () => {
    const res = await fetch(`${BASE_URL}/portal`, {
      headers: { Cookie: sessionCookieHeader },
      redirect: "manual",
    });
    return { status: res.status };
  });

  return {
    worker: workerId,
    step: "complete",
    csrfMs: csrfRes.ms,
    loginMs: loginRes.ms,
    sessionMs: sessionRes.ms,
    portalMs: portalRes.ms,
    totalMs: csrfRes.ms + loginRes.ms + sessionRes.ms + portalRes.ms,
    csrfStatus: csrfRes.status,
    loginStatus: loginRes.status,
    sessionStatus: sessionRes.status,
    portalStatus: portalRes.status,
    sessionAuthed: sessionRes.hasSession === true,
  };
}

async function run() {
  console.log("\n" + "═".repeat(70));
  console.log(`Investment Tracker Load Test`);
  console.log("═".repeat(70));
  console.log(`Target:      ${BASE_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Iterations:  ${ITERATIONS} per worker (${CONCURRENCY * ITERATIONS} total flows)`);
  console.log(`Email:       ${EMAIL}`);
  console.log("═".repeat(70) + "\n");

  const wallStart = performance.now();

  // Each worker runs ITERATIONS flows back-to-back. CONCURRENCY workers
  // run in parallel. Total flows = CONCURRENCY * ITERATIONS.
  const workers = Array.from({ length: CONCURRENCY }, (_, i) => i);
  const allResults = [];

  await Promise.all(
    workers.map(async (w) => {
      for (let it = 0; it < ITERATIONS; it++) {
        const r = await loginFlow(`${w}-${it}`);
        allResults.push(r);
        process.stdout.write(r.step === "complete" && r.sessionAuthed ? "." : "x");
      }
    })
  );

  const wallMs = performance.now() - wallStart;

  console.log("\n\n" + "═".repeat(70));
  console.log("Results");
  console.log("═".repeat(70));

  const completed = allResults.filter((r) => r.step === "complete");
  const failed = allResults.filter((r) => r.step !== "complete");
  const authed = completed.filter((r) => r.sessionAuthed);
  const portalOk = completed.filter((r) => r.portalStatus === 200 || r.portalStatus === 307);

  console.log(`Wall time:        ${wallMs.toFixed(0)}ms (${(wallMs / 1000).toFixed(1)}s)`);
  console.log(`Total flows:      ${allResults.length}`);
  console.log(`Completed:        ${completed.length} (${((completed.length / allResults.length) * 100).toFixed(1)}%)`);
  console.log(`Auth'd session:   ${authed.length} (${((authed.length / allResults.length) * 100).toFixed(1)}%)`);
  console.log(`Portal 200/307:   ${portalOk.length}`);
  console.log(`Failures:         ${failed.length}`);
  console.log(`Effective RPS:    ${((allResults.length * 4) / (wallMs / 1000)).toFixed(1)} (4 reqs per flow)`);

  if (completed.length > 0) {
    const totals = completed.map((r) => r.totalMs);
    const csrfs = completed.map((r) => r.csrfMs);
    const logins = completed.map((r) => r.loginMs);
    const sessions = completed.map((r) => r.sessionMs);
    const portals = completed.map((r) => r.portalMs);

    console.log("\nLatency (ms) — min · p50 · p95 · p99 · max:");
    console.log(`  CSRF       ${Math.min(...csrfs).toFixed(0)} · ${pct(csrfs, 50).toFixed(0)} · ${pct(csrfs, 95).toFixed(0)} · ${pct(csrfs, 99).toFixed(0)} · ${Math.max(...csrfs).toFixed(0)}`);
    console.log(`  Login      ${Math.min(...logins).toFixed(0)} · ${pct(logins, 50).toFixed(0)} · ${pct(logins, 95).toFixed(0)} · ${pct(logins, 99).toFixed(0)} · ${Math.max(...logins).toFixed(0)}`);
    console.log(`  Session    ${Math.min(...sessions).toFixed(0)} · ${pct(sessions, 50).toFixed(0)} · ${pct(sessions, 95).toFixed(0)} · ${pct(sessions, 99).toFixed(0)} · ${Math.max(...sessions).toFixed(0)}`);
    console.log(`  Portal     ${Math.min(...portals).toFixed(0)} · ${pct(portals, 50).toFixed(0)} · ${pct(portals, 95).toFixed(0)} · ${pct(portals, 99).toFixed(0)} · ${Math.max(...portals).toFixed(0)}`);
    console.log(`  Total      ${Math.min(...totals).toFixed(0)} · ${pct(totals, 50).toFixed(0)} · ${pct(totals, 95).toFixed(0)} · ${pct(totals, 99).toFixed(0)} · ${Math.max(...totals).toFixed(0)}`);
  }

  // Status code distribution
  const codes = {};
  for (const r of completed) {
    [`csrf:${r.csrfStatus}`, `login:${r.loginStatus}`, `session:${r.sessionStatus}`, `portal:${r.portalStatus}`].forEach(
      (k) => (codes[k] = (codes[k] ?? 0) + 1)
    );
  }
  console.log("\nStatus code distribution:");
  for (const [k, v] of Object.entries(codes).sort()) {
    console.log(`  ${k}: ${v}`);
  }

  if (failed.length > 0) {
    console.log("\nFailures (first 10):");
    for (const f of failed.slice(0, 10)) {
      console.log(`  worker ${f.worker} step=${f.step} status=${f.status} ms=${f.ms?.toFixed(0)} err=${f.error ?? ""}`);
    }
  }

  console.log("═".repeat(70) + "\n");

  // Emit JSON for the synthesis step
  const summary = {
    target: BASE_URL,
    concurrency: CONCURRENCY,
    iterations: ITERATIONS,
    totalFlows: allResults.length,
    completed: completed.length,
    authed: authed.length,
    portalOk: portalOk.length,
    failed: failed.length,
    wallMs,
    rps: (allResults.length * 4) / (wallMs / 1000),
    latency: completed.length
      ? {
          total: { p50: pct(completed.map((r) => r.totalMs), 50), p95: pct(completed.map((r) => r.totalMs), 95), p99: pct(completed.map((r) => r.totalMs), 99), max: Math.max(...completed.map((r) => r.totalMs)) },
          login: { p50: pct(completed.map((r) => r.loginMs), 50), p95: pct(completed.map((r) => r.loginMs), 95), p99: pct(completed.map((r) => r.loginMs), 99) },
          portal: { p50: pct(completed.map((r) => r.portalMs), 50), p95: pct(completed.map((r) => r.portalMs), 95), p99: pct(completed.map((r) => r.portalMs), 99) },
        }
      : null,
    statusCodes: codes,
  };
  console.log("JSON_SUMMARY=" + JSON.stringify(summary));
}

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
