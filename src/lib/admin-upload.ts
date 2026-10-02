import { supabase } from "@/integrations/supabase/client";
import { createUploadUrl } from "@/lib/admin-content.functions";

/**
 * Uploads a file to the private `content-files` bucket via signed-upload URL.
 * Returns the storage path and metadata for persistence on the resource row.
 */
export async function uploadContentFile(
  file: File,
  folder: "resources" | "thumbnails" | "exam-assets" = "resources",
  onProgress?: (pct: number) => void,
): Promise<{ path: string; mime: string; size: number; filename: string }> {
  const fn = createUploadUrl;
  const signed = await fn({
    data: { filename: file.name, mime: file.type || "application/octet-stream", size_bytes: file.size, folder },
  });
  // supabase-js: uploadToSignedUrl using the token
  const { error } = await supabase.storage
    .from("content-files")
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  onProgress?.(100);
  return { path: signed.path, mime: file.type || "application/octet-stream", size: file.size, filename: file.name };
}
