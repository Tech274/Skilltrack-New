import { requireAdmin, requireLeadAccess } from "@/lib/admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 10);

    const [
      learnersRes,
      activeSubsRes,
      pendingInvoicesRes,
      paidInvoicesRes,
      recentInvoicesRes,
      upcomingRenewalsRes,
      certsRes,
      mocksRes,
      resourcesRes,
      recentLearnersRes,
      paymentsRes,
      invoiceStatusRes,
      subsStatusRes,
      certEnrollmentRes,
      mockAttemptsRes,
    ] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "learner"),
      supabaseAdmin.from("learner_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("invoices").select("total").in("status", ["sent", "overdue"]),
      supabaseAdmin.from("invoices").select("total, paid_at, issue_date").eq("status", "paid"),
      supabaseAdmin.from("invoices").select("id, invoice_number, learner_email, total, currency, status, issue_date").order("issue_date", { ascending: false }).limit(8),
      supabaseAdmin.from("learner_subscriptions").select("id, learner_id, plan_key, end_date, status").eq("status", "active").not("end_date", "is", null).lte("end_date", in30).order("end_date").limit(8),
      supabaseAdmin.from("workforce_certifications").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("mock_exam_results").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("study_resources").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id, display_name, created_at").order("created_at", { ascending: false }).limit(8),
      supabaseAdmin.from("payments").select("amount, paid_at, status").gte("paid_at", new Date(now.getTime() - 180 * 86400_000).toISOString()),
      supabaseAdmin.from("invoices").select("status"),
      supabaseAdmin.from("learner_subscriptions").select("status"),
      supabaseAdmin.from("user_certifications").select("certification_slug"),
      supabaseAdmin.from("mock_exam_results").select("created_at").gte("created_at", new Date(now.getTime() - 180 * 86400_000).toISOString()),
    ]);

    const pendingTotal = (pendingInvoicesRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total || 0), 0);
    const revenueTotal = (paidInvoicesRes.data ?? []).reduce((s: number, r: any) => s + Number(r.total || 0), 0);

    // Monthly revenue (last 6 months)
    const monthly = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      monthly.set(monthKey(d), 0);
    }
    for (const p of paymentsRes.data ?? []) {
      if (p.status !== "success") continue;
      const k = monthKey(new Date(p.paid_at));
      if (monthly.has(k)) monthly.set(k, monthly.get(k)! + Number(p.amount || 0));
    }
    const monthlyRevenue = Array.from(monthly.entries()).map(([month, total]) => ({ month, total }));

    // Invoice status summary
    const invoiceStatusCounts: Record<string, number> = {};
    for (const r of invoiceStatusRes.data ?? []) invoiceStatusCounts[r.status] = (invoiceStatusCounts[r.status] ?? 0) + 1;

    // Subscription active vs expired
    const subsCounts: Record<string, number> = {};
    for (const r of subsStatusRes.data ?? []) subsCounts[r.status] = (subsCounts[r.status] ?? 0) + 1;

    // Cert enrollment (top 6)
    const certCounts = new Map<string, number>();
    for (const r of certEnrollmentRes.data ?? []) {
      if (!r.certification_slug) continue;
      certCounts.set(r.certification_slug, (certCounts.get(r.certification_slug) ?? 0) + 1);
    }
    const certEnrollment = Array.from(certCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([slug, count]) => ({ slug, count }));

    // Mock attempts last 6 months
    const monthlyAttempts = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      monthlyAttempts.set(monthKey(d), 0);
    }
    for (const r of mockAttemptsRes.data ?? []) {
      const k = monthKey(new Date(r.created_at));
      if (monthlyAttempts.has(k)) monthlyAttempts.set(k, monthlyAttempts.get(k)! + 1);
    }
    const mockAttemptsSeries = Array.from(monthlyAttempts.entries()).map(([month, count]) => ({ month, count }));

    return {
      kpis: {
        totalLearners: learnersRes.count ?? 0,
        activeSubscribers: activeSubsRes.count ?? 0,
        pendingPayments: pendingTotal,
        revenueCollected: revenueTotal,
        upcomingRenewals: upcomingRenewalsRes.data?.length ?? 0,
        totalCertifications: certsRes.count ?? 0,
        totalMockExams: mocksRes.count ?? 0,
        totalStudyResources: resourcesRes.count ?? 0,
      },
      recentInvoices: recentInvoicesRes.data ?? [],
      upcomingRenewals: upcomingRenewalsRes.data ?? [],
      recentLearners: recentLearnersRes.data ?? [],
      charts: {
        monthlyRevenue,
        invoiceStatusCounts,
        subsCounts,
        certEnrollment,
        mockAttemptsSeries,
      },
    };
  });

export const getAdminRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAdminContext } = await import("@/lib/admin-auth.server");
    const ctx = await getAdminContext(context.userId);
    // Probe for the admin shell. Non-admins must receive isAnyAdmin: false,
    // not a throw, so the layout can show the access-required screen.
    // Admins still pass requireAdmin, the same gate as every other admin function.
    if (ctx.isAnyAdmin) await requireAdmin(context.userId);
    let leadAccess = false;
    try {
      await requireLeadAccess(context.userId);
      leadAccess = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("lead access")) throw error;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    return {
      roles: ctx.roles,
      email: u?.user?.email ?? null,
      isSuperAdmin: ctx.isSuperAdmin,
      isAnyAdmin: ctx.isAnyAdmin,
      leadAccess,
      permissions: Array.from(ctx.permissions),
    };
  });
