import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const statusSchema = z.enum(["open", "triaged", "fixed", "ignored", "reopened"]);

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listSecurityFindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("security_findings")
      .select("*")
      .order("level", { ascending: true })
      .order("last_seen_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getFindingEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { findingId: string }) => z.object({ findingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("security_finding_events")
      .select("*")
      .eq("finding_id", data.findingId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const updateFindingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string; notes?: string }) =>
    z.object({ id: z.string().uuid(), status: statusSchema, notes: z.string().max(2000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("security_findings")
      .update({ status: data.status, notes: data.notes ?? null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncSecurityScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { findings: Array<{ scanner_name: string; external_id: string; title: string; description?: string; level?: string; link?: string; metadata?: Record<string, unknown> }> }) =>
    z.object({
      findings: z.array(z.object({
        scanner_name: z.string().min(1),
        external_id: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional(),
        level: z.string().optional(),
        link: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
      })),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let upserted = 0;
    for (const f of data.findings) {
      const { error } = await context.supabase.rpc("upsert_security_finding", {
        _scanner: f.scanner_name,
        _external_id: f.external_id,
        _title: f.title,
        _description: f.description ?? "",
        _level: f.level ?? "warn",
        _link: f.link ?? "",
        _metadata: f.metadata ?? {},
      });
      if (error) throw new Error(error.message);
      upserted++;
    }
    return { upserted };
  });

export const grantSelfAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Only allowed if there are zero admins yet (bootstrap)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: cErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) > 0) throw new Error("An admin already exists. Ask an existing admin to grant the role.");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
