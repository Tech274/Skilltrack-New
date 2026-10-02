import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, X, AlertCircle, Loader2, RefreshCcw, Save, Columns } from "lucide-react";
import {
  getExtractionJob, editStagedRow, setStagedRowStatus, commitStagedRows,
  saveColumnMap, getTargetSchemaFields, rerunExtractionJob,
} from "@/lib/ai-extraction.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";



export const Route = createFileRoute("/_authenticated/admin/ai-imports/$jobId")({
  head: () => ({ meta: [{ title: "Review AI Import — Admin — SkillTrack-365" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { jobId } = Route.useParams();
  const getFn = useServerFn(getExtractionJob);
  const editFn = useServerFn(editStagedRow);
  const setStatusFn = useServerFn(setStagedRowStatus);
  const commitFn = useServerFn(commitStagedRows);
  const saveMapFn = useServerFn(saveColumnMap);
  const getFieldsFn = useServerFn(getTargetSchemaFields);
  const rerunFn = useServerFn(rerunExtractionJob);
  const qc = useQueryClient();


  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-imports", "job", jobId],
    queryFn: () => getFn({ data: { job_id: jobId } }),
    refetchInterval: (q) => (q.state.data?.job?.status === "running" || q.state.data?.job?.status === "queued") ? 3000 : false,
  });

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, any>>({}); // row_id -> draft normalized json
  const [mapDraft, setMapDraft] = useState<Record<string, string> | null>(null);

  const rows = data?.rows ?? [];
  const job = data?.job;
  const conflicts = (data?.conflicts ?? {}) as Record<
    string,
    Array<{ field: string; level: "error" | "warn"; message: string }>
  >;

  const tabularHeaders: string[] = (job?.tabular_headers as string[] | null) ?? [];
  const hasTabular = tabularHeaders.length > 0;
  const existingMap = (job?.column_map ?? {}) as Record<string, string>;

  const fieldsQuery = useQuery({
    queryKey: ["ai-imports", "fields", job?.target_entity],
    queryFn: () => getFieldsFn({ data: { target_entity: job!.target_entity } }),
    enabled: !!job?.target_entity && hasTabular,
  });

  useEffect(() => {
    if (hasTabular && mapDraft === null) {
      setMapDraft(Object.fromEntries(tabularHeaders.map((h) => [h, existingMap[h] ?? ""])));
    }
  }, [hasTabular, tabularHeaders, mapDraft, existingMap]);

  const saveMapMut = useMutation({
    mutationFn: (map: Record<string, string>) => saveMapFn({ data: { job_id: jobId, column_map: map } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-imports", "job", jobId] }); toast.success("Mapping saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const rerunMut = useMutation({
    mutationFn: () => rerunFn({ data: { job_id: jobId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-imports", "job", jobId] }); toast.success("Re-running with mapping…"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });



  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);
  const pendingIds = useMemo(() => rows.filter((r: any) => r.status === "pending" || r.status === "approved").map((r: any) => r.id), [rows]);
  const blockedSelected = useMemo(
    () => selectedIds.filter((id) => (conflicts[id] ?? []).some((c) => c.level === "error")),
    [selectedIds, conflicts],
  );

  const editMut = useMutation({
    mutationFn: ({ row_id, patch }: any) => editFn({ data: { row_id, patch } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-imports", "job", jobId] }); toast.success("Saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const statusMut = useMutation({
    mutationFn: (status: "approved" | "rejected") => setStatusFn({ data: { row_ids: selectedIds, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ai-imports", "job", jobId] }); setSelected({}); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const commitMut = useMutation({
    mutationFn: () => {
      if (blockedSelected.length) throw new Error(`${blockedSelected.length} selected row(s) have unresolved conflicts.`);
      return commitFn({ data: { row_ids: selectedIds } });
    },
    onSuccess: (res) => {
      const ok = res.results.filter((r) => r.ok).length;
      const fail = res.results.length - ok;
      if (fail > 0) toast.error(`${ok} committed, ${fail} failed`);
      else toast.success(`Committed ${ok} rows`);
      qc.invalidateQueries({ queryKey: ["ai-imports", "job", jobId] });
      setSelected({});
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });


  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/admin/ai-imports" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft size={12} className="mr-1" /> Back to imports
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Review staged rows</h1>
          <p className="text-xs text-muted-foreground">
            {job ? <>Target: <code className="rounded bg-muted px-1.5 py-0.5">{job.target_entity}</code> · Status: {job.status} · Model: {job.model ?? "—"}</> : "Loading…"}
          </p>
          {job?.error && <p className="mt-2 text-sm text-destructive">{job.error}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCcw size={12} className="mr-1.5" /> Refresh</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-surface/40 p-3">
        <Checkbox
          checked={selectedIds.length > 0 && selectedIds.length === pendingIds.length}
          onCheckedChange={(c) => {
            if (c) setSelected(Object.fromEntries(pendingIds.map((id) => [id, true])));
            else setSelected({});
          }}
        />
        <span className="text-xs text-muted-foreground">
          {selectedIds.length} selected
          {blockedSelected.length > 0 && (
            <span className="ml-2 text-amber-600">· {blockedSelected.length} blocked by conflicts</span>
          )}
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={!selectedIds.length} onClick={() => statusMut.mutate("rejected")}><X size={12} className="mr-1" /> Reject</Button>
          <Button size="sm" variant="outline" disabled={!selectedIds.length} onClick={() => statusMut.mutate("approved")}><Check size={12} className="mr-1" /> Approve</Button>
          <Button size="sm" disabled={!selectedIds.length || commitMut.isPending || blockedSelected.length > 0} onClick={() => commitMut.mutate()}>
            {commitMut.isPending ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Save size={12} className="mr-1" />}
            Commit
          </Button>
        </div>
      </div>

      {hasTabular && (
        <div className="space-y-2 rounded-md border border-border/60 bg-surface/40 p-3">
          <div className="flex items-center gap-2">
            <Columns size={14} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold">Column mapping</h2>
            <span className="text-xs text-muted-foreground">
              Map each spreadsheet column to a schema field. Mapped columns skip the LLM and use deterministic normalization.
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {tabularHeaders.map((h) => (
              <div key={h} className="flex items-center gap-2 text-xs">
                <code className="min-w-0 flex-1 truncate rounded bg-muted px-1.5 py-0.5" title={h}>{h}</code>
                <span className="text-muted-foreground">→</span>
                <select
                  className="min-w-[10rem] rounded-md border border-border bg-background px-2 py-1 text-xs"
                  value={mapDraft?.[h] ?? ""}
                  onChange={(e) => setMapDraft((m) => ({ ...(m ?? {}), [h]: e.target.value }))}
                >
                  <option value="">— ignore —</option>
                  {(fieldsQuery.data?.fields ?? []).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!mapDraft || saveMapMut.isPending}
              onClick={() => mapDraft && saveMapMut.mutate(
                Object.fromEntries(Object.entries(mapDraft).filter(([, v]) => v))
              )}
            >
              <Save size={12} className="mr-1" /> Save mapping
            </Button>
            <Button
              size="sm"
              disabled={rerunMut.isPending}
              onClick={async () => {
                if (mapDraft) await saveMapMut.mutateAsync(
                  Object.fromEntries(Object.entries(mapDraft).filter(([, v]) => v))
                );
                rerunMut.mutate();
              }}
            >
              {rerunMut.isPending ? <Loader2 size={12} className="mr-1 animate-spin" /> : <RefreshCcw size={12} className="mr-1" />}
              Save &amp; re-run extraction
            </Button>
            <span className="text-xs text-muted-foreground">
              {Object.values(mapDraft ?? {}).filter(Boolean).length} of {tabularHeaders.length} mapped
            </span>
          </div>
        </div>
      )}




      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-10 text-center text-muted-foreground">
          {job?.status === "running" || job?.status === "queued" ? "Job still running…" : "No rows."}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r: any) => {
            const errs = (r.validation_errors as string[]) ?? [];
            const rowConflicts = conflicts[r.id] ?? [];
            const hasBlockingConflict = rowConflicts.some((c) => c.level === "error");
            const normalized = (r.normalized ?? r.payload ?? {}) as Record<string, any>;
            const fields = Object.entries(normalized).filter(([k]) => k !== "_meta");
            const draftKey = r.id;
            const draft = editing[draftKey] ?? JSON.stringify(normalized, null, 2);
            return (
              <div key={r.id} className={`rounded-md border p-3 ${r.status === "committed" ? "border-primary/40 bg-primary/5" : r.status === "rejected" ? "border-border/40 bg-muted/30 opacity-60" : hasBlockingConflict ? "border-destructive/50" : "border-border/60"}`}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    disabled={r.status === "committed" || r.status === "rejected"}
                    checked={!!selected[r.id]}
                    onCheckedChange={(c) => setSelected((s) => ({ ...s, [r.id]: !!c }))}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">#{r.position}</span>
                      <span className="rounded-full border px-2 py-0.5 uppercase">{r.status}</span>
                      {errs.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-600">
                          <AlertCircle size={10} /> {errs.length} validation issue{errs.length === 1 ? "" : "s"}
                        </span>
                      )}
                      {rowConflicts.length > 0 && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${hasBlockingConflict ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-amber-500/40 bg-amber-500/10 text-amber-600"}`}>
                          <AlertCircle size={10} /> {rowConflicts.length} conflict{rowConflicts.length === 1 ? "" : "s"}
                        </span>
                      )}
                      {r.target_row_id && <span className="text-muted-foreground">→ {r.target_row_id}</span>}
                    </div>

                    {(errs.length > 0 || rowConflicts.length > 0) && (
                      <div className="space-y-1 rounded-md border border-border/50 bg-muted/20 p-2">
                        {errs.map((e, i) => (
                          <div key={`v${i}`} className="flex items-start gap-2 text-xs text-amber-700">
                            <AlertCircle size={11} className="mt-0.5 shrink-0" />
                            <span><span className="font-mono font-semibold">validation</span> · {e}</span>
                          </div>
                        ))}
                        {rowConflicts.map((c, i) => (
                          <div key={`c${i}`} className={`flex items-start gap-2 text-xs ${c.level === "error" ? "text-destructive" : "text-amber-700"}`}>
                            <AlertCircle size={11} className="mt-0.5 shrink-0" />
                            <span><span className="font-mono font-semibold">{c.field}</span> · {c.message}</span>
                          </div>
                        ))}
                        {hasBlockingConflict && (
                          <p className="pt-1 text-[11px] text-destructive">
                            Resolve the conflict above (edit the field below or reject this row) before committing.
                          </p>
                        )}
                      </div>
                    )}

                    {fields.length > 0 && (
                      <div className="grid grid-cols-1 gap-1 rounded-md border border-border/40 bg-background/40 p-2 text-xs md:grid-cols-2">
                        {fields.map(([k, v]) => {
                          const fieldHasIssue = rowConflicts.some((c) => c.field === k);
                          return (
                            <div key={k} className="flex gap-2 min-w-0">
                              <span className={`font-mono shrink-0 ${fieldHasIssue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{k}:</span>
                              <span className="truncate" title={typeof v === "string" ? v : JSON.stringify(v)}>
                                {v === null || v === undefined || v === ""
                                  ? <span className="italic text-muted-foreground">empty</span>
                                  : typeof v === "object"
                                    ? JSON.stringify(v)
                                    : String(v)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Edit JSON</summary>
                      <Textarea
                        className="mt-2 font-mono text-xs"
                        rows={Math.min(20, Math.max(5, draft.split("\n").length))}
                        value={draft}
                        onChange={(e) => setEditing((s) => ({ ...s, [draftKey]: e.target.value }))}
                        disabled={r.status === "committed" || r.status === "rejected"}
                      />
                    </details>
                    {editing[draftKey] !== undefined && r.status !== "committed" && r.status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          try {
                            const patch = JSON.parse(editing[draftKey]);
                            editMut.mutate({ row_id: r.id, patch });
                            setEditing((s) => { const c = { ...s }; delete c[draftKey]; return c; });
                          } catch (e: any) {
                            toast.error("Invalid JSON");
                          }
                        }}
                      >
                        <Save size={12} className="mr-1" /> Save edits
                      </Button>
                    )}

                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
