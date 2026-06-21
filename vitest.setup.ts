import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Load `.env` into process.env so integration tests can reach the local
// Postgres (Next loads it automatically in the app; Vitest does not).
// Parsed by hand to avoid pulling in a dotenv dependency. Existing env vars
// win, so CI can override DATABASE_URL.
try {
  const envPath = fileURLToPath(new URL("./.env", import.meta.url));
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
} catch {
  // No .env (e.g. CI with env vars already set) — fine.
}
