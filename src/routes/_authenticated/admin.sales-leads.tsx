import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, AlertTriangle, Search, Link2, Copy } from "lucide-react";
import {
  listSalesLeads,
  updateSalesLeadStatus,
  LEAD_STATUSES,
  type SalesLead,
} from "@/lib/sales-leads.functions";
import { buildHandoffUrl, SKILLHUB_BASE_URL } from "@/lib/handoff";
import { SavedLeadsPanel } from "@/components/admin/saved-leads-panel";
import { guardLeadAccess } from "@/lib/admin-leads.functions";

export const Route = createFileRoute("/_authenticated/admin/sales-leads")({
  beforeLoad: async () => {
    try {
      await guardLeadAccess();
    } catch {
      throw redirect({ to: "/admin" });
    }
  },
  head: () => ({
    meta: [
      { title: "Leads — SkillTrack-365 Admin" },
      { name: "description", content: "Sales pipeline and saved form enquiries." },
      { property: "og:title", content: "Leads — SkillTrack-365 Admin" },
      { property: "og:description", content: "Sales pipeline and saved form enquiries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SalesLeadsPage,
});

const STATUS_TONE: Record<string, string> = {
  New: "border-accent/40 text-accent",
  Contacted: "border-border text-foreground",
  Qualified: "border-primary/40 text-primary",
  "Demo booked": "border-primary/40 text-primary",
  Won: "border-success/40 text-success",
  Lost: "border-warning/40 text-warning",
};

/** Best-effort first cert token from free-text interest (never invent). */
function guessCertFromInterest(certs?: string | null): string | undefined {
  const raw = (certs || "").trim();
  if (!raw) return undefined;
  const token = raw.split(/[,;/|]+/)[0]?.trim();
  if (!token) return undefined;
  return token.slice(0, 64);
}

async function copyHubUnlockLink(lead: SalesLead) {
  const url = buildHandoffUrl(SKILLHUB_BASE_URL, {
    email: lead.email || undefined,
    phone: lead.phone || undefined,
    cert: guessCertFromInterest(lead.certs),
    lead: String(lead.row),
  });
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Hub unlock link copied");
  } catch {
    toast.error("Couldn't copy — select and copy manually", { description: url });
  }
}

function SalesLeadsPage() {
  const listFn = useServerFn(listSalesLeads);
  const updateFn = useServerFn(updateSalesLeadStatus);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const query = useQuery({
    queryKey: ["sales-leads"],
    queryFn: () => listFn(),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (vars: { row: number; status: (typeof LEAD_STATUSES)[number] }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Status updated in the Sheet");
      qc.invalidateQueries({ queryKey: ["sales-leads"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  const denied =
    query.isError && String((query.error as Error).message).toLowerCase().includes("lead access");
  const rows: SalesLead[] = denied ? [] : (query.data?.rows ?? []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!needle) return true;
      return `${r.name} ${r.email} ${r.phone} ${r.certs} ${r.notes}`.toLowerCase().includes(needle);
    });
  }, [rows, q, statusFilter]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows) m[r.status] = (m[r.status] ?? 0) + 1;
    return m;
  }, [rows]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Book-a-call pipeline from the Sales queue sheet. Status changes are written straight
            back to it. Saved form enquiries from every source are listed below.
          </p>
        </div>
        <button
          onClick={() => query.refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated"
        >
          <RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {query.isLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading leads…
        </div>
      )}

      {denied && (
        <p className="mt-8 rounded-lg border border-border bg-surface px-4 py-6 text-sm text-muted-foreground">
          Lead names, emails, and phone numbers are limited to sales-leads roles.
        </p>
      )}

      {query.isError && !denied && (
        <div className="mt-8 rounded-xl border border-warning/40 bg-surface p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-warning">
            <AlertTriangle size={15} /> Can't read the Sales queue yet
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{(query.error as Error).message}</p>
          <div className="mt-4 rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">One-time setup</div>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Open the Sales queue Google Sheet → Extensions → Apps Script.</li>
              <li>
                Paste the script from <code>docs/apps-script-sales-queue.gs</code> in this project
                (it keeps the existing form intake and adds reading + status updates).
              </li>
              <li>
                Deploy → Manage deployments → Edit → New version → Deploy (same deployment, same
                URL).
              </li>
              <li>Come back here and press Refresh.</li>
            </ol>
          </div>
        </div>
      )}

      {query.isSuccess && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {["all", ...LEAD_STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  statusFilter === s
                    ? "border-primary/50 bg-surface-elevated text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? `All (${rows.length})` : `${s} (${counts[s] ?? 0})`}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, email, phone…"
                className="w-64 rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Interest</th>
                  <th className="px-4 py-3">Timing</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Hub unlock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.row} className="border-b border-border/60 align-top last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {r.timestamp ? new Date(r.timestamp).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                      <div className="text-xs text-muted-foreground">{r.phone}</div>
                      {r.notes && (
                        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{r.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.certs || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.timing || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.hear_about || "—"}
                      {(r.utm_source || r.utm_campaign) && (
                        <div className="mt-1 font-mono text-[11px]">
                          {[r.utm_source, r.utm_medium, r.utm_campaign].filter(Boolean).join(" / ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={LEAD_STATUSES.includes(r.status as any) ? r.status : "New"}
                        disabled={mutation.isPending}
                        onChange={(e) =>
                          mutation.mutate({
                            row: r.row,
                            status: e.target.value as (typeof LEAD_STATUSES)[number],
                          })
                        }
                        className={`rounded-md border bg-background px-2 py-1.5 text-xs outline-none ${
                          STATUS_TONE[r.status] ?? "border-border"
                        }`}
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "Won" ? (
                        <div className="max-w-[220px] space-y-2">
                          <button
                            type="button"
                            onClick={() => copyHubUnlockLink(r)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-background px-2.5 py-1.5 text-xs font-medium text-success hover:bg-surface-elevated"
                          >
                            <Copy size={12} /> Copy Hub unlock link
                          </button>
                          <ol className="list-decimal space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                            <li>Confirm payment proof (UPI / bank).</li>
                            <li>Send learner this link (email prefilled when known).</li>
                            <li>
                              Ops: mark Hub granted Y/N on the sheet — manual grant in SkillHub
                              Access Catalogue (no Track entitlement DB this cut).
                            </li>
                          </ol>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Link2 size={11} /> Set Won to unlock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No leads match this view yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!denied && <SavedLeadsPanel />}
    </div>
  );
}
