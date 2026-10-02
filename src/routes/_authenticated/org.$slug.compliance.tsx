import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getOrgOverview } from "@/lib/org.functions";
import { getCert } from "@/lib/certifications";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/org/$slug/compliance")({
  component: Compliance,
});

function Compliance() {
  const { slug } = Route.useParams();
  const fn = useServerFn(getOrgOverview);
  const q = useQuery({ queryKey: ["org-overview", slug], queryFn: () => fn({ data: { slug } }) });
  const [filter, setFilter] = useState<"all" | "expired" | "expiring" | "ok">("all");

  if (q.isLoading) return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-muted-foreground">Loading…</div>;
  if (q.error) return <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-destructive">{(q.error as Error).message}</div>;

  const { members, certifications } = q.data!;
  const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));
  const now = Date.now();

  const rows = certifications
    .map((c) => {
      const m = memberMap[c.member_id];
      const meta = getCert(c.certification_slug);
      const expMs = c.expires_at ? new Date(c.expires_at).getTime() : null;
      const status: "expired" | "expiring" | "ok" | "n/a" =
        expMs === null
          ? "n/a"
          : expMs < now
            ? "expired"
            : expMs - now < 90 * 24 * 60 * 60 * 1000
              ? "expiring"
              : "ok";
      return { c, m, meta, status, expMs };
    })
    .filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => (a.expMs ?? Infinity) - (b.expMs ?? Infinity));

  const counts = {
    expired: certifications.filter((c) => c.expires_at && new Date(c.expires_at).getTime() < now).length,
    expiring: certifications.filter(
      (c) =>
        c.expires_at &&
        new Date(c.expires_at).getTime() > now &&
        new Date(c.expires_at).getTime() - now < 90 * 24 * 60 * 60 * 1000,
    ).length,
    ok: certifications.filter(
      (c) => c.expires_at && new Date(c.expires_at).getTime() - now >= 90 * 24 * 60 * 60 * 1000,
    ).length,
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile label="Expired" value={counts.expired} icon={<AlertTriangle size={16} />} tone="bad" onClick={() => setFilter("expired")} active={filter === "expired"} />
        <Tile label="Expiring (90d)" value={counts.expiring} icon={<Clock size={16} />} tone="warn" onClick={() => setFilter("expiring")} active={filter === "expiring"} />
        <Tile label="Compliant" value={counts.ok} icon={<CheckCircle2 size={16} />} tone="good" onClick={() => setFilter("ok")} active={filter === "ok"} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Renewal queue</h2>
        <button
          onClick={() => setFilter("all")}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Show all
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card/40">
            <tr>
              <Th>Employee</Th>
              <Th>Team</Th>
              <Th>Certification</Th>
              <Th>Status</Th>
              <Th>Expires</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-xs text-muted-foreground">
                  No certifications match this filter.
                </td>
              </tr>
            ) : (
              rows.slice(0, 50).map(({ c, m, meta, status, expMs }) => (
                <tr key={c.id}>
                  <Td className="font-medium">{m?.full_name ?? "—"}</Td>
                  <Td>{m?.team ?? "—"}</Td>
                  <Td>
                    <div>{meta?.name ?? c.certification_slug}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{meta?.code}</div>
                  </Td>
                  <Td>
                    <StatusBadge s={status} />
                  </Td>
                  <Td className="font-mono text-xs">
                    {expMs ? new Date(expMs).toLocaleDateString() : "—"}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "good" | "warn" | "bad";
  active: boolean;
  onClick: () => void;
}) {
  const color = tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : "text-destructive";
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-card/70 p-5 text-left backdrop-blur transition-colors ${
        active ? "border-primary/60" : "border-border hover:border-primary/30"
      }`}
    >
      <div className={`flex items-center gap-2 ${color}`}>
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-3 font-mono text-3xl font-semibold ${color}`}>{value}</p>
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="p-3 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-3 ${className ?? ""}`}>{children}</td>;
}
function StatusBadge({ s }: { s: "expired" | "expiring" | "ok" | "n/a" }) {
  const map = {
    expired: "bg-destructive/15 text-destructive",
    expiring: "bg-warning/15 text-warning",
    ok: "bg-success/15 text-success",
    "n/a": "bg-muted text-muted-foreground",
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[s]}`}>
      {s === "n/a" ? "No expiry" : s}
    </span>
  );
}
