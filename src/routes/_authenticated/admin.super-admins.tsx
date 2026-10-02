import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldAlert, Trash2, Plus, ArrowUpRight, ArrowDownLeft, Download, Filter } from "lucide-react";
import { toast } from "sonner";
import {
  listSuperAdmins,
  grantSuperAdmin,
  revokeSuperAdmin,
  listSuperAdminAuditLog,
  exportSuperAdminAuditLog,
} from "@/lib/super-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/super-admins")({
  head: () => ({ meta: [{ title: "Super Admins — SkillTrack-365" }] }),
  component: SuperAdminsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-semibold">Super Admins</h1>
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

type ConfirmKind = "grant" | "revoke";
type ConfirmState = { kind: ConfirmKind; userId: string; label: string } | null;

function SuperAdminsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSuperAdmins);
  const grantFn = useServerFn(grantSuperAdmin);
  const revokeFn = useServerFn(revokeSuperAdmin);
  const auditFn = useServerFn(listSuperAdminAuditLog);
  const exportFn = useServerFn(exportSuperAdminAuditLog);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "super-admins"],
    queryFn: () => listFn(),
  });

  const [newUserId, setNewUserId] = useState("");
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [phrase, setPhrase] = useState("");

  const grant = useMutation({
    mutationFn: (userId: string) => grantFn({ data: { userId, confirm: true, acknowledgement: "GRANT" } }),
    onSuccess: () => {
      toast.success("Super Admin granted");
      setNewUserId(""); setConfirmState(null); setPhrase("");
      qc.invalidateQueries({ queryKey: ["admin", "super-admins"] });
      qc.invalidateQueries({ queryKey: ["admin", "super-admin-audit"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to grant"),
  });
  const revoke = useMutation({
    mutationFn: (userId: string) => revokeFn({ data: { userId, confirm: true, acknowledgement: "REVOKE" } }),
    onSuccess: () => {
      toast.success("Super Admin revoked");
      setConfirmState(null); setPhrase("");
      qc.invalidateQueries({ queryKey: ["admin", "super-admins"] });
      qc.invalidateQueries({ queryKey: ["admin", "super-admin-audit"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to revoke"),
  });

  // --- Audit log filters & pagination ---
  const [filters, setFilters] = useState({
    actor: "", targetUserId: "", action: "" as "" | "grant" | "revoke",
    from: "", to: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const buildPayload = (f: typeof filters) => ({
    actor: f.actor || null,
    targetUserId: f.targetUserId || null,
    action: f.action || null,
    from: f.from ? new Date(f.from).toISOString() : null,
    to: f.to ? new Date(f.to).toISOString() : null,
    page, pageSize,
  });

  const auditQuery = useQuery({
    queryKey: ["admin", "super-admin-audit", appliedFilters, page],
    queryFn: () => auditFn({ data: buildPayload(appliedFilters) as any }),
  });
  const log = auditQuery.data?.rows ?? [];
  const total = auditQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function applyFilters() {
    setPage(1);
    setAppliedFilters(filters);
  }
  function resetFilters() {
    const empty = { actor: "", targetUserId: "", action: "" as const, from: "", to: "" };
    setFilters(empty); setAppliedFilters(empty); setPage(1);
  }

  async function downloadCsv() {
    try {
      const payload = { ...buildPayload(appliedFilters), page: 1, pageSize: 200 };
      const res: any = await exportFn({ data: payload as any });
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `super-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.count} rows`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    }
  }

  const expectedPhrase = confirmState?.kind === "grant" ? "GRANT" : "REVOKE";

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
        <span>/</span>
        <Link to="/admin/users" className="hover:text-foreground">Admin</Link>
        <span>/</span>
        <span>Super Admins</span>
      </div>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <ShieldAlert size={22} className="text-primary" /> Super Admins
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Super Admins can manage every workspace, every role, and other Super Admins. Grant access only to people you fully trust.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-4">
        <div className="text-sm font-medium">Grant Super Admin by user_id</div>
        <div className="mt-2 flex gap-2">
          <input
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value.trim())}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono"
          />
          <button
            disabled={!newUserId || grant.isPending}
            onClick={() => setConfirmState({ kind: "grant", userId: newUserId, label: newUserId })}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={14} /> Grant
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Rate limited to 5 changes per minute per admin. You'll be asked to type a confirmation phrase before the change is applied.
        </p>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">user_id</th>
              <th className="px-4 py-3 text-left font-medium">Granted by</th>
              <th className="px-4 py-3 text-left font-medium">Since</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No Super Admins.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.user_id} className="border-t border-border/60">
                <td className="px-4 py-3">{r.email ?? "(no email)"}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.user_id}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.granted_by_email ?? r.granted_by ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setConfirmState({ kind: "revoke", userId: r.user_id, label: r.email ?? r.user_id })}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 size={12} /> Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit log section */}
      <div className="mt-10 flex items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Audit log</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every grant or revoke is recorded automatically by a database trigger.
          </p>
        </div>
        <button
          onClick={downloadCsv}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-surface p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <input
            value={filters.actor}
            onChange={(e) => setFilters({ ...filters, actor: e.target.value })}
            placeholder="Actor (email or uuid)"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <input
            value={filters.targetUserId}
            onChange={(e) => setFilters({ ...filters, targetUserId: e.target.value })}
            placeholder="Target (user_id or email)"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono"
          />
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value as any })}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="">All actions</option>
            <option value="grant">Grant</option>
            <option value="revoke">Revoke</option>
          </select>
          <input
            type="datetime-local"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <input
            type="datetime-local"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={applyFilters}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Filter size={14} /> Apply
          </button>
          <button
            onClick={resetFilters}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">When</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Target</th>
              <th className="px-4 py-3 text-left font-medium">Actor</th>
              <th className="px-4 py-3 text-left font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {auditQuery.isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!auditQuery.isLoading && log.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No entries match these filters.</td></tr>
            )}
            {log.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${r.action === "grant" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
                    {r.action === "grant" ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                    {r.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs">{r.target_email ?? r.target_user_id}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.actor_email ?? r.actor_id ?? "system"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <div>{total} entries · page {page} of {totalPages}</div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-border bg-surface px-2 py-1 disabled:opacity-50"
            >Prev</button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-border bg-surface px-2 py-1 disabled:opacity-50"
            >Next</button>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl">
            <h3 className="text-lg font-semibold">
              {confirmState.kind === "grant" ? "Grant Super Admin?" : "Revoke Super Admin?"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You are about to {confirmState.kind} Super Admin access {confirmState.kind === "grant" ? "for" : "from"}{" "}
              <span className="font-medium text-foreground">{confirmState.label}</span>. This change is logged and notifies all admins.
            </p>
            <label className="mt-4 block text-xs text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">{expectedPhrase}</span> to confirm:
            </label>
            <input
              autoFocus
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => { setConfirmState(null); setPhrase(""); }}
                className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
              >Cancel</button>
              <button
                disabled={phrase !== expectedPhrase || grant.isPending || revoke.isPending}
                onClick={() => {
                  if (confirmState.kind === "grant") grant.mutate(confirmState.userId);
                  else revoke.mutate(confirmState.userId);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50 ${confirmState.kind === "revoke" ? "bg-destructive" : "bg-primary"}`}
              >
                {confirmState.kind === "grant" ? "Grant access" : "Revoke access"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
