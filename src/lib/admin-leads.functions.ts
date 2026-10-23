import { requireLeadAccess } from "@/lib/admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
 * `requireLeadAccess` allows admin, operations, finance, support, and super admins.
 * Row-level policies live in
 * `supabase/migrations/20261023180000_leads_admin_rls.sql` and do nothing
 * until that file is applied to the live database.
 */
const listInput = z
  .object({
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(100).optional(),
    search: z.string().max(200).optional(),
    source: z.string().max(80).optional(),
  })
  .optional();

export const guardLeadAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireLeadAccess(context.userId);
    return { ok: true as const };
  });

export const listSavedLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(listInput)
  .handler(async ({ data: input, context }) => {
    await requireLeadAccess(context.userId);
    const page = input?.page ?? 1;
    const pageSize = input?.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    let q = context.supabase
      .from("leads")
      .select(
        "id, created_at, source, name, email, phone, certs, status, sheet_synced_at, sheet_error",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });
    if (input?.source) q = q.eq("source", input.source);
    const search = input?.search?.trim();
    if (search) {
      const safe = search.replace(/[%_,()]/g, " ").trim();
      if (safe) {
        const s = `%${safe}%`;
        q = q.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s}`);
      }
    }
    const { data, error, count } = await q.range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []) as SavedLead[],
      total: count ?? 0,
      page,
      pageSize,
    };
  });
