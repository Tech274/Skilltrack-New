import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ilikePattern, pageBounds } from "@/lib/admin-page";

async function assertAdminOrOrgManager(ctx: any, orgId?: string | null) {
  const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (isAdmin) return;
  const { data: sa } = await ctx.supabase.rpc("is_super_admin", { _uid: ctx.userId });
  if (sa) return;
  if (orgId) {
    const { data: ok } = await ctx.supabase.rpc("is_org_member", {
      _org: orgId, _user: ctx.userId, _roles: ["exec", "hr"],
    });
    if (ok) return;
  }
  throw new Error("Forbidden");
}

const StepSchema = z.object({
  title: z.string(),
  topics: z.array(z.string()).optional(),
  estimated_hours: z.number().optional(),
  resource_hints: z.array(z.string()).optional(),
});
const AssessmentSchema = z.object({
  title: z.string(),
  kind: z.string().optional(),
  passing_score: z.number().optional(),
});

const PathInput = z.object({
  id: z.string().uuid().optional(),
  org_id: z.string().uuid().nullable().optional(),
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  target_certification_slug: z.string().optional().nullable(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional().nullable(),
  estimated_hours: z.number().optional().nullable(),
  steps: z.array(StepSchema).default([]),
  prerequisites: z.array(z.string()).default([]),
  assessments: z.array(AssessmentSchema).default([]),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  version_label: z.string().optional().nullable(),
});

function snapshotOf(payload: any) {
  return {
    title: payload.title,
    description: payload.description ?? null,
    target_certification_slug: payload.target_certification_slug ?? null,
    difficulty: payload.difficulty ?? null,
    estimated_hours: payload.estimated_hours ?? null,
    steps: payload.steps ?? [],
    prerequisites: payload.prerequisites ?? [],
    assessments: payload.assessments ?? [],
    status: payload.status ?? "draft",
  };
}

async function writeVersion(admin: any, pathId: string, orgId: string | null, authorId: string, snapshot: any, label?: string | null) {
  const { data: last } = await admin
    .from("learning_path_versions")
    .select("version_number, snapshot")
    .eq("path_id", pathId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && JSON.stringify(last.snapshot) === JSON.stringify(snapshot)) return; // no-op
  const next = (last?.version_number ?? 0) + 1;
  await admin.from("learning_path_versions").insert({
    path_id: pathId, org_id: orgId, version_number: next,
    label: label ?? null, snapshot, author_id: authorId,
  });
}

export const listLearningPaths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { org_id?: string | null; page?: number; pageSize?: number; search?: string }) =>
    z.object({
      org_id: z.string().uuid().nullable().optional(),
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      search: z.string().max(200).optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const bounds = pageBounds(data.page, data.pageSize);
    let q = context.supabase
      .from("learning_paths")
      .select("id, org_id, title, target_certification_slug, difficulty, status, estimated_hours, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false });
    if (data.org_id) q = q.eq("org_id", data.org_id);
    const pattern = ilikePattern(data.search);
    if (pattern) q = q.or(`title.ilike.${pattern},target_certification_slug.ilike.${pattern}`);
    const { data: rows, error, count } = await q.range(bounds.from, bounds.to);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0, page: bounds.page, pageSize: bounds.pageSize };
  });

export const getLearningPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("learning_paths").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return { row };
  });

export const saveLearningPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof PathInput>) => PathInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrOrgManager(context, data.org_id ?? null);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      org_id: data.org_id ?? null,
      title: data.title,
      description: data.description ?? null,
      target_certification_slug: data.target_certification_slug ?? null,
      difficulty: data.difficulty ?? null,
      estimated_hours: data.estimated_hours ?? null,
      steps: data.steps as any,
      prerequisites: data.prerequisites as any,
      assessments: data.assessments as any,
      status: data.status,
      created_by: context.userId,
    };
    let pathId = data.id;
    if (pathId) {
      const { error } = await supabaseAdmin.from("learning_paths").update(payload).eq("id", pathId);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await supabaseAdmin.from("learning_paths").insert(payload).select("id").single();
      if (error) throw new Error(error.message);
      pathId = row.id as string;
    }
    await writeVersion(supabaseAdmin, pathId!, data.org_id ?? null, context.userId, snapshotOf(payload), data.version_label ?? null);
    return { id: pathId! };
  });

export const deleteLearningPath = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrOrgManager(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("learning_paths").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Versioning ----------------

export const listPathVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path_id: string }) => z.object({ path_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("learning_path_versions")
      .select("id, version_number, label, author_id, created_at")
      .eq("path_id", data.path_id)
      .order("version_number", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getPathVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { version_id: string }) => z.object({ version_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("learning_path_versions").select("*").eq("id", data.version_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Version not found");
    return { row };
  });

export const diffPathVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from_id: string; to_id: string }) =>
    z.object({ from_id: z.string().uuid(), to_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("learning_path_versions")
      .select("id, version_number, snapshot")
      .in("id", [data.from_id, data.to_id]);
    if (error) throw new Error(error.message);
    const from = rows?.find((r) => r.id === data.from_id);
    const to = rows?.find((r) => r.id === data.to_id);
    if (!from || !to) throw new Error("Versions not found");
    return { from, to };
  });

export const rollbackPathVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path_id: string; version_id: string; label?: string }) =>
    z.object({ path_id: z.string().uuid(), version_id: z.string().uuid(), label: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: path } = await context.supabase
      .from("learning_paths").select("id, org_id").eq("id", data.path_id).maybeSingle();
    if (!path) throw new Error("Path not found");
    await assertAdminOrOrgManager(context, path.org_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ver } = await supabaseAdmin
      .from("learning_path_versions").select("snapshot").eq("id", data.version_id).maybeSingle();
    if (!ver) throw new Error("Version not found");
    const snap = ver.snapshot as any;
    const { error } = await supabaseAdmin.from("learning_paths").update({
      title: snap.title,
      description: snap.description,
      target_certification_slug: snap.target_certification_slug,
      difficulty: snap.difficulty,
      estimated_hours: snap.estimated_hours,
      steps: snap.steps,
      prerequisites: snap.prerequisites,
      assessments: snap.assessments,
      status: snap.status,
    }).eq("id", data.path_id);
    if (error) throw new Error(error.message);
    await writeVersion(supabaseAdmin, data.path_id, path.org_id ?? null, context.userId, snap, data.label ?? `Rollback to v${(ver as any).version_number ?? ""}`);
    return { ok: true };
  });
