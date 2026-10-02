/**
 * Server-only notification helper.
 * Import inside `.handler()` blocks with: `const { notify } = await import("@/lib/admin-notify.server")`.
 */

type NotifyInput = {
  recipientId: string;
  audience?: "admin" | "learner";
  category: string;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
};

export async function notify(input: NotifyInput | NotifyInput[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const list = Array.isArray(input) ? input : [input];
  if (list.length === 0) return { inserted: 0 };
  const rows = list.map((n) => ({
    recipient_id: n.recipientId,
    audience: n.audience ?? "admin",
    category: n.category,
    title: n.title.slice(0, 200),
    body: n.body ?? null,
    link: n.link ?? null,
    metadata: (n.metadata ?? {}) as any,
  }));
  const { error } = await supabaseAdmin.from("admin_notifications").insert(rows);
  if (error) throw new Error(error.message);
  return { inserted: rows.length };
}

/** Returns user_ids for all admin recipients (admin + super_admin + support_admin). */
export async function getAdminRecipientIds(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "support_admin", "finance_admin"]);
  const ids = new Set<string>((data ?? []).map((r: any) => r.user_id));
  // Also include all super admins (from the dedicated super_admins table).
  const { listSuperAdminUserIds } = await import("@/lib/super-admin.server");
  for (const id of await listSuperAdminUserIds()) ids.add(id);
  return Array.from(ids);
}
