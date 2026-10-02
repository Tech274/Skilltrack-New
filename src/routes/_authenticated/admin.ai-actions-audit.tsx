import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Search, ShieldAlert } from "lucide-react";
import { listAiActionAudit } from "@/lib/admin-ai-actions-audit.functions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/ai-actions-audit")({
  head: () => ({ meta: [{ title: "AI Action Audit — Admin — SkillTrack-365" }] }),
  component: Page,
});

const AREAS = ["all", "extraction", "autofill", "content_gen", "settings"] as const;

function fmtTokens(p: any): string {
  const u = p?.usage;
  if (!u) return "—";
  const t = u.total_tokens ?? ((u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0));
  if (!t) return "—";
  return `${t}${u.prompt_tokens != null ? ` (${u.prompt_tokens}+${u.completion_tokens ?? 0})` : ""}`;
}

function fmtDuration(p: any): string {
  const ms = p?.duration_ms;
  if (typeof ms !== "number") return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function Page() {
  const fetcher = useServerFn(listAiActionAudit);
  const [area, setArea] = useState<(typeof AREAS)[number]>("all");
  const [crossOnly, setCrossOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin", "ai-actions-audit", { area, crossOnly, search, page, pageSize }],
    queryFn: () =>
      fetcher({
        data: {
          area: area === "all" ? undefined : area,
          crossTenantOnly: crossOnly || undefined,
          search: search || undefined,
          page,
          pageSize,
        },
      }),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = data?.pageCount ?? 1;
  const resetPage = () => setPage(1);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ShieldAlert size={20} className="text-primary" /> AI Action Audit
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every AI action: model, tokens used, runtime, org scope, and cross-tenant flags.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Area</Label>
          <Select value={area} onValueChange={(v: any) => { setArea(v); resetPage(); }}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="ct" checked={crossOnly} onCheckedChange={(v) => { setCrossOnly(v); resetPage(); }} />
          <Label htmlFor="ct" className="text-sm">Cross-tenant attempts only</Label>
        </div>
        <form className="relative" onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); resetPage(); }}>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search action, model, target_table"
            className="h-9 w-72 pl-9"
          />
        </form>
        <div>
          <Label className="text-xs">Page size</Label>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); resetPage(); }}>
            <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[25, 50, 100, 200].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left">When</th>
              <th className="px-3 py-2.5 text-left">Actor</th>
              <th className="px-3 py-2.5 text-left">Area</th>
              <th className="px-3 py-2.5 text-left">Action</th>
              <th className="px-3 py-2.5 text-left">Org</th>
              <th className="px-3 py-2.5 text-left">Model</th>
              <th className="px-3 py-2.5 text-right">Tokens</th>
              <th className="px-3 py-2.5 text-right">Time</th>
              <th className="px-3 py-2.5 text-left">Target</th>
              <th className="px-3 py-2.5 text-left">Flags</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">No audit entries match.</td></tr>
            )}
            {rows.map((r: any) => {
              const cross = r.payload?.cross_tenant_attempt === true || String(r.action ?? "").startsWith("cross_tenant:");
              return (
                <tr key={r.id} className={`border-t border-border/60 align-top hover:bg-surface/40 ${cross ? "bg-destructive/5" : ""}`}>
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.actor_label ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.area}</td>
                  <td className="px-3 py-2 text-xs font-medium">{r.action}</td>
                  <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{r.org_id ? r.org_id.slice(0, 8) : "—"}</td>
                  <td className="px-3 py-2 text-xs">{r.model ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums">{fmtTokens(r.payload)}</td>
                  <td className="px-3 py-2 text-xs text-right tabular-nums">{fmtDuration(r.payload)}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.target_table ?? "—"}
                    {r.target_id && <div className="font-mono text-muted-foreground">{String(r.target_id).slice(0, 8)}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {cross && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                        <AlertTriangle size={10} /> cross-tenant
                      </span>
                    )}
                    {r.payload?.usage?.finish_reason && r.payload.usage.finish_reason !== "stop" && (
                      <span className="ml-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700">
                        {r.payload.usage.finish_reason}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
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
