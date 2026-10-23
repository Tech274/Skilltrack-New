import { requireAdmin } from "@/lib/admin-auth.server";
import { recordAdminAudit } from "@/lib/admin-audit.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLES = [
  "learner",
  "manager",
  "admin",
  "content_admin",
  "finance_admin",
  "support_admin",
  "certification_admin",
  "lab_admin",
  "operations_admin",
] as const;
const roleSchema = z.enum(ROLES);

async function isSuperAdminUser(userId: string) {
  const { isSuperAdminUser } = await import("@/lib/super-admin.server");
  return isSuperAdminUser(userId);
}

async function getActor(supabaseAdmin: any, userId: string) {
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  return { id: userId, email: data?.user?.email ?? null };
}

async function assertSuperAdmin(supabase: any, userId: string) {
  const isSuper = await isSuperAdminUser(userId);
  if (!isSuper) throw new Error("Forbidden: Super Admin only");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return await getActor(supabaseAdmin, userId);
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdminContext } = await import("@/lib/admin-auth.server");
    const ctx = await getAdminContext(context.userId);
    // Site header calls this for every signed-in user. Non-admins get
    // isAdmin: false. Admins still go through requireAdmin.
    if (ctx.isAnyAdmin) await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actor = await getActor(supabaseAdmin, context.userId);
    return { isAdmin: ctx.isAnyAdmin, isSuperAdmin: ctx.isSuperAdmin, email: actor.email, roles: ctx.roles };
  });


export const getEnabledAdminFeatures = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Find super admin
    const { data: superRow } = await supabaseAdmin
      .from("super_admin_subscription")
      .select("plan_key, status, current_period_end")
      .maybeSingle();
    if (!superRow || superRow.status !== "active") {
      return { features: [] as string[], plan: null, status: superRow?.status ?? "none" };
    }
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("plan_key, label, features")
      .eq("plan_key", superRow.plan_key)
      .maybeSingle();
    const features = Array.isArray(plan?.features) ? (plan!.features as string[]) : [];
    return { features, plan: plan ?? null, status: superRow.status };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const allUsers: Array<{ id: string; email: string | null; created_at: string; last_sign_in_at: string | null }> = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        allUsers.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < 200) break;
      page += 1;
      if (page > 25) break;
    }

    const ids = allUsers.map((u) => u.id);
    const { data: roleRows, error: rerr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);
    if (rerr) throw new Error(rerr.message);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ids);

    const { data: superRows } = await supabaseAdmin
      .from("super_admins" as any)
      .select("user_id")
      .in("user_id", ids);
    const superSet = new Set<string>(((superRows ?? []) as any[]).map((r: any) => r.user_id));

    const roleMap = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    }
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return allUsers
      .map((u) => ({
        ...u,
        roles: roleMap.get(u.id) ?? [],
        is_super_admin: superSet.has(u.id),
        display_name: (profileMap.get(u.id) as any)?.display_name ?? null,
        avatar_url: (profileMap.get(u.id) as any)?.avatar_url ?? null,
      }))
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  });

async function recordAudit(
  supabaseAdmin: any,
  args: { actor: { id: string; email: string | null }; target_user_id: string; target_email: string | null; role: string; action: "grant" | "revoke"; metadata?: Record<string, unknown> },
) {
  await supabaseAdmin.from("role_audit_log").insert({
    actor_id: args.actor.id,
    actor_email: args.actor.email,
    target_user_id: args.target_user_id,
    target_email: args.target_email,
    role: args.role,
    action: args.action,
    source: "admin_ui",
    metadata: args.metadata ?? {},
  });
}

export const grantUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: (typeof ROLES)[number] }) =>
    z.object({ userId: z.string().uuid(), role: roleSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const actor = await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tu } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const targetEmail = tu?.user?.email ?? null;
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    await recordAudit(supabaseAdmin, {
      actor,
      target_user_id: data.userId,
      target_email: targetEmail,
      role: data.role,
      action: "grant",
    });
    await recordAdminAudit(supabaseAdmin, {
      actorId: actor.id,
      action: "user.role_grant",
      targetTable: "user_roles",
      targetId: data.userId,
      summary: data.role,
      after: { role: data.role },
    });
    return { ok: true };
  });

export const revokeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: (typeof ROLES)[number] }) =>
    z.object({ userId: z.string().uuid(), role: roleSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const actor = await assertSuperAdmin(context.supabase, context.userId);
    if (data.role === "admin" && data.userId === context.userId) {
      throw new Error("You cannot revoke your own admin role.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tu } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const targetEmail = tu?.user?.email ?? null;
    if (data.role === "admin" && (await isSuperAdminUser(data.userId))) {
      throw new Error("Cannot revoke admin from a Super Admin.");
    }
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    await recordAudit(supabaseAdmin, {
      actor,
      target_user_id: data.userId,
      target_email: targetEmail,
      role: data.role,
      action: "revoke",
    });
    await recordAdminAudit(supabaseAdmin, {
      actorId: actor.id,
      action: "user.role_revoke",
      targetTable: "user_roles",
      targetId: data.userId,
      summary: data.role,
      before: { role: data.role },
    });
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertSuperAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tu } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (await isSuperAdminUser(data.userId)) {
      throw new Error("Cannot delete a Super Admin.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await recordAdminAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "user.delete",
      targetTable: "auth.users",
      targetId: data.userId,
      summary: "deleted user",
    });
    return { ok: true };
  });

// ---------------- Audit log ----------------
export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("role_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------------- Subscription / plans ----------------
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getSuperSubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("super_admin_subscription")
      .select("*")
      .maybeSingle();
    return data ?? null;
  });

export const updateSuperSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan_key: string; status?: "active" | "past_due" | "canceled" }) =>
    z.object({ plan_key: z.string(), status: z.enum(["active", "past_due", "canceled"]).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const actor = await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("super_admin_subscription")
      .select("id")
      .eq("super_admin_id", actor.id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("super_admin_subscription")
        .update({ plan_key: data.plan_key, status: data.status ?? "active" })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("super_admin_subscription")
        .insert({ super_admin_id: actor.id, plan_key: data.plan_key, status: data.status ?? "active" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------------- Permissions matrix ----------------
export const listPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("role_permissions")
      .select("*")
      .order("permission")
      .order("role");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updatePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { role: (typeof ROLES)[number]; permission: string; allowed: boolean }) =>
    z.object({ role: roleSchema, permission: z.string().min(1), allowed: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const actor = await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Capture previous value for audit
    const { data: prev } = await supabaseAdmin
      .from("role_permissions")
      .select("allowed")
      .eq("role", data.role)
      .eq("permission", data.permission)
      .maybeSingle();
    const { error } = await supabaseAdmin
      .from("role_permissions")
      .update({ allowed: data.allowed, updated_by: actor.id })
      .eq("role", data.role)
      .eq("permission", data.permission);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("permission_audit_log" as any).insert({
      actor_id: actor.id,
      actor_email: actor.email,
      role: data.role,
      permission: data.permission,
      previous_allowed: prev?.allowed ?? null,
      new_allowed: data.allowed,
      source: "admin_ui",
    });
    return { ok: true };
  });

export const listPermissionAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("permission_audit_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
