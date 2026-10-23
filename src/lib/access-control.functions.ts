// Access-rule CRUD + asset-access enforcement.
//
// Rules let admins gate certifications, resources, and mock exams by plan,
// role, or time window. checkAssetAccess is the single guard that resource
// download and mock-exam launch server fns call before serving a URL or
// starting an attempt.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ilikePattern } from "@/lib/admin-page";

const ASSET_TYPES = ["certification", "resource", "mock_exam"] as const;
type AssetType = typeof ASSET_TYPES[number];

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: isSuper } = await supabase.rpc("is_super_admin", { _uid: userId });
  if (!isAdmin && !isSuper) throw new Error("Forbidden: admin role required");
}

const ruleInput = z.object({
  id: z.string().uuid().optional(),
  asset_type: z.enum(ASSET_TYPES),
  asset_id: z.string().uuid().nullable().optional(),
  certification_slug: z.string().max(120).nullable().optional(),
  required_plan: z.string().max(60).nullable().optional(),
  required_role: z.string().max(60).nullable().optional(),
  starts_at: z.string().datetime().nullable().optional(),
  ends_at: z.string().datetime().nullable().optional(),
  active: z.boolean().default(true),
  metadata: z.record(z.string(), z.any()).default({}),
}).refine((v) => !!v.asset_id || !!v.certification_slug, {
  message: "Either asset_id or certification_slug is required",
});

export const listAccessRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    asset_type: z.string().optional(),
    search: z.string().optional(),
    only_active: z.boolean().optional(),
  }).partial().optional())
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("access_rules").select("*").order("created_at", { ascending: false });
    if (data?.asset_type && data.asset_type !== "all") q = q.eq("asset_type", data.asset_type);
    if (data?.only_active) q = q.eq("active", true);
    const search = ilikePattern(data?.search);
    if (search) {
      q = q.or(
        `certification_slug.ilike.${search},required_plan.ilike.${search},required_role.ilike.${search}`,
      );
    }
    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertAccessRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ruleInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload: any = { ...data, created_by: context.userId };
    if (data.id) {
      const { id, ...rest } = payload;
      const { error } = await supabaseAdmin.from("access_rules").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabaseAdmin.from("access_rules").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const deleteAccessRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("access_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Enforcement ----------------

type AccessResult = { allowed: boolean; reason?: string; rule_id?: string };

async function evaluateAccess(opts: {
  userId: string;
  assetType: AssetType;
  assetId?: string | null;
  certificationSlug?: string | null;
}): Promise<AccessResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Admin / super-admin always allowed.
  const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
    supabaseAdmin.rpc("has_role", { _user_id: opts.userId, _role: "admin" }),
    supabaseAdmin.rpc("is_super_admin", { _uid: opts.userId }),
  ]);
  if (isAdmin || isSuper) return { allowed: true };

  // Find candidate rules for this asset.
  const orParts: string[] = [];
  if (opts.assetId) orParts.push(`and(asset_type.eq.${opts.assetType},asset_id.eq.${opts.assetId})`);
  if (opts.certificationSlug) orParts.push(`and(asset_type.eq.${opts.assetType},certification_slug.eq.${opts.certificationSlug})`);
  if (orParts.length === 0) return { allowed: true }; // nothing to match → default open

  const nowIso = new Date().toISOString();
  const { data: rules, error } = await supabaseAdmin
    .from("access_rules")
    .select("*")
    .eq("active", true)
    .or(orParts.join(","));
  if (error) return { allowed: false, reason: "Access check failed" };
  if (!rules || rules.length === 0) return { allowed: true }; // no rule → preserve existing public behavior

  // All matching active rules must pass. Most specific (asset_id) first.
  const ordered = [...rules].sort((a, b) => Number(!!b.asset_id) - Number(!!a.asset_id));

  // Pull user state once.
  const { data: roleRows } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", opts.userId);
  const roles = (roleRows ?? []).map((r: any) => r.role);

  for (const r of ordered) {
    if (r.starts_at && new Date(r.starts_at) > new Date(nowIso)) {
      return { allowed: false, reason: "Not yet available", rule_id: r.id };
    }
    if (r.ends_at && new Date(r.ends_at) < new Date(nowIso)) {
      return { allowed: false, reason: "Access window ended", rule_id: r.id };
    }
    if (r.required_role && !roles.includes(r.required_role)) {
      return { allowed: false, reason: `Requires role: ${r.required_role}`, rule_id: r.id };
    }
    if (r.required_plan) {
      const { data: entitled } = await supabaseAdmin.rpc("has_active_entitlement", {
        _user: opts.userId,
        _plan: r.required_plan,
      });
      if (!entitled) {
        return { allowed: false, reason: `Requires ${r.required_plan} subscription`, rule_id: r.id };
      }
    }
  }
  return { allowed: true };
}

export const checkAssetAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    asset_type: z.enum(ASSET_TYPES),
    asset_id: z.string().uuid().nullable().optional(),
    certification_slug: z.string().max(120).nullable().optional(),
  }))
  .handler(async ({ data, context }) =>
    evaluateAccess({
      userId: context.userId,
      assetType: data.asset_type,
      assetId: data.asset_id ?? null,
      certificationSlug: data.certification_slug ?? null,
    }),
  );

/** Resource download — enforce checkAssetAccess then return signed URL or external URL. */
export const requestResourceAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ resource_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin
      .from("study_resources")
      .select("id, certification_slug, storage_path, external_url, download_allowed, status")
      .eq("id", data.resource_id).maybeSingle();
    if (error || !res) throw new Error("Resource not found");
    if (res.status !== "published") throw new Error("Resource not available");

    const result = await evaluateAccess({
      userId: context.userId,
      assetType: "resource",
      assetId: res.id,
      certificationSlug: res.certification_slug,
    });
    if (!result.allowed) throw new Error(result.reason ?? "Forbidden");

    if (res.storage_path) {
      if (!res.download_allowed) throw new Error("Downloads disabled for this resource");
      const { data: signed, error: sErr } = await supabaseAdmin.storage
        .from("content-files").createSignedUrl(res.storage_path, 600);
      if (sErr || !signed?.signedUrl) throw new Error("Could not create download URL");
      return { url: signed.signedUrl, kind: "download" as const };
    }
    if (res.external_url) return { url: res.external_url, kind: "external" as const };
    throw new Error("Resource has no downloadable content");
  });

/** Mock-exam launch — enforce checkAssetAccess; returns the mock_exam id when allowed. */
export const requestMockExamLaunch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ mock_exam_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam, error } = await supabaseAdmin
      .from("mock_exams")
      .select("id, certification_slug, status")
      .eq("id", data.mock_exam_id).maybeSingle();
    if (error || !exam) throw new Error("Mock exam not found");
    if (exam.status !== "published") throw new Error("Mock exam not available");

    const result = await evaluateAccess({
      userId: context.userId,
      assetType: "mock_exam",
      assetId: exam.id,
      certificationSlug: exam.certification_slug,
    });
    if (!result.allowed) throw new Error(result.reason ?? "Forbidden");
    return { allowed: true as const, mock_exam_id: exam.id };
  });
