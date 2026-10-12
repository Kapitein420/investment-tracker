// Fails when `npm audit` reports a high/critical advisory that is not on the
// allowlist below. Replaces a bare `npm audit --audit-level=high` because npm
// has no way to ignore a single advisory.
import { execFileSync } from "node:child_process";

// Advisories with no patched release that we knowingly accept. Remove an entry
// as soon as a fix exists, so the job goes red again if it comes back.
const ALLOWED = {
  // braces <=3.0.3: DoS on deeply nested patterns. Latest braces is 3.0.3, so
  // there is nothing to upgrade to. Reached only through build tooling
  // (tailwindcss 3 -> chokidar/micromatch, eslint-config-next -> fast-glob),
  // never at runtime. Goes away with the Tailwind 4 migration.
  "GHSA-vfj7-8cjw-p6xm": "braces: no patched release, build tooling only",
};

let raw;
try {
  raw = execFileSync("npm", ["audit", "--json"], { encoding: "utf8" });
} catch (e) {
  // npm audit exits non-zero when it finds anything; the report is on stdout.
  raw = e.stdout;
}

const report = JSON.parse(raw);
if (report.error) {
  console.error("npm audit failed:", report.error.summary ?? report.error);
  process.exit(1);
}

// `via` holds advisory objects for the vulnerable package itself and plain
// package-name strings for packages that merely depend on it, so walking the
// objects visits each advisory exactly once.
const blocking = new Map();
const allowed = new Map();
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via !== "object") continue;
    if (via.severity !== "high" && via.severity !== "critical") continue;
    const id = via.url.split("/").pop();
    (id in ALLOWED ? allowed : blocking).set(id, via);
  }
}

for (const [id, via] of allowed) {
  console.log(`allowed: ${id} (${ALLOWED[id]}) - ${via.title}`);
}
for (const [id, via] of blocking) {
  console.error(`BLOCKING: ${id} [${via.severity}] ${via.name}: ${via.title}\n  ${via.url}`);
}
if (blocking.size > 0) process.exit(1);
console.log("npm audit: no unaccepted high/critical advisories");
