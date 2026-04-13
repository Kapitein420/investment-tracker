import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "documents";

/**
 * Upload a file to Supabase Storage (private bucket).
 * Returns the storage path (NOT a public URL).
 */
export async function uploadFile(file: Buffer, path: string, contentType: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
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
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(`Signed URL failed: ${error.message}`);
  return data.signedUrl;
}

/**
 * Delete a file from storage.
 */
export async function deleteFile(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
