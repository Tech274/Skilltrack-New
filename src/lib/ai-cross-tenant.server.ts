// Centralized helper to record cross-tenant access attempts to ai_action_audit
// (with a top-level `cross_tenant_attempt: true` flag) AND notify platform admins
// via admin_notifications so they show up in the bell.

export type CrossTenantDetail = {
  actor_id: string;
  org_id: string | null;
  area: string;        // "extraction" | "autofill" | "content_gen" | "settings" | ...
  action: string;      // e.g. "generate_mock_questions"
  reason: string;      // short, human-readable
  target_table?: string | null;
  target_id?: string | null;
  extra?: Record<string, unknown>;
};

/**
 * Insert a cross-tenant audit row and fan out admin notifications.
 * Best-effort: never throws — the caller's primary operation must not fail
 * because of a logging hiccup.
 */
export async function recordCrossTenantAccess(detail: CrossTenantDetail): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("ai_action_audit").insert({
      actor_id: detail.actor_id,
      org_id: detail.org_id,
      area: detail.area,
      action: `cross_tenant:${detail.action}`,
      target_table: detail.target_table ?? null,
      target_id: detail.target_id ?? null,
      payload: {
        cross_tenant_attempt: true,
        reason: detail.reason,
        ...(detail.extra ?? {}),
      } as any,
    });

    // Notify all platform admins + super admins
    const recipientIds = new Set<string>();
    const { data: adminRows } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "admin");
    (adminRows ?? []).forEach((r: any) => recipientIds.add(r.user_id));
    const { data: superRows } = await supabaseAdmin
      .from("super_admins").select("user_id");
    (superRows ?? []).forEach((r: any) => recipientIds.add(r.user_id));

    if (recipientIds.size > 0) {
      const notifications = Array.from(recipientIds).map((rid) => ({
        recipient_id: rid,
        audience: "admin",
        category: "security",
        title: "Cross-tenant AI access attempt",
        body: `${detail.area}/${detail.action}: ${detail.reason}`,
        link: "/admin/ai-actions-audit",
        metadata: {
          actor_id: detail.actor_id,
          org_id: detail.org_id,
          area: detail.area,
          action: detail.action,
          ...(detail.extra ?? {}),
        } as any,
      }));
      await supabaseAdmin.from("admin_notifications").insert(notifications);
    }
  } catch (err) {
    // Logging must never break primary flow.
     
    console.error("recordCrossTenantAccess failed:", err);
  }
}
