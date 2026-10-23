import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MISSING_RELATION = new Set(["PGRST205", "42P01", "PGRST204"]);

function searchPattern(raw: string | undefined): string | null {
  if (!raw) return null;
  const safe = raw.replace(/[%_,()]/g, " ").trim();
  if (!safe) return null;
  return `%${safe}%`;
}

export const listAdminAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
        search: z.string().max(200).optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    const { isSuperAdminUser } = await import("@/lib/super-admin.server");
    if (!(await isSuperAdminUser(context.userId))) {
      throw new Error("Forbidden: super admin required");
    }
    const page = data?.page ?? 1;
    const pageSize = data?.pageSize ?? 50;
    const from = (page - 1) * pageSize;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("admin_audit_log")
      .select("id, created_at, actor_id, action, target_table, target_id, summary", {
        count: "exact",
      })
      .order("created_at", { ascending: false });
    const pattern = searchPattern(data?.search);
    if (pattern) {
      q = q.or(
        `action.ilike.${pattern},target_table.ilike.${pattern},target_id.ilike.${pattern},summary.ilike.${pattern}`,
      );
    }
    const { data: rows, error, count } = await q.range(from, from + pageSize - 1);
    if (error) {
      if (MISSING_RELATION.has(error.code ?? "")) {
        console.error("admin_audit_log read failed", error.code);
        return { rows: [], total: 0, page, pageSize, unavailable: true };
      }
      throw new Error(error.message);
    }
    return { rows: rows ?? [], total: count ?? 0, page, pageSize, unavailable: false };
  });
