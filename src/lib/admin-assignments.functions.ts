import { requireAdmin } from "@/lib/admin-auth.server";
import { isSuperAdminUser } from "@/lib/super-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const WRITE_ROLES = ["admin", "content_admin", "support_admin"] as const;
const READ_ROLES = ["admin", "content_admin", "support_admin", "finance_admin"] as const;

async function assertRead(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  const isSuper = await isSuperAdminUser(userId);
  const list = (roles ?? []).map((r: any) => r.role);
  if (!isSuper && !list.some((r: string) => READ_ROLES.includes(r as any))) throw new Error("Forbidden");
  return { isSuper, roles: list };
}
async function assertWrite(supabase: any, userId: string) {
  const { isSuper, roles } = await assertRead(supabase, userId);
  if (!isSuper && !roles.some((r: string) => WRITE_ROLES.includes(r as any))) throw new Error("Forbidden: write permission required");
}

const assetType = z.enum(["certification", "resource", "mock_exam"]);

/** Return all currently-publishable items the admin can pick from, grouped by type. */
export const listAssignableAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    await assertRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [certs, resources, exams] = await Promise.all([
      supabaseAdmin.from("certifications_catalog").select("id, name, code, status").order("name"),
      supabaseAdmin.from("study_resources").select("id, title, resource_type, status").order("title"),
      supabaseAdmin.from("mock_exams").select("id, title, status").order("title"),
    ]);
    return {
      certifications: (certs.data ?? []).map((c: any) => ({ id: c.id, label: c.name + (c.code ? ` (${c.code})` : ""), status: c.status })),
      resources: (resources.data ?? []).map((r: any) => ({ id: r.id, label: r.title, status: r.status })),
      mock_exams: (exams.data ?? []).map((e: any) => ({ id: e.id, label: e.title, status: e.status })),
    };
  });

export const listLearnerAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ learner_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("learner_assignments")
      .select("*")
      .eq("learner_id", data.learner_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const assignAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    learner_id: z.string().uuid(),
    asset_type: assetType,
    asset_id: z.string().uuid(),
    due_at: z.string().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve label
    let label: string | null = null;
    if (data.asset_type === "certification") {
      const { data: c } = await supabaseAdmin.from("certifications_catalog").select("name, code").eq("id", data.asset_id).maybeSingle();
      label = c ? (c.name + (c.code ? ` (${c.code})` : "")) : null;
    } else if (data.asset_type === "resource") {
      const { data: r } = await supabaseAdmin.from("study_resources").select("title").eq("id", data.asset_id).maybeSingle();
      label = r?.title ?? null;
    } else {
      const { data: m } = await supabaseAdmin.from("mock_exams").select("title").eq("id", data.asset_id).maybeSingle();
      label = m?.title ?? null;
    }

    const { error } = await supabaseAdmin.from("learner_assignments").insert({
      learner_id: data.learner_id,
      asset_type: data.asset_type,
      asset_id: data.asset_id,
      asset_label: label,
      due_at: data.due_at ?? null,
      notes: data.notes ?? null,
      assigned_by: context.userId,
      status: "assigned",
    });
    if (error) throw new Error(error.message);

    // In-app notify the learner
    const { notify } = await import("@/lib/admin-notify.server");
    await notify({
      recipientId: data.learner_id,
      audience: "learner",
      category: "assignment_created",
      title: `New ${data.asset_type.replace("_", " ")} assigned`,
      body: label ?? undefined,
      link: "/dashboard",
      metadata: { asset_type: data.asset_type, asset_id: data.asset_id },
    });

    return { ok: true };
  });

export const updateAssignmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    status: z.enum(["assigned", "in_progress", "completed", "revoked"]),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("learner_assignments").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("learner_assignments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
