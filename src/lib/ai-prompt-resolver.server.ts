// Server-only: resolve the currently-active AI prompt version for a form_key.
// Falls back to in-code defaults when no override is published.

export type ResolvedPrompt = {
  system: string;
  model: string | null;
  versionId: string | null;
  version: number | null;
};

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

export async function resolveActivePrompt(
  formKey: string,
  defaultSystem: string,
): Promise<ResolvedPrompt> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("ai_prompt_versions")
    .select("id, version, system_prompt, model")
    .eq("form_key", formKey)
    .eq("is_active", true)
    .maybeSingle();
  if (data) {
    return {
      system: data.system_prompt || defaultSystem,
      model: data.model || DEFAULT_MODEL,
      versionId: data.id,
      version: data.version,
    };
  }
  return { system: defaultSystem, model: DEFAULT_MODEL, versionId: null, version: null };
}
