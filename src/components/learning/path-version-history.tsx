import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, RotateCcw, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPathVersions, diffPathVersions, rollbackPathVersion } from "@/lib/learning-paths.functions";

export function PathVersionHistory({ pathId, onRolledBack }: { pathId: string; onRolledBack: () => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPathVersions);
  const diffFn = useServerFn(diffPathVersions);
  const rollFn = useServerFn(rollbackPathVersion);

  const q = useQuery({ queryKey: ["lp-versions", pathId], queryFn: () => listFn({ data: { path_id: pathId } }) });
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ added: string[]; removed: string[]; changed: { field: string; from: any; to: any }[] } | null>(null);

  const compute = useMutation({
    mutationFn: () => diffFn({ data: { from_id: fromId!, to_id: toId! } }),
    onSuccess: (res) => {
      const a = (res.from?.snapshot ?? {}) as any;
      const b = (res.to?.snapshot ?? {}) as any;
      const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
      const changed: any[] = [];
      const added: string[] = [];
      const removed: string[] = [];
      for (const k of keys) {
        const av = JSON.stringify(a[k] ?? null);
        const bv = JSON.stringify(b[k] ?? null);
        if (av === bv) continue;
        if (a[k] == null) added.push(k);
        else if (b[k] == null) removed.push(k);
        else changed.push({ field: k, from: a[k], to: b[k] });
      }
      setDiff({ added, removed, changed });
    },
    onError: (e: any) => toast.error(e?.message ?? "Diff failed"),
  });

  const rollback = useMutation({
    mutationFn: (version_id: string) => rollFn({ data: { path_id: pathId, version_id } }),
    onSuccess: () => {
      toast.success("Rolled back");
      qc.invalidateQueries({ queryKey: ["lp-versions", pathId] });
      qc.invalidateQueries({ queryKey: ["lp", pathId] });
      onRolledBack();
    },
    onError: (e: any) => toast.error(e?.message ?? "Rollback failed"),
  });

  const rows = q.data?.rows ?? [];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><History size={14} /> Version history</h3>
        <Button size="sm" variant="outline" disabled={!fromId || !toId || fromId === toId || compute.isPending} onClick={() => compute.mutate()}>
          <GitCompareArrows size={12} className="mr-1" /> Compare
        </Button>
      </div>
      {q.isLoading && <p className="mt-3 text-xs text-muted-foreground">Loading…</p>}
      {!q.isLoading && rows.length === 0 && <p className="mt-3 text-xs text-muted-foreground">No saved versions yet. Save the path to create one.</p>}
      <div className="mt-3 max-h-72 space-y-1 overflow-auto">
        {rows.map((v: any) => (
          <div key={v.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs">
            <Badge variant="outline">v{v.version_number}</Badge>
            <span className="flex-1 truncate">{v.label || "—"}</span>
            <span className="text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
            <label className="flex items-center gap-1">
              <input type="radio" name="from" checked={fromId === v.id} onChange={() => setFromId(v.id)} /> A
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" name="to" checked={toId === v.id} onChange={() => setToId(v.id)} /> B
            </label>
            <Button size="sm" variant="ghost" onClick={() => rollback.mutate(v.id)} disabled={rollback.isPending}>
              <RotateCcw size={12} className="mr-1" /> Rollback
            </Button>
          </div>
        ))}
      </div>

      {diff && (
        <div className="mt-3 rounded-md border border-border/60 p-3 text-xs">
          <p className="mb-2 font-semibold">Diff (A → B)</p>
          {diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0 && (
            <p className="text-muted-foreground">No differences.</p>
          )}
          {diff.added.map((f) => <div key={f} className="text-emerald-500">+ {f}</div>)}
          {diff.removed.map((f) => <div key={f} className="text-destructive">− {f}</div>)}
          {diff.changed.map((c) => (
            <details key={c.field} className="mt-1">
              <summary className="cursor-pointer">~ {c.field}</summary>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <pre className="overflow-auto rounded bg-muted/50 p-2"><code>{JSON.stringify(c.from, null, 2)}</code></pre>
                <pre className="overflow-auto rounded bg-muted/50 p-2"><code>{JSON.stringify(c.to, null, 2)}</code></pre>
              </div>
            </details>
          ))}
        </div>
      )}
    </Card>
  );
}
