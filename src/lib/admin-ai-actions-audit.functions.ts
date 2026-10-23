import { requireAdmin } from "@/lib/admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return;
  const { data: sa } = await ctx.supabase.rpc("is_super_admin", { _uid: ctx.userId });
  if (!sa) throw new Error("Forbidden");
}

const FiltersSchema = z.object({
  area: z.string().optional(),
  search: z.string().optional(),
  orgId: z.string().uuid().nullable().optional(),
  crossTenantOnly: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(200).default(50),
});

export const listAiActionAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FiltersSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabaseAdmin
      .from("ai_action_audit")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.area) q = q.eq("area", data.area);
    if (data.orgId) q = q.eq("org_id", data.orgId);
    if (data.crossTenantOnly) q = q.filter("payload->>cross_tenant_attempt", "eq", "true");
    if (data.search) q = q.or(`action.ilike.%${data.search}%,model.ilike.%${data.search}%,target_table.ilike.%${data.search}%`);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    // Enrich with actor email
    const actorIds = Array.from(new Set((rows ?? []).map((r: any) => r.actor_id).filter(Boolean)));
    let emails: Record<string, string> = {};
    if (actorIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles").select("id, display_name").in("id", actorIds);
      (profs ?? []).forEach((p: any) => { emails[p.id] = p.display_name ?? p.id.slice(0, 8); });
    }
    const enriched = (rows ?? []).map((r: any) => ({ ...r, actor_label: r.actor_id ? (emails[r.actor_id] ?? r.actor_id.slice(0, 8)) : null }));

    const total = count ?? 0;
    return {
      rows: enriched,
      total,
      page: data.page,
      pageSize: data.pageSize,
      pageCount: Math.max(1, Math.ceil(total / data.pageSize)),
    };
  });
