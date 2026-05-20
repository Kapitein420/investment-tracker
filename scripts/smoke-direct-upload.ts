/**
 * Smoke test for the direct-to-Supabase upload flow added to fix the
 * "Cannot publish PDF content without a file" error caused by Vercel's
 * 4.5MB Function body limit.
 *
 * Exercises the exact code path the browser uses:
 *   1. Create a signed upload URL (would normally be a server action)
 *   2. PUT the file bytes to that URL (would normally be the browser)
 *   3. Read the file back via a signed download URL
 *   4. Delete it
 *
 * Run:  npx tsx scripts/smoke-direct-upload.ts <path-to-file>
 * If no arg is given, defaults to the user's Anderlechtlaan IM.
 */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// When invoked inside a .claude/worktrees/* checkout, the real .env lives
// at the main repo root, not the worktree. Walk up looking for it.
function loadEnv() {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  dotenv.config();
  return null;
}
const envPath = loadEnv();
if (envPath) console.log(`[smoke] loaded env from ${envPath}`);

const DEFAULT_FILE =
  "C:/Users/NoahMaatoke_exjgg4d/Downloads/Anderlechtlaan 175-179, Amsterdam.pdf";

const BUCKET = "documents";

async function main() {
  const filePath = process.argv[2] ?? DEFAULT_FILE;
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set in .env");
  if (!key || key.startsWith("placeholder")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY not set in .env (current value looks like a placeholder).\n" +
        "Paste the real service-role key from Supabase → Project Settings → API."
    );
  }

  const file = fs.readFileSync(filePath);
  const sizeMB = (file.length / 1024 / 1024).toFixed(2);
  const filename = path.basename(filePath);
  console.log(`[smoke] file=${filename} size=${sizeMB} MB`);

  const supabase = createClient(url, key);

  // 1. Signed upload URL — what createContentUploadUrl returns.
  const objectPath = `content/smoke-${Date.now()}-${filename.replace(/[\\/]+/g, "_")}`;
  console.log(`[smoke] requesting signed upload URL for ${objectPath} …`);
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(objectPath);
  if (signErr) throw new Error(`createSignedUploadUrl failed: ${signErr.message}`);
  console.log(`[smoke]   signed URL ok (token len=${signed.token.length})`);

  // 2. PUT the bytes — what the browser does after getting the URL.
  console.log(`[smoke] PUTting ${sizeMB} MB straight to Supabase …`);
  const t0 = Date.now();
  const res = await fetch(signed.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf", "x-upsert": "false" },
    body: file,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PUT failed: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`);
  }
  console.log(`[smoke]   PUT ok in ${Date.now() - t0}ms (status ${res.status})`);

  // 3. Verify by signing a download URL and HEADing it.
  const { data: dl, error: dlErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(objectPath, 60);
  if (dlErr) throw new Error(`createSignedUrl failed: ${dlErr.message}`);
  const head = await fetch(dl.signedUrl, { method: "GET" });
  if (!head.ok) throw new Error(`Readback failed: ${head.status} ${head.statusText}`);
  const buf = Buffer.from(await head.arrayBuffer());
  if (buf.length !== file.length) {
    throw new Error(`Size mismatch: uploaded ${file.length}, fetched ${buf.length}`);
  }
  console.log(`[smoke]   readback ok (${buf.length} bytes matches)`);

  // 4. Cleanup so we don't leave smoke artefacts in the bucket.
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([objectPath]);
  if (rmErr) {
    console.warn(`[smoke]   cleanup warning: ${rmErr.message}`);
  } else {
    console.log(`[smoke]   cleanup ok`);
  }

  console.log(`[smoke] PASS — ${sizeMB} MB file uploaded directly to Supabase, no Vercel function in the path.`);
}

main().catch((err) => {
  console.error("[smoke] FAIL:", err.message ?? err);
  process.exit(1);
});
