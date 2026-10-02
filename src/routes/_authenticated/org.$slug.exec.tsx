import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users2, Award, AlertTriangle, TrendingUp } from "lucide-react";
import { getOrgOverview } from "@/lib/org.functions";
import { getCert } from "@/lib/certifications";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/org/$slug/exec")({
  component: ExecDashboard,
});

const COLORS = [
  "oklch(0.78 0.15 78)",
  "oklch(0.65 0.14 250)",
  "oklch(0.72 0.18 155)",
  "oklch(0.62 0.22 25)",
  "oklch(0.78 0.16 75)",
];

function ExecDashboard() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getOrgOverview);
  const q = useQuery({
    queryKey: ["org-overview", slug],
    queryFn: () => fn({ data: { slug } }),
  });

  if (q.isLoading) return <Loading />;
  if (q.error) return <Err message={(q.error as Error).message} />;
  const { members, certifications } = q.data!;

  const total = members.length;
  const passed = certifications.filter((c) => c.status === "passed").length;
  const studying = certifications.filter((c) => c.status === "studying").length;
  const now = Date.now();
  const expiringIn90 = certifications.filter((c) => {
    if (!c.expires_at) return false;
    const d = new Date(c.expires_at).getTime();
    return d > now && d - now < 90 * 24 * 60 * 60 * 1000;
  }).length;
  const expired = certifications.filter(
    (c) => c.expires_at && new Date(c.expires_at).getTime() < now,
  ).length;

  // Vendor breakdown
  const byVendor: Record<string, number> = {};
  for (const c of certifications) {
    if (c.status !== "passed") continue;
    const meta = getCert(c.certification_slug);
    if (!meta) continue;
    byVendor[meta.vendor] = (byVendor[meta.vendor] ?? 0) + 1;
  }
  const vendorData = Object.entries(byVendor).map(([name, value]) => ({ name, value }));

  // Team coverage
  const teamMap: Record<string, { team: string; total: number; certified: number }> = {};
  for (const m of members) {
    const t = m.team ?? "Other";
    teamMap[t] = teamMap[t] ?? { team: t, total: 0, certified: 0 };
    teamMap[t].total += 1;
    if (certifications.some((c) => c.member_id === m.id && c.status === "passed")) {
      teamMap[t].certified += 1;
    }
  }
  const teamData = Object.values(teamMap).map((t) => ({
    team: t.team,
    certified: t.certified,
    uncertified: t.total - t.certified,
  }));

  // ROI proxy: assume $5K avg training cost, $15K avg salary lift per passed cert
  const trainingSpend = passed * 5000;
  const salaryLiftValue = passed * 15000;
  const roiPct = trainingSpend > 0 ? Math.round(((salaryLiftValue - trainingSpend) / trainingSpend) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<Users2 size={16} />} label="Workforce" value={total} sub="active members" />
        <Kpi
          icon={<Award size={16} />}
          label="% Certified"
          value={total ? Math.round((teamData.reduce((s, t) => s + t.certified, 0) / total) * 100) : 0}
          suffix="%"
          sub={`${studying} actively studying`}
        />
        <Kpi
          icon={<AlertTriangle size={16} />}
          label="Renewals due (90d)"
          value={expiringIn90}
          sub={`${expired} expired`}
          tone={expiringIn90 > 5 ? "warn" : undefined}
        />
        <Kpi
          icon={<TrendingUp size={16} />}
          label="Training ROI"
          value={roiPct}
          suffix="%"
          sub={`$${(trainingSpend / 1000).toFixed(0)}K invested`}
          tone={roiPct > 0 ? "good" : undefined}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card/70 p-6 backdrop-blur">
          <h3 className="text-sm font-semibold uppercase tracking-wider">Certification coverage by team</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <BarChart data={teamData}>
                <XAxis dataKey="team" stroke="oklch(0.65 0.02 250)" fontSize={11} />
                <YAxis stroke="oklch(0.65 0.02 250)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.18 0.02 250)",
                    border: "1px solid oklch(0.3 0.02 250)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="certified" stackId="a" fill="oklch(0.72 0.18 155)" name="Certified" />
                <Bar dataKey="uncertified" stackId="a" fill="oklch(0.4 0.02 250)" name="Not certified" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/70 p-6 backdrop-blur">
          <h3 className="text-sm font-semibold uppercase tracking-wider">By vendor</h3>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={vendorData} dataKey="value" nameKey="name" outerRadius={80} label fontSize={10}>
                  {vendorData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.18 0.02 250)",
                    border: "1px solid oklch(0.3 0.02 250)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card/70 p-6 backdrop-blur">
        <h3 className="text-sm font-semibold uppercase tracking-wider">Executive narrative</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            • <strong className="text-foreground">{passed}</strong> verified certifications across{" "}
            <strong className="text-foreground">{total}</strong> employees, generating an estimated{" "}
            <strong className="text-foreground">${(salaryLiftValue / 1000).toFixed(0)}K</strong> in salaried capability.
          </li>
          <li>
            • <strong className="text-foreground">{expiringIn90}</strong> credentials expire in the next 90 days — review the
            Compliance tab to schedule renewals.
          </li>
          <li>
            • Strongest team coverage:{" "}
            <strong className="text-foreground">
              {teamData.sort((a, b) => b.certified - a.certified)[0]?.team ?? "n/a"}
            </strong>
            ; lowest:{" "}
            <strong className="text-foreground">
              {teamData.sort((a, b) => a.certified - b.certified)[0]?.team ?? "n/a"}
            </strong>
            .
          </li>
        </ul>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  suffix,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  sub?: string;
  tone?: "good" | "warn";
}) {
  const color = tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card/70 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-3 font-mono text-3xl font-semibold tracking-tight ${color}`}>
        {value}
        {suffix}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Loading() {
  return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-muted-foreground">Loading…</div>;
}
function Err({ message }: { message: string }) {
  return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-destructive">{message}</div>;
}
