import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Trash2, Pencil } from "lucide-react";
import {
  listAccessRules, upsertAccessRule, deleteAccessRule,
} from "@/lib/access-control.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/access")({
  head: () => ({ meta: [{ title: "Access Control — Admin — SkillTrack-365" }] }),
  component: AccessPage,
});

const ASSET_TYPES = ["certification", "resource", "mock_exam"] as const;

type Rule = {
  id: string;
  asset_type: string;
  asset_id: string | null;
  certification_slug: string | null;
  required_plan: string | null;
  required_role: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
};

function ActivePill({ active }: { active: boolean }) {
  const tone = active
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : "bg-muted text-muted-foreground border-border";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}>{active ? "active" : "inactive"}</span>;
}

function AccessPage() {
  const list = useServerFn(listAccessRules);
  const upsert = useServerFn(upsertAccessRule);
  const remove = useServerFn(deleteAccessRule);
  const qc = useQueryClient();

  const [assetType, setAssetType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Rule> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "access-rules", assetType, search],
    queryFn: () => list({ data: { asset_type: assetType, search } }),
  });

  const upsertMut = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "access-rules"] }); setOpen(false); toast.success("Rule saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "access-rules"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function openNew() {
    setEditing({
      asset_type: "resource",
      asset_id: null,
      certification_slug: null,
      required_plan: null,
      required_role: null,
      starts_at: null,
      ends_at: null,
      active: true,
    });
    setOpen(true);
  }
  function openEdit(r: Rule) { setEditing(r); setOpen(true); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Access Control</h1>
          <p className="text-sm text-muted-foreground">Gate certifications, resources, and mock exams by plan, role, or time window.</p>
        </div>
        <Button onClick={openNew}><Plus size={14} className="mr-1" />New rule</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={assetType} onValueChange={setAssetType}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All asset types</SelectItem>
            {ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-72" placeholder="Search slug, plan, role…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left">Asset</th>
              <th className="px-4 py-2.5 text-left">Plan / Role</th>
              <th className="px-4 py-2.5 text-left">Window</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No rules yet</td></tr>}
            {rows.map((r: Rule) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{r.asset_type}</div>
                  <div className="text-xs text-muted-foreground">{r.asset_id ?? r.certification_slug ?? "—"}</div>
                </td>
                <td className="px-4 py-2.5">
                  <div>{r.required_plan ?? <span className="text-muted-foreground">—</span>}</div>
                  <div className="text-xs text-muted-foreground">{r.required_role ?? ""}</div>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {r.starts_at ? new Date(r.starts_at).toLocaleDateString() : "—"} → {r.ends_at ? new Date(r.ends_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2.5"><ActivePill active={r.active} /></td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => delMut.mutate(r.id)}><Trash2 size={14} className="text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit rule" : "New access rule"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Asset type</Label>
                <Select value={editing.asset_type} onValueChange={(v) => setEditing({ ...editing, asset_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Active</Label><div className="pt-2"><Switch checked={!!editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /></div></div>
              <div><Label>Asset ID (UUID, optional)</Label><Input value={editing.asset_id ?? ""} onChange={(e) => setEditing({ ...editing, asset_id: e.target.value || null })} /></div>
              <div><Label>Certification slug (optional)</Label><Input value={editing.certification_slug ?? ""} onChange={(e) => setEditing({ ...editing, certification_slug: e.target.value || null })} placeholder="aws-saa" /></div>
              <div><Label>Required plan</Label><Input value={editing.required_plan ?? ""} onChange={(e) => setEditing({ ...editing, required_plan: e.target.value || null })} placeholder="professional" /></div>
              <div><Label>Required role</Label><Input value={editing.required_role ?? ""} onChange={(e) => setEditing({ ...editing, required_role: e.target.value || null })} placeholder="admin" /></div>
              <div><Label>Starts at</Label><Input type="datetime-local" value={editing.starts_at ? editing.starts_at.slice(0,16) : ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
              <div><Label>Ends at</Label><Input type="datetime-local" value={editing.ends_at ? editing.ends_at.slice(0,16) : ""} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => editing && upsertMut.mutate(editing)} disabled={upsertMut.isPending}>{upsertMut.isPending ? "Saving…" : "Save rule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
