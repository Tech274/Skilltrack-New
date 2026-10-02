import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Brain, Cpu, AlertTriangle, CheckCircle2, Download, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { listAiRecsAudit, exportAiRecsAuditCsv } from "@/lib/admin-ai-audit.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/ai-audit")({
  head: () => ({ meta: [{ title: "AI Recommendations Audit — Admin — SkillTrack-365" }] }),
  component: AiAuditPage,
});

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function AiAuditPage() {
  const fetcher = useServerFn(listAiRecsAudit);
  const exporter = useServerFn(exportAiRecsAuditCsv);

  const [strategy, setStrategy] = useState<"all" | "ai" | "deterministic">("all");
  const [fallbackOnly, setFallbackOnly] = useState(false);
  const [errorOnly, setErrorOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [exporting, setExporting] = useState(false);

  const filters = { strategy, fallbackOnly, errorOnly, search, page, pageSize };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "ai-recs-audit", filters],
    queryFn: () => fetcher({ data: filters }),
  });

  const result = (data && !Array.isArray(data) ? data : null) as
    | { rows: any[]; total: number; page: number; pageSize: number; pageCount: number }
    | null;
  const rows = result?.rows ?? [];
  const total = result?.total ?? 0;
  const pageCount = result?.pageCount ?? 1;

  const resetToPage1 = () => setPage(1);

  const handleExport = async () => {
    setExporting(true);
    try {
      const out = await exporter({ data: { strategy, fallbackOnly, errorOnly, search } });
      downloadCsv(out.filename, out.csv);
      toast.success(`Exported ${out.rowCount} rows`);
    } catch (e: any) {
      toast.error(e?.message ?? "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Recommendations Audit</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-request trail for next-cert recommendations: strategy resolved, source, fallback flag, and the user-friendly message returned.
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <Download size={14} /> {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Strategy</Label>
          <Select value={strategy} onValueChange={(v: any) => { setStrategy(v); resetToPage1(); }}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
              <SelectItem value="deterministic">Deterministic</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="fb" checked={fallbackOnly} onCheckedChange={(v) => { setFallbackOnly(v); resetToPage1(); }} />
          <Label htmlFor="fb" className="text-sm">Fallback only</Label>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="err" checked={errorOnly} onCheckedChange={(v) => { setErrorOnly(v); resetToPage1(); }} />
          <Label htmlFor="err" className="text-sm">Errors only</Label>
        </div>
        <form
          className="relative"
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); resetToPage1(); }}
        >
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search message, error, source"
            className="h-9 w-72 pl-9"
          />
        </form>
        <div>
          <Label className="text-xs">Page size</Label>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); resetToPage1(); }}>
            <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[25, 50, 100, 200].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left">When</th>
              <th className="px-4 py-2.5 text-left">User</th>
              <th className="px-4 py-2.5 text-left">Strategy</th>
              <th className="px-4 py-2.5 text-left">Source</th>
              <th className="px-4 py-2.5 text-left">Fallback</th>
              <th className="px-4 py-2.5 text-right">#</th>
              <th className="px-4 py-2.5 text-left">Message</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No audit entries match these filters.</td></tr>
            )}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60 align-top hover:bg-surface/40">
                <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {r.user_email ?? <span className="text-muted-foreground">{r.user_id?.slice(0, 8) ?? "—"}</span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface px-2 py-0.5 text-xs">
                    {r.strategy === "deterministic" ? <Cpu size={11} /> : <Brain size={11} />}
                    {r.strategy}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs">{r.source}</td>
                <td className="px-4 py-2.5">
                  {r.fallback ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700">
                      <AlertTriangle size={10} /> fallback
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700">
                      <CheckCircle2 size={10} /> ok
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.recommendation_count}</td>
                <td className="px-4 py-2.5 text-xs">
                  <div>{r.message}</div>
                  {r.error && <div className="mt-0.5 text-destructive">{r.error}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {total > 0
            ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`
            : "0 results"}
          {isFetching && !isLoading && " · refreshing…"}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft size={14} /> Prev
          </Button>
          <span>Page {page} / {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
            Next <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
