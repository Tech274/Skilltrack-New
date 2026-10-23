import { requireAdmin } from "@/lib/admin-auth.server";
import { isSuperAdminUser } from "@/lib/super-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STRATEGY = z.enum(["ai", "deterministic"]);

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

export const getAiRecsStrategy = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value, updated_at, updated_by")
      .eq("key", "ai_recs_strategy")
      .maybeSingle();
    const value = typeof data?.value === "string" ? data.value : "ai";
    const envOverride = process.env.AI_RECS_STRATEGY ?? null;
    return { strategy: value as "ai" | "deterministic", updatedAt: data?.updated_at ?? null, envOverride };
  });

export const setAiRecsStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ strategy: STRATEGY }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        { key: "ai_recs_strategy", value: data.strategy as any, updated_at: new Date().toISOString(), updated_by: context.userId },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    console.info("[admin] ai_recs_strategy updated", { by: context.userId, strategy: data.strategy });
    return { ok: true, strategy: data.strategy };
  });
