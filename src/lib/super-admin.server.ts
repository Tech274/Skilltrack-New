// Server-only helper: super-admin status is now stored in the dedicated
// `public.super_admins` table (see migration). Do NOT bring back the legacy
// hardcoded-email check — it tied privilege to whoever owned the inbox.

export async function isSuperAdminUser(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("super_admins" as any)
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function listSuperAdminUserIds(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("super_admins" as any).select("user_id");
  return ((data ?? []) as unknown as Array<{ user_id: string }>).map((r) => r.user_id);
}
