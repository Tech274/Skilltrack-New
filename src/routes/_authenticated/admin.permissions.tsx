import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Download, FileText, History } from "lucide-react";
import { listPermissions, updatePermission, checkIsAdmin, listPermissionAudit } from "@/lib/admin.functions";
import { AdminErrorScreen } from "@/components/admin/admin-error";
import { buildPermissionCsv, downloadCsv, openPermissionPdf, type MatrixRow } from "@/lib/permission-export";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/permissions")({
  head: () => ({ meta: [{ title: "Role Permissions — SkillTrack-365" }] }),
  component: PermissionsPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <AdminErrorScreen
        title="Role Permissions"
        error={error}
        onRetry={() => { reset(); router.invalidate(); }}
      />
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

const ROLES = [
  "learner",
  "manager",
  "admin",
  "content_admin",
  "finance_admin",
  "support_admin",
  "certification_admin",
  "lab_admin",
  "operations_admin",
] as const;

const ROLE_LABEL: Record<(typeof ROLES)[number], string> = {
  learner: "Learner",
  manager: "Manager",
  admin: "Admin",
  content_admin: "Content Admin",
  finance_admin: "Finance Admin",
  support_admin: "Support Admin",
  certification_admin: "Certification Admin",
  lab_admin: "Lab Admin",
  operations_admin: "Operations Admin",
};

function PermissionsPage() {
  const fetcher = useServerFn(listPermissions);
  const updater = useServerFn(updatePermission);
  const checker = useServerFn(checkIsAdmin);
  const auditFn = useServerFn(listPermissionAudit);
  const qc = useQueryClient();
  const [showAudit, setShowAudit] = useState(false);

  const { data: who } = useQuery({ queryKey: ["admin", "who"], queryFn: () => checker() });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "permissions"],
    queryFn: () => fetcher(),
  });
  const { data: audit = [] } = useQuery({
    queryKey: ["admin", "permissions", "audit"],
    queryFn: () => auditFn(),
    enabled: showAudit && !!who?.isSuperAdmin,
  });

  const canEdit = !!who?.isSuperAdmin;

  type Group = { description: string | null; byRole: Record<string, { id: string; allowed: boolean }> };
  const grouped = useMemo(() => {
    const map = new Map<string, Group>();
    for (const r of rows as any[]) {
      const g: Group = map.get(r.permission) ?? { description: r.description, byRole: {} };
      g.byRole[r.role] = { id: r.id, allowed: r.allowed };
      if (!g.description && r.description) g.description = r.description;
      map.set(r.permission, g);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const exportRows: MatrixRow[] = useMemo(
    () => grouped.map(([permission, g]) => ({
      permission,
      description: g.description,
      byRole: Object.fromEntries(ROLES.map((r) => [r, g.byRole[r]?.allowed ?? null])),
    })),
    [grouped],
  );

  const mut = useMutation({
    mutationFn: (v: { role: (typeof ROLES)[number]; permission: string; allowed: boolean }) => updater({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "permissions"] });
      qc.invalidateQueries({ queryKey: ["admin", "permissions", "audit"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleCsv = () => {
    const csv = buildPermissionCsv(ROLES as unknown as string[], ROLE_LABEL, exportRows);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`permission-matrix-${stamp}.csv`, csv);
  };
  const handlePdf = () => {
    openPermissionPdf(ROLES as unknown as string[], ROLE_LABEL, exportRows, {
      generatedAt: new Date().toISOString(),
      generatedBy: who?.email ?? null,
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
        <span>/</span>
        <Link to="/admin/users" className="hover:text-foreground">Admin</Link>
        <span>/</span>
        <span>Permissions</span>
      </div>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Shield size={22} className="text-primary" /> Role Permissions Matrix
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canEdit
              ? "Toggle which actions each role is allowed to perform. Changes are saved instantly and audited."
              : "Read-only view. Only the Super Admin can change permissions."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCsv}
            disabled={exportRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated disabled:opacity-50"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={handlePdf}
            disabled={exportRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated disabled:opacity-50"
          >
            <FileText size={14} /> PDF
          </button>
          {canEdit && (
            <button
              onClick={() => setShowAudit((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
            >
              <History size={14} /> {showAudit ? "Hide" : "View"} audit log
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Permission</th>
              {ROLES.map((r) => (
                <th key={r} className="px-4 py-3 text-center font-medium">{ROLE_LABEL[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={ROLES.length + 1} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {grouped.map(([permission, g]) => (
              <tr key={permission} className="border-t border-border/60">
                <td className="px-4 py-3">
                  <div className="font-medium">{permission}</div>
                  {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                </td>
                {ROLES.map((role) => {
                  const cell = g.byRole[role];
                  if (!cell) return <td key={role} className="px-4 py-3 text-center text-muted-foreground">—</td>;
                  return (
                    <td key={role} className="px-4 py-3 text-center">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={!canEdit || mut.isPending}
                          checked={cell.allowed}
                          onChange={(e) => mut.mutate({ role, permission, allowed: e.target.checked })}
                          className="h-4 w-4 rounded border-border accent-primary disabled:opacity-50"
                        />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAudit && canEdit && (
        <div className="mt-8 rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">
            Permission Change Audit Log
            <span className="ml-2 text-xs font-normal text-muted-foreground">Last {audit.length} changes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full text-sm">
              <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">When</th>
                  <th className="px-4 py-2 text-left font-medium">Actor</th>
                  <th className="px-4 py-2 text-left font-medium">Role</th>
                  <th className="px-4 py-2 text-left font-medium">Permission</th>
                  <th className="px-4 py-2 text-left font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {audit.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No changes recorded yet.</td></tr>
                )}
                {(audit as any[]).map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs">{r.actor_email ?? r.actor_id ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{ROLE_LABEL[r.role as (typeof ROLES)[number]] ?? r.role}</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.permission}</td>
                    <td className="px-4 py-2 text-xs">
                      <span className="text-muted-foreground">{r.previous_allowed == null ? "—" : r.previous_allowed ? "Allowed" : "Denied"}</span>
                      <span className="mx-1.5">→</span>
                      <span className={r.new_allowed ? "font-medium text-primary" : "font-medium text-destructive"}>
                        {r.new_allowed ? "Allowed" : "Denied"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
