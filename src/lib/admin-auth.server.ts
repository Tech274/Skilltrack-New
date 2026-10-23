// Standardized admin authorization helpers.
//
// `requireAdmin`       — any admin-flavor role, or a row in `super_admins`.
//                        Shared gate for non-lead admin server functions.
// `requireLeadAccess`  — lead PII only: admin, operations, finance, support,
//                        or a row in `super_admins` (same set as the sales-leads page).
// `assertAdminOrSuper` — same gate as `requireAdmin` (kept for existing callers).
// `assertPermission`   — super, or any of the user's roles grants the named permission
//                        in the `role_permissions` matrix.
//
// Server-only (imports `client.server`); never import from a route file.

import { isSuperAdminUser } from "@/lib/super-admin.server";

const ADMIN_ROLES = [
  "admin",
  "content_admin",
  "finance_admin",
  "support_admin",
  "certification_admin",
  "lab_admin",
  "operations_admin",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Roles that may read lead PII. Matches the sales-leads page. */
export const LEAD_ACCESS_ROLES = [
  "admin",
  "operations_admin",
  "finance_admin",
  "support_admin",
] as const;

async function getRoles(userId: string): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role);
}

export async function getAdminContext(userId: string): Promise<{
  isSuperAdmin: boolean;
  roles: string[];
  permissions: Set<string>;
  isAnyAdmin: boolean;
}> {
  const [isSuperAdmin, roles] = await Promise.all([isSuperAdminUser(userId), getRoles(userId)]);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let permissions = new Set<string>();
  if (roles.length > 0) {
    const { data } = await supabaseAdmin
      .from("role_permissions")
      .select("permission")
      .in("role", roles as any)
      .eq("allowed", true);
    permissions = new Set(((data ?? []) as any[]).map((r) => r.permission));
  }
  const isAnyAdmin =
    isSuperAdmin || roles.some((r) => (ADMIN_ROLES as readonly string[]).includes(r));
  return { isSuperAdmin, roles, permissions, isAnyAdmin };
}

/** Any admin-flavor role, or a Super Admin (`super_admins`). Throws otherwise. */
export async function requireAdmin(userId: string) {
  const ctx = await getAdminContext(userId);
  if (!ctx.isAnyAdmin) throw new Error("Forbidden: admin role required");
  return ctx;
}

/**
 * Lead PII gate. Super admins pass. Otherwise only admin, operations_admin,
 * finance_admin, and support_admin pass — the sales-leads allowlist.
 * Other admin-flavor roles stay on `requireAdmin` and are rejected here.
 */
export async function requireLeadAccess(userId: string) {
  const ctx = await getAdminContext(userId);
  if (ctx.isSuperAdmin) return ctx;
  const allowed = LEAD_ACCESS_ROLES as readonly string[];
  if (ctx.roles.some((role) => allowed.includes(role))) return ctx;
  throw new Error("Forbidden: lead access required");
}

export async function assertAdminOrSuper(userId: string): Promise<void> {
  await requireAdmin(userId);
}

export async function assertPermission(userId: string, permission: string): Promise<void> {
  const ctx = await getAdminContext(userId);
  if (ctx.isSuperAdmin) return;
  if (ctx.permissions.has(permission)) return;
  throw new Error(`Forbidden: requires '${permission}' permission`);
}
