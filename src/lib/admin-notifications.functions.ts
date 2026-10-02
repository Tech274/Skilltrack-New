import { formatInvoiceAmount } from "@/lib/invoice-currency";
import { isSuperAdminUser } from "@/lib/super-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAnyAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  const isSuper = await isSuperAdminUser(userId);
  const list = (roles ?? []).map((r: any) => r.role);
  if (!isSuper && !list.some((r: string) => ["admin","support_admin","finance_admin","content_admin"].includes(r))) {
    throw new Error("Forbidden");
  }
  return { isSuper, roles: list };
}

/** List the current admin's own notifications (admin inbox). */
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    only_unread: z.boolean().optional(),
    limit: z.number().min(1).max(200).default(50),
  }).partial().optional())
  .handler(async ({ data, context }) => {
    await assertAnyAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("admin_notifications")
      .select("*")
      .eq("recipient_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 50);
    if (data?.only_unread) q = q.is("read_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const { count: unread } = await supabaseAdmin
      .from("admin_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", context.userId)
      .is("read_at", null);
    return { rows: rows ?? [], unread: unread ?? 0 };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    if (data.all) {
      const { error } = await supabaseAdmin
        .from("admin_notifications")
        .update({ read_at: now })
        .eq("recipient_id", context.userId)
        .is("read_at", null);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    if (!data.id) throw new Error("id required");
    const { error } = await supabaseAdmin
      .from("admin_notifications")
      .update({ read_at: now })
      .eq("id", data.id)
      .eq("recipient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Scans overdue invoices and soon-expiring subscriptions, creates notifications
 * for affected learners + admins. Idempotent within the same day for each event.
 */
export const runReminderScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAnyAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { notify, getAdminRecipientIds } = await import("@/lib/admin-notify.server");

    const todayKey = new Date().toISOString().slice(0, 10);
    const adminIds = await getAdminRecipientIds();
    let queued = 0;

    // 1. Overdue invoices (due_date < today and not paid/cancelled)
    const today = new Date().toISOString().slice(0, 10);
    const { data: overdue } = await supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, learner_id, learner_email, learner_name, total, currency, due_date, status")
      .lt("due_date", today)
      .in("status", ["sent", "draft", "overdue"]);

    for (const inv of overdue ?? []) {
      // Mark invoice overdue
      if (inv.status !== "overdue") {
        await supabaseAdmin.from("invoices").update({ status: "overdue" }).eq("id", inv.id);
      }
      // Dedup: already notified today?
      const { data: existing } = await supabaseAdmin
        .from("admin_notifications")
        .select("id")
        .eq("category", "payment_reminder")
        .eq("recipient_id", inv.learner_id)
        .gte("created_at", `${todayKey}T00:00:00Z`)
        .contains("metadata", { invoice_id: inv.id })
        .limit(1);
      if ((existing ?? []).length > 0) continue;

      const title = `Payment overdue: ${inv.invoice_number}`;
      const body = `${formatInvoiceAmount(inv.total, inv.currency)} was due on ${inv.due_date}.`;
      await notify([
        { recipientId: inv.learner_id, audience: "learner", category: "payment_reminder", title, body, link: "/dashboard", metadata: { invoice_id: inv.id } },
        ...adminIds.map((id) => ({ recipientId: id, audience: "admin" as const, category: "payment_reminder", title: `Overdue: ${inv.invoice_number} (${inv.learner_email ?? "learner"})`, body, link: `/admin/invoices/${inv.id}`, metadata: { invoice_id: inv.id } })),
      ]);
      queued += 1 + adminIds.length;
    }

    // 2. Subscriptions expiring in next 7 days
    const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
    const { data: subs } = await supabaseAdmin
      .from("learner_subscriptions")
      .select("id, learner_id, plan_key, end_date, status")
      .eq("status", "active")
      .not("end_date", "is", null)
      .lte("end_date", in7)
      .gte("end_date", today);

    for (const s of subs ?? []) {
      const { data: existing } = await supabaseAdmin
        .from("admin_notifications")
        .select("id")
        .eq("category", "subscription_expiring")
        .eq("recipient_id", s.learner_id)
        .gte("created_at", `${todayKey}T00:00:00Z`)
        .contains("metadata", { subscription_id: s.id })
        .limit(1);
      if ((existing ?? []).length > 0) continue;

      const title = `Subscription expires ${s.end_date}`;
      const body = `Your ${s.plan_key ?? "subscription"} ends on ${s.end_date}. Renew to keep access.`;
      await notify([
        { recipientId: s.learner_id, audience: "learner", category: "subscription_expiring", title, body, link: "/pricing", metadata: { subscription_id: s.id } },
        ...adminIds.map((id) => ({ recipientId: id, audience: "admin" as const, category: "subscription_expiring", title: `Subscription expiring (${s.plan_key ?? "plan"})`, body, link: `/admin/subscribers`, metadata: { subscription_id: s.id, learner_id: s.learner_id } })),
      ]);
      queued += 1 + adminIds.length;
    }

    return { scanned_invoices: (overdue ?? []).length, scanned_subscriptions: (subs ?? []).length, queued };
  });
