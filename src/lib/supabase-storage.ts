import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "documents";

export async function uploadFile(file: Buffer, path: string, contentType: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function deleteFile(path: string) {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}
