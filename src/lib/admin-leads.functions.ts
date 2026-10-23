import { requireAdmin } from "@/lib/admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SavedLead = {
  id: string;
  created_at: string;
  source: string;
  name: string;
  email: string;
  phone: string;
  certs: string | null;
  status: string;
  sheet_synced_at: string | null;
  sheet_error: string | null;
};

/**
 * Saved leads for the admin leads page.
 * `requireAdmin` rejects non-admins here. Row-level policies live in
 * `supabase/migrations/20261023180000_leads_admin_rls.sql` and do nothing
 * until that file is applied to the live database.
 */
export const listSavedLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data, error } = await context.supabase
      .from("leads")
      .select("id, created_at, source, name, email, phone, certs, status, sheet_synced_at, sheet_error")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as SavedLead[] };
  });
