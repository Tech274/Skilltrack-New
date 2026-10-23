import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isMissingLeadColumn } from "@/lib/leads";

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
    const columnsWithDate =
      "id, created_at, source, name, email, phone, certs, target_exam_date, status, sheet_synced_at, sheet_error";
    const columnsWithoutDate =
      "id, created_at, source, name, email, phone, certs, status, sheet_synced_at, sheet_error";
    const first = await context.supabase
      .from("leads")
      .select(columnsWithDate)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (first.error && isMissingLeadColumn(first.error, "target_exam_date")) {
      const fallback = await context.supabase
        .from("leads")
        .select(columnsWithoutDate)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (fallback.error) throw new Error(fallback.error.message);
      return {
        rows: (fallback.data ?? []).map((row) => ({
          ...row,
          target_exam_date: null,
        })) as SavedLead[],
      };
    }
    if (first.error) throw new Error(first.error.message);
    return { rows: (first.data ?? []) as SavedLead[] };
  });
