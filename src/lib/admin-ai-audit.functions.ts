import { isSuperAdminUser } from "@/lib/super-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = (u?.user?.email ?? "").toLowerCase();
  const isSuper = await isSuperAdminUser(userId);
  if (!isSuper && !(roles ?? []).some((r: any) => r.role === "admin")) {
    throw new Error("Forbidden: admin role required");
  }
}

const filterSchema = z
  .object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(10).max(200).default(50),
    strategy: z.enum(["ai", "deterministic", "all"]).default("all"),
    fallbackOnly: z.boolean().default(false),
    errorOnly: z.boolean().default(false),
    search: z.string().max(200).default(""),
  })
  .partial()
  .optional();

function applyFilters(qb: any, f: NonNullable<z.infer<typeof filterSchema>>) {
  if (f.strategy && f.strategy !== "all") qb = qb.eq("strategy", f.strategy);
  if (f.fallbackOnly) qb = qb.eq("fallback", true);
  if (f.errorOnly) qb = qb.not("error", "is", null);
  if (f.search && f.search.trim()) {
    const s = `%${f.search.trim()}%`;
    qb = qb.or(`message.ilike.${s},error.ilike.${s},source.ilike.${s}`);
  }
  return qb;
}

async function enrichEmails(rows: any[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
  const emails: Record<string, string> = {};
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id as string);
        if (u?.user?.email) emails[id as string] = u.user.email;
      } catch { /* best effort */ }
    }),
  );
  return rows.map((r) => ({ ...r, user_email: r.user_id ? emails[r.user_id] ?? null : null }));
}

export const listAiRecsAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(filterSchema)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const f = { page: 1, pageSize: 50, strategy: "all", fallbackOnly: false, errorOnly: false, search: "", ...(data ?? {}) } as Required<NonNullable<z.infer<typeof filterSchema>>>;
    const from = (f.page - 1) * f.pageSize;
    const to = from + f.pageSize - 1;

    let q = (supabaseAdmin.from("ai_recs_audit" as any) as any)
      .select("id, user_id, strategy, source, fallback, message, error, recommendation_count, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    q = applyFilters(q, f);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const enriched = await enrichEmails(rows ?? []);
    return {
      rows: enriched,
      total: count ?? 0,
      page: f.page,
      pageSize: f.pageSize,
      pageCount: Math.max(1, Math.ceil((count ?? 0) / f.pageSize)),
    };
  });

export const exportAiRecsAuditCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(filterSchema)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const f = { strategy: "all", fallbackOnly: false, errorOnly: false, search: "", ...(data ?? {}) } as Required<NonNullable<z.infer<typeof filterSchema>>>;

    // Export honors active filters, capped at 10k rows to keep memory bounded.
    let q = (supabaseAdmin.from("ai_recs_audit" as any) as any)
      .select("id, user_id, strategy, source, fallback, message, error, recommendation_count, created_at")
      .order("created_at", { ascending: false })
      .limit(10000);
    q = applyFilters(q, f);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const enriched = await enrichEmails(rows ?? []);
    const headers = [
      "created_at", "user_email", "user_id", "strategy", "source",
      "fallback", "recommendation_count", "message", "error",
    ];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    for (const r of enriched) {
      lines.push([
        r.created_at, r.user_email ?? "", r.user_id ?? "",
        r.strategy, r.source, r.fallback ? "true" : "false",
        r.recommendation_count, r.message ?? "", r.error ?? "",
      ].map(esc).join(","));
    }
    const csv = lines.join("\n");
    return {
      filename: `ai-recs-audit-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      rowCount: enriched.length,
    };
  });
