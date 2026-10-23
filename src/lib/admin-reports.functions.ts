// Admin Reports & Analytics — revenue + subscriptions + learner activity.
//
// Permission-gated:
//   getAdminReports     -> reports.view
//   exportAdminReportsCsv -> reports.export

import { requireAdmin } from "@/lib/admin-auth.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ilikePattern } from "@/lib/admin-page";
import { loadUserEmails } from "@/lib/admin-directory.server";

const rangeInput = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function defaultRange(from?: string, to?: string) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { start, end };
}

const PLAN_PRICE: Record<string, { month: number; year: number }> = {
  professional: { month: 19, year: 190 },
  team: { month: 49, year: 490 }, // per seat
};

function mrrForSub(s: { plan_code: string; billing_interval: string; seats: number | null; status: string }): number {
  if (!["active", "trialing"].includes(s.status)) return 0;
  const price = PLAN_PRICE[s.plan_code];
  if (!price) return 0;
  const seats = s.seats ?? 1;
  const monthly = s.billing_interval === "year" ? price.year / 12 : price.month;
  return monthly * seats;
}

export const getAdminReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string }) => rangeInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { assertPermission } = await import("@/lib/admin-auth.server");
    await assertPermission(context.userId, "reports.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { start, end } = defaultRange(data.from, data.to);
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // --- Subscriptions snapshot ---
    const { data: subs = [] } = await supabaseAdmin
      .from("subscriptions")
      .select("plan_code, billing_interval, seats, status, created_at, current_period_end, trial_end, cancel_at_period_end, scope");

    const allSubs = subs ?? [];
    const activeOrTrial = allSubs.filter((s) => ["active", "trialing"].includes(s.status));
    const mrr = activeOrTrial.reduce((sum, s) => sum + mrrForSub(s as any), 0);

    const byPlan = new Map<string, { active: number; trialing: number; mrr: number }>();
    for (const s of allSubs) {
      const key = `${s.plan_code}_${s.billing_interval}`;
      const row = byPlan.get(key) ?? { active: 0, trialing: 0, mrr: 0 };
      if (s.status === "active") row.active += 1;
      if (s.status === "trialing") row.trialing += 1;
      if (["active", "trialing"].includes(s.status)) row.mrr += mrrForSub(s as any);
      byPlan.set(key, row);
    }
    const planBreakdown = Array.from(byPlan.entries()).map(([k, v]) => ({ plan: k, ...v, mrr: Math.round(v.mrr * 100) / 100 }));

    const newSubsInRange = allSubs.filter((s) => s.created_at >= startIso && s.created_at <= endIso).length;
    const canceledInRange = allSubs.filter((s) => s.status === "canceled" && s.created_at >= startIso && s.created_at <= endIso).length;
    const trialed = allSubs.filter((s) => s.trial_end !== null).length;
    const trialConverted = allSubs.filter((s) => s.trial_end !== null && s.status === "active").length;
    const trialConversionPct = trialed > 0 ? Math.round((trialConverted / trialed) * 1000) / 10 : 0;

    // --- Learner activity ---
    const [signupsRes, mockRes, profilesCountRes, learnersTotalRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, created_at", { count: "exact" })
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabaseAdmin
        .from("mock_exam_results")
        .select("id, score, created_at", { count: "exact" })
        .gte("created_at", startIso)
        .lte("created_at", endIso),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "learner"),
    ]);

    const mockRows = (mockRes.data ?? []) as Array<{ score: number | null; created_at: string }>;
    const avgScore =
      mockRows.length > 0
        ? Math.round((mockRows.reduce((s, r) => s + (r.score ?? 0), 0) / mockRows.length) * 10) / 10
        : 0;

    // Daily time-series: new signups + mock exams taken
    const daily = new Map<string, { date: string; signups: number; mock_exams: number }>();
    const dayKey = (iso: string) => iso.slice(0, 10);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      daily.set(k, { date: k, signups: 0, mock_exams: 0 });
    }
    for (const p of signupsRes.data ?? []) {
      const k = dayKey((p as any).created_at);
      const row = daily.get(k);
      if (row) row.signups += 1;
    }
    for (const m of mockRows) {
      const k = dayKey(m.created_at);
      const row = daily.get(k);
      if (row) row.mock_exams += 1;
    }
    const timeseries = Array.from(daily.values());

    // --- Top orgs by seats ---
    const orgSubs = allSubs.filter((s) => s.scope === "org" && ["active", "trialing"].includes(s.status));
    const topOrgs = orgSubs
      .slice()
      .sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0))
      .slice(0, 10)
      .map((s) => ({ plan: s.plan_code, seats: s.seats ?? 1, status: s.status }));

    return {
      range: { from: startIso, to: endIso },
      revenue: {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 12 * 100) / 100,
        activeSubs: activeOrTrial.length,
        trialingSubs: activeOrTrial.filter((s) => s.status === "trialing").length,
        newSubsInRange,
        canceledInRange,
        trialConversionPct,
        planBreakdown,
      },
      learners: {
        signupsInRange: signupsRes.count ?? 0,
        totalProfiles: profilesCountRes.count ?? 0,
        totalLearners: learnersTotalRes.count ?? 0,
        mockExamsInRange: mockRes.count ?? 0,
        avgMockScore: avgScore,
      },
      timeseries,
      topOrgs,
    };
  });

