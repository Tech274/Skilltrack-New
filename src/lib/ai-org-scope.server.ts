// Resolve which org_id to stamp onto AI jobs / audit / staged rows.
//
// Rules:
// - If caller passed `requestedOrgId`: verify they are a member (any role)
//   OR platform admin / super admin. Otherwise throw.
// - Else if caller has exactly one organization_members row: use it.
// - Else return null (treat as platform-global action; admin/super-admin
//   gate is already enforced upstream).

export async function resolveCallerOrgId(
  ctx: { supabase: any; userId: string },
  requestedOrgId?: string | null,
  scope?: { area: string; action: string },
): Promise<string | null> {
  const { supabase, userId } = ctx;

  if (requestedOrgId) {
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data: isSuper } = await supabase.rpc("is_super_admin", { _uid: userId });
    if (!isAdmin && !isSuper) {
      const { data: isMember } = await supabase.rpc("is_org_member", {
        _org: requestedOrgId, _user: userId, _roles: null,
      });
      if (!isMember) {
        // Best-effort: record the rejected cross-tenant attempt before throwing.
        try {
          const { recordCrossTenantAccess } = await import("./ai-cross-tenant.server");
          await recordCrossTenantAccess({
            actor_id: userId,
            org_id: null,
            area: scope?.area ?? "unknown",
            action: scope?.action ?? "resolve_org",
            reason: "Caller is not a member of the requested organization",
            extra: { requested_org_id: requestedOrgId },
          });
        } catch { /* noop */ }
        throw new Error("Forbidden: not a member of the requested organization");
      }
    }
    return requestedOrgId;
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId);
  if (memberships && memberships.length === 1) return memberships[0].org_id as string;
  return null;
}
