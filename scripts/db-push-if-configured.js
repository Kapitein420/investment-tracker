// Run `prisma db push` only when DATABASE_URL is present.
//
// Why: the production build script (Vercel) needs to sync additive schema
// changes (new tables / columns / indexes) to the live database before
// next build runs against the new generated client. Locally, contributors
// may not have a DATABASE_URL configured and shouldn't be blocked from
// running `npm run build`. `--accept-data-loss=false` (the default) refuses
// destructive changes — those still require an explicit `npx prisma db push`
// or migration.
const { execSync } = require("child_process");

if (!process.env.DATABASE_URL) {
  console.log("[db-push] No DATABASE_URL set — skipping prisma db push.");
  process.exit(0);
}

try {
  execSync("npx prisma db push --accept-data-loss=false --skip-generate", {
    stdio: "inherit",
  });
} catch (err) {
  console.error("[db-push] prisma db push failed.");
  process.exit(typeof err.status === "number" ? err.status : 1);
}
