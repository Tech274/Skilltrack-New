import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ShieldCheck, Users, Trash2, Plus, X, Search } from "lucide-react";
import {
  listAllUsers,
  grantUserRole,
  revokeUserRole,
  deleteUser,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "User Management — SkillTrack-365" }] }),
  component: AdminUsersPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-semibold">User Management</h1>
        <p className="mt-2 text-sm text-destructive">{(error as Error).message}</p>
        <button
          onClick={() => { reset(); router.invalidate(); }}
          className="mt-4 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
        >
          Retry
        </button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

const ALL_ROLES = ["learner", "manager", "admin"] as const;
type Role = (typeof ALL_ROLES)[number];

const roleStyles: Record<Role, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  manager: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  learner: "bg-muted text-muted-foreground border-border",
};

function AdminUsersPage() {
  const list = useServerFn(listAllUsers);
  const grant = useServerFn(grantUserRole);
  const revoke = useServerFn(revokeUserRole);
  const del = useServerFn(deleteUser);
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => list(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const grantMut = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => grant({ data: v }),
    onSuccess: () => { toast.success("Role granted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => revoke({ data: v }),
    onSuccess: () => { toast.success("Role revoked"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (userId: string) => del({ data: { userId } }),
    onSuccess: () => { toast.success("User deleted"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u: any) =>
      (u.email ?? "").toLowerCase().includes(term) ||
      (u.display_name ?? "").toLowerCase().includes(term),
    );
  }, [users, q]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u: any) => u.roles.includes("admin")).length;
    const managers = users.filter((u: any) => u.roles.includes("manager")).length;
    return { total, admins, managers };
  }, [users]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
            <span>/</span>
            <span>Admin</span>
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Users size={22} className="text-primary" />
            User Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage all platform users and their access roles.
          </p>
        </div>
        <div className="flex gap-2">
          <Stat label="Total users" value={stats.total} />
          <Stat label="Admins" value={stats.admins} />
          <Stat label="Managers" value={stats.managers} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by email or name…"
            className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Roles</th>
              <th className="px-4 py-3 text-left font-medium">Joined</th>
              <th className="px-4 py-3 text-left font-medium">Last sign-in</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading users…</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users found.</td></tr>
            )}
            {filtered.map((u: any) => {
              const isSuperAdmin = !!u.is_super_admin;
              const missing = ALL_ROLES.filter((r) => !u.roles.includes(r));
              return (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground grid place-items-center">
                          {(u.display_name ?? u.email ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {u.display_name ?? u.email ?? "—"}
                          {isSuperAdmin && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                              <ShieldCheck size={10} /> Super
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {u.roles.map((r: Role) => (
                        <span
                          key={r}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${roleStyles[r] ?? roleStyles.learner}`}
                        >
                          {r}
                          {!(isSuperAdmin && r === "admin") && (
                            <button
                              onClick={() => revokeMut.mutate({ userId: u.id, role: r })}
                              className="ml-0.5 opacity-60 hover:opacity-100"
                              aria-label={`Revoke ${r}`}
                            >
                              <X size={10} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {missing.length > 0 && (
                        <select
                          onChange={(e) => {
                            const role = e.target.value as Role;
                            if (!role) return;
                            grantMut.mutate({ userId: u.id, role });
                            e.currentTarget.value = "";
                          }}
                          defaultValue=""
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                        >
                          <option value="">+ Add role…</option>
                          {missing.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                      {!isSuperAdmin && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${u.email}? This cannot be undone.`)) {
                              delMut.mutate(u.id);
                            }
                          }}
                          className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                          aria-label="Delete user"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        <ShieldCheck size={12} className="inline mr-1" />
        Super Admins cannot be demoted or deleted from this page. Manage super-admin status in the database via the <code>super_admins</code> table.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
