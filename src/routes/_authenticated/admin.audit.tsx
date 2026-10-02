import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { listAuditLog } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Role Audit Log — SkillTrack-365" }] }),
  component: AuditPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-semibold">Role Audit Log</h1>
        <p className="mt-2 text-sm text-destructive">{(error as Error).message}</p>
        <button
          onClick={() => { reset(); router.invalidate(); }}
          className="mt-4 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
        >Retry</button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function AuditPage() {
  const fetcher = useServerFn(listAuditLog);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: () => fetcher(),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
        <span>/</span>
        <Link to="/admin/users" className="hover:text-foreground">Admin</Link>
        <span>/</span>
        <span>Audit Log</span>
      </div>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <ScrollText size={22} className="text-primary" /> Role Audit Log
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every role grant or revoke is recorded with the actor, target, role, and timestamp.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">When</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Target user</th>
              <th className="px-4 py-3 text-left font-medium">Actor</th>
              <th className="px-4 py-3 text-left font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No audit entries yet.</td></tr>
            )}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${r.action === "grant" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
                    {r.action === "grant" ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                    {r.action}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{r.role}</td>
                <td className="px-4 py-3 text-xs">
                  <div>{r.target_email ?? r.target_user_id}</div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {r.actor_email ?? r.actor_id ?? "system"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
