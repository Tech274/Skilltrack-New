import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollText, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { listAuditLog } from "@/lib/admin.functions";
import { listAdminAuditLog } from "@/lib/admin-audit.functions";
import { getAdminRoles } from "@/lib/admin-dashboard.functions";

function AuditError({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-xl font-semibold">Audit Log</h1>
      <p className="mt-2 text-sm text-destructive">{message}</p>
      <button
        onClick={() => {
          reset();
          router.invalidate();
        }}
        className="mt-4 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
      >
        Retry
      </button>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({ meta: [{ title: "Audit Log — SkillTrack-365" }] }),
  component: AuditPage,
  errorComponent: AuditError,
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

type RoleRow = {
  id: string;
  created_at: string;
  action: string;
  role: string;
  target_email: string | null;
  target_user_id: string;
  actor_email: string | null;
  actor_id: string | null;
  source: string | null;
};

type MutationRow = {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  summary: string | null;
};

function AuditPage() {
  const whoFn = useServerFn(getAdminRoles);
  const { data: who } = useQuery({ queryKey: ["admin", "who"], queryFn: () => whoFn() });
  const roleFetcher = useServerFn(listAuditLog);
  const { data: roleRows = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["admin", "role-audit"],
    queryFn: () => roleFetcher() as Promise<RoleRow[]>,
    enabled: Boolean(who?.isSuperAdmin),
  });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const mutationFetcher = useServerFn(listAdminAuditLog);
  const isSuper = Boolean(who?.isSuperAdmin);
  const mutations = useQuery({
    queryKey: ["admin", "mutation-audit", page, submitted],
    queryFn: () =>
      mutationFetcher({ data: { page, pageSize: 50, search: submitted || undefined } }),
    enabled: isSuper,
  });
  const mutationRows = (mutations.data?.rows ?? []) as unknown as MutationRow[];
  const total = mutations.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">
          Dashboard
        </Link>
        <span>/</span>
        <Link to="/admin/users" className="hover:text-foreground">
          Admin
        </Link>
        <span>/</span>
        <span>Audit Log</span>
      </div>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <ScrollText size={22} className="text-primary" /> Audit Log
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Content, invoice, and user changes are appended with the actor, action, target, and time.
        Only Super Admins can read this log.
      </p>

      {who && !isSuper && (
        <p className="mt-6 rounded-lg border border-border bg-surface px-4 py-6 text-sm text-muted-foreground">
          Only Super Admins can read this log.
        </p>
      )}

      {isSuper && (
        <>
          <form
            className="mt-6 flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSubmitted(search.trim());
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search action, target, or summary"
              className="h-9 w-full max-w-sm rounded-md border border-border bg-surface px-3 text-sm"
            />
            <button
              type="submit"
              className="h-9 rounded-md border border-border bg-surface px-3 text-sm hover:bg-surface-elevated"
            >
              Search
            </button>
            <span className="text-xs text-muted-foreground">{total} entries</span>
          </form>

          {mutations.data?.unavailable && (
            <p className="mt-3 text-sm text-muted-foreground">
              The audit table is not available yet. Apply the admin_audit_log migration, then retry.
            </p>
          )}

          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">When</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                  <th className="px-4 py-3 text-left font-medium">Target</th>
                  <th className="px-4 py-3 text-left font-medium">Summary</th>
                  <th className="px-4 py-3 text-left font-medium">Actor</th>
                </tr>
              </thead>
              <tbody>
                {mutations.isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!mutations.isLoading && mutationRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No content, invoice, or user mutations recorded yet.
                    </td>
                  </tr>
                )}
                {mutationRows.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.action}</td>
                    <td className="px-4 py-3 text-xs">
                      <div>{row.target_table}</div>
                      <div className="text-muted-foreground">{row.target_id}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.summary}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.actor_id ?? "unknown"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-md border border-border px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {who?.isSuperAdmin && (
        <>
          <h2 className="mt-10 text-lg font-semibold">Role grants and revokes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every role grant or revoke is recorded with the actor, target, role, and timestamp.
          </p>
          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
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
                {rolesLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!rolesLoading && roleRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No audit entries yet.
                    </td>
                  </tr>
                )}
                {roleRows.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${row.action === "grant" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-destructive/30 bg-destructive/10 text-destructive"}`}
                      >
                        {row.action === "grant" ? (
                          <ArrowUpRight size={10} />
                        ) : (
                          <ArrowDownLeft size={10} />
                        )}
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.role}</td>
                    <td className="px-4 py-3 text-xs">{row.target_email ?? row.target_user_id}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.actor_email ?? row.actor_id ?? "system"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
