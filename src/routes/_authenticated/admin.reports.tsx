import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { getAdminReports, exportAdminReportsCsv } from "@/lib/admin-reports.functions";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/reports")({
  head: () => ({ meta: [{ title: "Reports & Analytics — Admin — SkillTrack-365" }] }),
  component: ReportsPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl p-8">
      <p className="text-sm text-destructive">{(error as Error).message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

const RANGE_PRESETS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

function ReportsPage() {
  const fn = useServerFn(getAdminReports);
  const exportFn = useServerFn(exportAdminReportsCsv);
  const [range, setRange] = useState<keyof typeof RANGE_PRESETS>("30d");

  const to = new Date().toISOString();
  const from = new Date(Date.now() - RANGE_PRESETS[range] * 24 * 60 * 60 * 1000).toISOString();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "reports", range],
    queryFn: () => fn({ data: { from, to } }),
  });

  async function handleExport() {
    try {
      const res = await exportFn({ data: { from, to } });
      const blob = new Blob([res.csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <BarChart3 size={22} className="text-primary" /> Reports & Analytics
        </h1>
        <div className="flex items-center gap-2">
          {Object.keys(RANGE_PRESETS).map((k) => (
            <button
              key={k}
              onClick={() => setRange(k as keyof typeof RANGE_PRESETS)}
              className={`rounded-md border px-3 py-1.5 text-xs ${range === k ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated"}`}
            >
              {k}
            </button>
          ))}
          <button
            onClick={handleExport}
            className="ml-2 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:bg-surface-elevated"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-8 text-sm text-destructive">{(error as Error).message}</p>}

      {data && (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <Kpi label="MRR" value={`$${data.revenue.mrr.toLocaleString()}`} sub={`ARR $${data.revenue.arr.toLocaleString()}`} />
            <Kpi label="Active subs" value={data.revenue.activeSubs} sub={`${data.revenue.trialingSubs} trialing`} />
            <Kpi label="New subs" value={data.revenue.newSubsInRange} sub={`${data.revenue.canceledInRange} canceled`} />
            <Kpi label="Trial → paid" value={`${data.revenue.trialConversionPct}%`} sub="conversion" />
            <Kpi label="Signups" value={data.learners.signupsInRange} sub={`${data.learners.totalProfiles} total`} />
            <Kpi label="Learners" value={data.learners.totalLearners} sub="role assigned" />
            <Kpi label="Mock exams" value={data.learners.mockExamsInRange} sub={`avg score ${data.learners.avgMockScore}`} />
            <Kpi label="Plans" value={data.revenue.planBreakdown.length} sub="active SKUs" />
          </div>

          <div className="mt-6 rounded-xl border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Activity</h2>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeseries}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="signups" stroke="hsl(var(--primary))" dot={false} />
                  <Line type="monotone" dataKey="mock_exams" stroke="#10b981" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Plan breakdown</h2>
              <table className="mt-3 w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="text-left">Plan</th><th className="text-right">Active</th><th className="text-right">Trial</th><th className="text-right">MRR</th></tr>
                </thead>
                <tbody>
                  {data.revenue.planBreakdown.map((p: any) => (
                    <tr key={p.plan} className="border-t border-border/60">
                      <td className="py-1.5 font-mono text-xs">{p.plan}</td>
                      <td className="py-1.5 text-right">{p.active}</td>
                      <td className="py-1.5 text-right">{p.trialing}</td>
                      <td className="py-1.5 text-right">${p.mrr.toLocaleString()}</td>
                    </tr>
                  ))}
                  {data.revenue.planBreakdown.length === 0 && <tr><td colSpan={4} className="py-3 text-center text-xs text-muted-foreground">No subscription data yet</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top org subscriptions</h2>
              <table className="mt-3 w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr><th className="text-left">Plan</th><th className="text-right">Seats</th><th className="text-right">Status</th></tr>
                </thead>
                <tbody>
                  {data.topOrgs.map((o: any, i: number) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="py-1.5 font-mono text-xs">{o.plan}</td>
                      <td className="py-1.5 text-right">{o.seats}</td>
                      <td className="py-1.5 text-right capitalize">{o.status}</td>
                    </tr>
                  ))}
                  {data.topOrgs.length === 0 && <tr><td colSpan={3} className="py-3 text-center text-xs text-muted-foreground">No org subscriptions yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
