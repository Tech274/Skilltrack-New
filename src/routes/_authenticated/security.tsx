import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  listSecurityFindings,
  getFindingEvents,
  updateFindingStatus,
  syncSecurityScans,
  grantSelfAdmin,
} from "@/lib/security.functions";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({ meta: [{ title: "Security Findings — SkillTrack-365" }] }),
  component: SecurityPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-xl font-semibold">Security findings</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
        <BootstrapAdmin onDone={() => { reset(); router.invalidate(); }} />
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

const STATUSES = ["open", "triaged", "fixed", "ignored", "reopened"] as const;

function BootstrapAdmin({ onDone }: { onDone: () => void }) {
  const grant = useServerFn(grantSelfAdmin);
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        try { await grant(); toast.success("Admin role granted"); onDone(); }
        catch (e) { toast.error((e as Error).message); }
        finally { setLoading(false); }
      }}
      disabled={loading}
      className="mt-4 rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
    >
      {loading ? "Granting…" : "Bootstrap me as admin"}
    </button>
  );
}

function SecurityPage() {
  const list = useServerFn(listSecurityFindings);
  const events = useServerFn(getFindingEvents);
  const update = useServerFn(updateFindingStatus);
  const sync = useServerFn(syncSecurityScans);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const findingsQ = useQuery({
    queryKey: ["security_findings"],
    queryFn: () => list(),
  });

  const eventsQ = useQuery({
    queryKey: ["security_finding_events", selectedId],
    queryFn: () => events({ data: { findingId: selectedId! } }),
    enabled: !!selectedId,
  });

  const mut = useMutation({
    mutationFn: (v: { id: string; status: string; notes?: string }) => update({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security_findings"] });
      qc.invalidateQueries({ queryKey: ["security_finding_events"] });
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncing = useMutation({
    mutationFn: () => sync({ data: { findings: [] } }),
    onSuccess: () => toast.info("Trigger a scan from Settings → Security; new results will appear here automatically."),
  });

  const findings = (findingsQ.data ?? []).filter((f: any) => filter === "all" ? true : f.status === filter);
  const stats = (findingsQ.data ?? []).reduce((acc: Record<string, number>, f: any) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Security findings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Triage, track, and verify resolution across every scanner.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => syncing.mutate()}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated"
          >Re-sync</button>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "all" : s)}
            className={`rounded-lg border px-4 py-3 text-left transition ${filter === s ? "border-primary bg-surface-elevated" : "border-border bg-surface"}`}
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s}</div>
            <div className="mt-1 text-2xl font-semibold">{stats[s] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Scanner</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last seen</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {findingsQ.isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : findings.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No findings.</td></tr>
            ) : findings.map((f: any) => (
              <tr key={f.id} className="border-t border-border/60 hover:bg-surface/50">
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${f.level === "error" ? "bg-destructive/15 text-destructive" : "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"}`}>
                    {f.level}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{f.scanner_name}</td>
                <td className="px-4 py-3">
                  <button className="text-left hover:text-primary" onClick={() => { setSelectedId(f.id); setNoteDraft(f.notes ?? ""); }}>
                    {f.title}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={f.status}
                    onChange={(e) => mut.mutate({ id: f.id, status: e.target.value, notes: f.notes ?? undefined })}
                    className="rounded border border-border bg-background px-2 py-1 text-xs"
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(f.last_seen_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  {f.link && <a href={f.link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Docs</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (() => {
        const f = (findingsQ.data ?? []).find((x: any) => x.id === selectedId);
        if (!f) return null;
        return (
          <div className="mt-6 rounded-lg border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{f.title}</h2>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{f.scanner_name} · {f.external_id}</p>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-sm text-muted-foreground hover:text-foreground">Close</button>
            </div>
            {f.description && <p className="mt-3 whitespace-pre-wrap text-sm">{f.description}</p>}
            <div className="mt-4">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Triage notes</label>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-border bg-background p-2 text-sm"
              />
              <button
                onClick={() => mut.mutate({ id: f.id, status: f.status, notes: noteDraft })}
                className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >Save notes</button>
            </div>
            <div className="mt-5">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground">History</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {(eventsQ.data ?? []).map((e: any) => (
                  <li key={e.id} className="flex justify-between border-b border-border/40 pb-1">
                    <span><span className="text-muted-foreground">{e.from_status ?? "—"} → </span><strong>{e.to_status}</strong>{e.note && <span className="text-muted-foreground"> · {e.note}</span>}</span>
                    <span className="font-mono text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                  </li>
                ))}
                {eventsQ.data?.length === 0 && <li className="text-muted-foreground">No events yet.</li>}
              </ul>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
