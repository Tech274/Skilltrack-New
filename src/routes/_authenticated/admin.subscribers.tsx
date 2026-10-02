import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { listSubscribers } from "@/lib/admin-reports.functions";

export const Route = createFileRoute("/_authenticated/admin/subscribers")({
  head: () => ({ meta: [{ title: "Subscribers — Admin — SkillTrack-365" }] }),
  component: SubscribersPage,
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-3xl p-8">
      <p className="text-sm text-destructive">{(error as Error).message}</p>
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

const STATUSES = ["all", "trialing", "active", "past_due", "canceled", "incomplete"];

function SubscribersPage() {
  const fn = useServerFn(listSubscribers);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "subscribers", status, page],
    queryFn: () => fn({ data: { status, page, pageSize } }),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Wallet size={22} className="text-primary" /> Subscribers
        </h1>
        <div className="flex items-center gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`rounded-md border px-3 py-1.5 text-xs capitalize ${status === s ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated"}`}
            >
              {s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-8 text-sm text-destructive">{(error as Error).message}</p>}

      {data && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Subscriber</th>
                <th className="px-4 py-2 text-left">Plan</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Seats</th>
                <th className="px-4 py-2 text-left">Period end</th>
                <th className="px-4 py-2 text-left">Trial end</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.scope === "org" ? r.org_name ?? r.org_id : r.user_email ?? r.user_id}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{r.scope}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.plan_code} · {r.billing_interval}</td>
                  <td className="px-4 py-2 capitalize">{r.status.replace("_", " ")}{r.cancel_at_period_end ? " (cancels)" : ""}</td>
                  <td className="px-4 py-2 text-right">{r.seats ?? 1}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.trial_end ? new Date(r.trial_end).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">No subscribers found.</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
            <span>{data.total} total</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md border border-border px-2 py-1 disabled:opacity-40">Prev</button>
              <span>Page {page}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={data.rows.length < pageSize} className="rounded-md border border-border px-2 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