export const exportAdminReportsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string }) => rangeInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { assertPermission } = await import("@/lib/admin-auth.server");
    await assertPermission(context.userId, "reports.export");
    const report = await getAdminReports({ data });
    const r = report as any;
    const rows: string[] = [];
    rows.push("section,metric,value");
    rows.push(`revenue,mrr,${r.revenue.mrr}`);
    rows.push(`revenue,arr,${r.revenue.arr}`);
    rows.push(`revenue,active_subs,${r.revenue.activeSubs}`);
    rows.push(`revenue,trialing_subs,${r.revenue.trialingSubs}`);
    rows.push(`revenue,new_subs_in_range,${r.revenue.newSubsInRange}`);
    rows.push(`revenue,canceled_in_range,${r.revenue.canceledInRange}`);
    rows.push(`revenue,trial_conversion_pct,${r.revenue.trialConversionPct}`);
    rows.push(`learners,signups_in_range,${r.learners.signupsInRange}`);
    rows.push(`learners,total_profiles,${r.learners.totalProfiles}`);
    rows.push(`learners,total_learners,${r.learners.totalLearners}`);
    rows.push(`learners,mock_exams_in_range,${r.learners.mockExamsInRange}`);
    rows.push(`learners,avg_mock_score,${r.learners.avgMockScore}`);
    rows.push("");
    rows.push("plan_breakdown,plan,active,trialing,mrr");
    for (const p of r.revenue.planBreakdown) rows.push(`plan_breakdown,${p.plan},${p.active},${p.trialing},${p.mrr}`);
    rows.push("");
    rows.push("timeseries,date,signups,mock_exams");
    for (const t of r.timeseries) rows.push(`timeseries,${t.date},${t.signups},${t.mock_exams}`);
    return { csv: rows.join("\n"), filename: `report_${r.range.from.slice(0, 10)}_to_${r.range.to.slice(0, 10)}.csv` };
  });

// ---- Subscribers list ----

export const listSubscribers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; search?: string; page?: number; pageSize?: number }) =>
    z
      .object({
        status: z.string().optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).max(500).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { assertPermission } = await import("@/lib/admin-auth.server");
    await assertPermission(context.userId, "subscribers.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("subscriptions")
      .select(
        "id, scope, user_id, org_id, plan_code, billing_interval, seats, status, current_period_end, trial_end, cancel_at_period_end, stripe_customer_id, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const pattern = ilikePattern(data.search);
    if (pattern) q = q.or(`plan_code.ilike.${pattern},stripe_customer_id.ilike.${pattern},scope.ilike.${pattern}`);
    const from = (data.page - 1) * data.pageSize;
    q = q.range(from, from + data.pageSize - 1);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    // Hydrate user emails + org names
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))) as string[];
    const orgIds = Array.from(new Set((rows ?? []).map((r) => r.org_id).filter(Boolean))) as string[];
    const emailMap = await loadUserEmails(supabaseAdmin, userIds);
    const orgMap = new Map<string, string>();
    if (orgIds.length > 0) {
      const { data: orgs } = await supabaseAdmin.from("organizations").select("id, name").in("id", orgIds);
      for (const o of orgs ?? []) orgMap.set((o as any).id, (o as any).name);
    }

    return {
      total: count ?? 0,
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        user_email: r.user_id ? emailMap.get(r.user_id) ?? null : null,
        org_name: r.org_id ? orgMap.get(r.org_id) ?? null : null,
      })),
    };
  });
