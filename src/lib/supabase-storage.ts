import { createClient, SupabaseClient } from "@supabase/supabase-js";

// In-memory cache for signed URLs within a function invocation
const urlCache = new Map<string, { url: string; expiresAt: number }>();

function getCachedUrl(path: string): string | null {
  const entry = urlCache.get(path);
  if (entry && entry.expiresAt > Date.now()) return entry.url;
  return null;
}

function cacheUrl(path: string, url: string, ttlSeconds: number) {
  urlCache.set(path, { url, expiresAt: Date.now() + ttlSeconds * 1000 });
}

const BUCKET = "documents";

let _supabase: SupabaseClient | null = null;

function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase credentials not configured");
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/**
 * Upload a file to Supabase Storage (private bucket).
 * Returns the storage path (NOT a public URL).
 */
export async function uploadFile(file: Buffer, path: string, contentType: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return data.path;
}

/**
 * Generate a signed URL for temporary access to a private file.
 * Default expiry: 2 hours (7200 seconds).
 */
export async function getSignedUrl(path: string, expiresInSeconds = 7200): Promise<string> {
  const cached = getCachedUrl(path);
  if (cached) return cached;

  const { data, error } = await getSupabase().storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);

  // Cache for 90% of the TTL to avoid serving expired URLs
  cacheUrl(path, data.signedUrl, Math.floor(expiresInSeconds * 0.9));
  return data.signedUrl;
}

/**
 * Download raw file bytes from private storage.
 */
export async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await getSupabase().storage.from(BUCKET).download(path);
  if (error) throw new Error(`Download failed: ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload raw bytes to storage and return the path.
 */
export async function uploadBytes(bytes: Uint8Array, path: string, contentType: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return data.path;
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(path: string) {
  const { error } = await getSupabase().storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
