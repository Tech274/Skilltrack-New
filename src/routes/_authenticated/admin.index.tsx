import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Users, UserCheck, AlertCircle, Wallet, RefreshCw, Package, ClipboardList, BookOpen,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { getAdminDashboard } from "@/lib/admin-dashboard.functions";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard — SkillTrack-365" }] }),
  component: AdminDashboard,
});

const PIE_COLORS = ["hsl(var(--primary))", "#f59e0b", "#ef4444", "#10b981", "#6366f1", "#06b6d4"];

function fmtMoney(n: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

function AdminDashboard() {
  const fn = useServerFn(getAdminDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "dashboard"], queryFn: () => fn() });

  if (isLoading || !data) {
    return <div className="p-8 text-sm text-muted-foreground">Loading dashboard…</div>;
  }

  const k = data.kpis;
  const statusEntries = Object.entries(data.charts.invoiceStatusCounts);
  const subsEntries = Object.entries(data.charts.subsCounts);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live snapshot of learners, revenue, content, and engagement across SkillTrack-365.
          </p>
        </div>
      </div>

      {/* KPI grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Learners" value={k.totalLearners} icon={Users} />
        <KpiCard label="Active Subscribers" value={k.activeSubscribers} icon={UserCheck} />
        <KpiCard label="Pending Payments" value={fmtMoney(Number(k.pendingPayments))} icon={AlertCircle} accent="amber" />
        <KpiCard label="Revenue Collected" value={fmtMoney(Number(k.revenueCollected))} icon={Wallet} accent="emerald" />
        <KpiCard label="Upcoming Renewals" value={k.upcomingRenewals} icon={RefreshCw} />
        <KpiCard label="Certifications" value={k.totalCertifications} icon={Package} />
        <KpiCard label="Mock Exam Attempts" value={k.totalMockExams} icon={ClipboardList} />
        <KpiCard label="Study Resources" value={k.totalStudyResources} icon={BookOpen} />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly Revenue" subtitle="Last 6 months (collected)">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.charts.monthlyRevenue}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))" }} />
              <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Subscriptions" subtitle="Active vs other statuses">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={subsEntries.map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" outerRadius={85} label>
                {subsEntries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Certification Enrollment" subtitle="Top certifications by learner count">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.charts.certEnrollment}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="slug" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Mock Exam Attempts" subtitle="Last 6 months">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.charts.mockAttemptsSeries}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--surface))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tables */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Recent Invoices" cta={<Link to="/admin/invoices" className="text-xs text-primary hover:underline">View all →</Link>}>
          {data.recentInvoices.length === 0 ? <Empty msg="No invoices yet" /> : (
            <ul className="divide-y divide-border/60">
              {data.recentInvoices.map((inv: any) => (
                <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{inv.invoice_number}</div>
                    <div className="text-xs text-muted-foreground">{inv.learner_email ?? "—"} · {new Date(inv.issue_date).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmtMoney(Number(inv.total), inv.currency || "INR")}</div>
                    <StatusPill status={inv.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming Renewals" cta={<Link to="/admin/subscribers" className="text-xs text-primary hover:underline">Manage →</Link>}>
          {data.upcomingRenewals.length === 0 ? <Empty msg="No renewals in the next 30 days" /> : (
            <ul className="divide-y divide-border/60">
              {data.upcomingRenewals.map((s: any) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{s.plan_key}</div>
                    <div className="text-xs text-muted-foreground">Learner {s.learner_id.slice(0, 8)}…</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{s.end_date}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent Learners" cta={<Link to="/admin/learners" className="text-xs text-primary hover:underline">View all →</Link>}>
          {data.recentLearners.length === 0 ? <Empty msg="No learners yet" /> : (
            <ul className="divide-y divide-border/60">
              {data.recentLearners.map((u: any) => (
                <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="font-medium truncate">{u.display_name ?? u.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Invoice status summary */}
      <div className="mt-6">
        <Panel title="Payment Status Summary">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {(statusEntries.length === 0 ? [["—", 0]] : statusEntries).map(([s, n]) => (
              <div key={String(s)} className="rounded-lg border border-border bg-surface px-3 py-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s}</div>
                <div className="mt-1 text-2xl font-semibold">{n as number}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: any; accent?: "amber" | "emerald" }) {
  const tone =
    accent === "amber" ? "text-amber-600" :
    accent === "emerald" ? "text-emerald-600" :
    "text-primary";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon size={16} className={tone} />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Panel({ title, cta, children }: { title: string; cta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {cta}
      </div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-xs text-muted-foreground">{msg}</div>;
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    sent: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    overdue: "bg-destructive/10 text-destructive border-destructive/30",
    draft: "bg-muted text-muted-foreground border-border",
    cancelled: "bg-muted text-muted-foreground border-border",
  };
  return <span className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${map[status] ?? map.draft}`}>{status}</span>;
}
