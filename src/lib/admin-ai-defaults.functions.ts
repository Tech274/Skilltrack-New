import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const KEY = "ai.defaults";

const Defaults = z.object({
  default_model: z.string().min(2).max(200),
  max_output_tokens: z.number().int().min(64).max(32_000),
  llm_timeout_ms: z.number().int().min(10_000).max(120_000),
});
export type AiDefaults = z.infer<typeof Defaults>;

export const FALLBACK_AI_DEFAULTS: AiDefaults = {
  default_model: "google/gemini-3-flash-preview",
  max_output_tokens: 4096,
  llm_timeout_ms: 60_000,
};

/** Effective defaults plus per-field provenance (`org` | `global` | `fallback`). */
export type EffectiveAiDefaults = AiDefaults & {
  source: {
    default_model: "org" | "global" | "fallback";
    max_output_tokens: "org" | "global" | "fallback";
    llm_timeout_ms: "org" | "global" | "fallback";
  };
  org_id: string | null;
};

async function assertAdmin(ctx: any) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return;
  const { data: sa } = await ctx.supabase.rpc("is_super_admin", { _uid: ctx.userId });
  if (!sa) throw new Error("Forbidden");
}

async function assertOrgManager(ctx: any, orgId: string) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return;
  const { data: sa } = await ctx.supabase.rpc("is_super_admin", { _uid: ctx.userId });
  if (sa) return;
  const { data: isExec } = await ctx.supabase.rpc("is_org_member", {
    _org: orgId, _user: ctx.userId, _roles: ["exec"],
  });
  if (!isExec) throw new Error("Forbidden");
}

/** Global defaults, with fallback. */
export async function readAiDefaults(): Promise<AiDefaults> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings").select("value").eq("key", KEY).maybeSingle();
  const parsed = Defaults.safeParse(data?.value);
  return parsed.success ? parsed.data : FALLBACK_AI_DEFAULTS;
}

/**
 * Effective per-org defaults: org override > global default > hard-coded fallback.
 * Each field is independently layered.
 */
export async function readEffectiveAiDefaults(orgId: string | null): Promise<EffectiveAiDefaults> {
  const global = await readAiDefaults();
  let orgRow: { default_model: string | null; max_output_tokens: number | null; llm_timeout_ms: number | null } | null = null;
  if (orgId) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("ai_org_defaults")
      .select("default_model, max_output_tokens, llm_timeout_ms")
      .eq("org_id", orgId).maybeSingle();
    orgRow = (data as any) ?? null;
  }
  const pick = <T,>(orgVal: T | null | undefined, globalVal: T): { value: T; source: "org" | "global" | "fallback" } => {
    if (orgVal !== null && orgVal !== undefined) return { value: orgVal, source: "org" };
    return { value: globalVal, source: "global" };
  };
  const dm = pick(orgRow?.default_model, global.default_model);
  const mt = pick(orgRow?.max_output_tokens, global.max_output_tokens);
  const to = pick(orgRow?.llm_timeout_ms, global.llm_timeout_ms);
  return {
    default_model: dm.value,
    max_output_tokens: mt.value,
    llm_timeout_ms: to.value,
    source: {
      default_model: dm.source,
      max_output_tokens: mt.source,
      llm_timeout_ms: to.source,
    },
    org_id: orgId,
  };
}

export const getAiDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return await readAiDefaults();
  });

export const setAiDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: AiDefaults) => Defaults.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: KEY, value: data as any, updated_at: new Date().toISOString(), updated_by: context.userId }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: context.userId,
      area: "settings",
      action: "update_ai_defaults",
      payload: data as any,
    });
    return { ok: true, ...data };
  });

// ============================================================================
// Per-organization overrides (ai_org_defaults)
// ============================================================================

const OrgOverride = z.object({
  org_id: z.string().uuid(),
  default_model: z.string().min(2).max(200).nullable(),
  max_output_tokens: z.number().int().min(64).max(32_000).nullable(),
  llm_timeout_ms: z.number().int().min(10_000).max(120_000).nullable(),
});

export const getOrgAiDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { org_id: string }) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.org_id);
    const eff = await readEffectiveAiDefaults(data.org_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("ai_org_defaults").select("*").eq("org_id", data.org_id).maybeSingle();
    return { override: row ?? null, effective: eff };
  });

export const setOrgAiDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof OrgOverride>) => OrgOverride.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.org_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_org_defaults").upsert({
      org_id: data.org_id,
      default_model: data.default_model,
      max_output_tokens: data.max_output_tokens,
      llm_timeout_ms: data.llm_timeout_ms,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: context.userId,
      org_id: data.org_id,
      area: "settings",
      action: "update_org_ai_defaults",
      payload: data as any,
    });
    return { ok: true };
  });

export const clearOrgAiDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { org_id: string }) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgManager(context, data.org_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_org_defaults").delete().eq("org_id", data.org_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: context.userId,
      org_id: data.org_id,
      area: "settings",
      action: "clear_org_ai_defaults",
      payload: {},
    });
    return { ok: true };
  });

/** Admin-only: list every org override alongside the org's name/slug. */
export const listOrgAiDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orgs, error: oErr } = await supabaseAdmin
      .from("organizations").select("id, name, slug").order("name");
    if (oErr) throw new Error(oErr.message);
    const { data: overrides } = await supabaseAdmin
      .from("ai_org_defaults").select("*");
    const byOrg = new Map<string, any>();
    (overrides ?? []).forEach((r: any) => byOrg.set(r.org_id, r));
    return {
      orgs: (orgs ?? []).map((o: any) => ({
        ...o,
        override: byOrg.get(o.id) ?? null,
      })),
    };
  });
