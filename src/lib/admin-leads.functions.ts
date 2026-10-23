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
  target_exam_date: string | null;
  status: string;
  sheet_synced_at: string | null;
  sheet_error: string | null;
};

/** Every saved lead (RLS limits reads to platform admins). */
export const listSavedLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select(
        "id, created_at, source, name, email, phone, certs, target_exam_date, status, sheet_synced_at, sheet_error",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as SavedLead[] };
  });
