import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertSuperAdmin(ctx: any) {
  const { data: sa } = await ctx.supabase.rpc("is_super_admin", { _uid: ctx.userId });
  if (!sa) throw new Error("Forbidden: super admin only");
}

const CreateInput = z.object({
  form_key: z.string().min(1),
  system_prompt: z.string().min(2),
  model: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  activate: z.boolean().optional().default(false),
});

/** Create a new version (next-highest version number) for a form_key. */
export const createPromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(CreateInput)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: max } = await supabaseAdmin
      .from("ai_prompt_versions")
      .select("version")
      .eq("form_key", data.form_key)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (max?.version ?? 0) + 1;

    if (data.activate) {
      await supabaseAdmin
        .from("ai_prompt_versions")
        .update({ is_active: false })
        .eq("form_key", data.form_key)
        .eq("is_active", true);
    }

    const { data: row, error } = await supabaseAdmin
      .from("ai_prompt_versions")
      .insert({
        form_key: data.form_key,
        version: nextVersion,
        system_prompt: data.system_prompt,
        model: data.model ?? null,
        notes: data.notes ?? null,
        is_active: !!data.activate,
        created_by: context.userId,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: context.userId,
      area: "super_ai",
      action: "create_prompt_version",
      target_table: "ai_prompt_versions",
      target_id: row.id,
      prompt_version_id: row.id,
      payload: { form_key: data.form_key, version: nextVersion, activate: !!data.activate },
    });
    return { row };
  });

/** Activate a specific version, deactivating any current active for the same form_key. */
export const activatePromptVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target, error: tErr } = await supabaseAdmin
      .from("ai_prompt_versions")
      .select("id, form_key, version")
      .eq("id", data.id)
      .single();
    if (tErr || !target) throw new Error(tErr?.message ?? "Not found");

    await supabaseAdmin
      .from("ai_prompt_versions")
      .update({ is_active: false })
      .eq("form_key", target.form_key)
      .eq("is_active", true);
    const { error } = await supabaseAdmin
      .from("ai_prompt_versions")
      .update({ is_active: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: context.userId,
      area: "super_ai",
      action: "activate_prompt_version",
      target_table: "ai_prompt_versions",
      target_id: data.id,
      prompt_version_id: data.id,
      payload: { form_key: target.form_key, version: target.version },
    });
    return { ok: true };
  });

/** Return two versions for diffing. */
export const getPromptDiff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { a_id: string; b_id: string }) =>
    z.object({ a_id: z.string().uuid(), b_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("ai_prompt_versions")
      .select("*")
      .in("id", [data.a_id, data.b_id]);
    if (error) throw new Error(error.message);
    return {
      a: rows?.find((r) => r.id === data.a_id) ?? null,
      b: rows?.find((r) => r.id === data.b_id) ?? null,
    };
  });
