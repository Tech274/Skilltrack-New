import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Trash2, Pencil, Eye, EyeOff } from "lucide-react";
import {
  listCertifications, upsertCertification, setCertificationStatus, deleteCertification,
} from "@/lib/admin-content.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AiFillButton } from "@/components/ai/ai-fill-button";
import { AdminListPager } from "@/components/admin/admin-list-pager";

export const Route = createFileRoute("/_authenticated/admin/certifications")({
  head: () => ({ meta: [{ title: "Certifications — Admin — SkillTrack-365" }] }),
  component: CertsPage,
});

function StatusPill({ status }: { status: string }) {
  const tone = status === "published"
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : "bg-muted text-muted-foreground border-border";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}>{status}</span>;
}

function CertsPage() {
  const list = useServerFn(listCertifications);
  const upsert = useServerFn(upsertCertification);
  const setStatus = useServerFn(setCertificationStatus);
  const remove = useServerFn(deleteCertification);
  const qc = useQueryClient();

  const [status, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<any | null>(null);
  const [openEditor, setOpenEditor] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "certs", status, search, page],
    queryFn: () => list({ data: { status, search, page, pageSize: 50 } }),
  });
  const rows = data?.rows ?? [];

  const upsertMut = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "certs"] }); setOpenEditor(false); toast.success("Certification saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: any) => setStatus({ data: { id, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "certs"] }); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "certs"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Certifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create, publish, and manage certification programs.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpenEditor(true); }}><Plus size={16} className="mr-1.5" /> New certification</Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search name, code, vendor…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border/60 bg-surface/40">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Vendor</th><th className="px-4 py-2.5">Code</th><th className="px-4 py-2.5">Level</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No certifications yet.</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-4 py-2.5 font-medium">{r.name}<div className="text-xs text-muted-foreground">{r.slug}</div></td>
                <td className="px-4 py-2.5">{r.vendor || "—"}</td>
                <td className="px-4 py-2.5">{r.code || "—"}</td>
                <td className="px-4 py-2.5">{r.level || "—"}</td>
                <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                <td className="px-4 py-2.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditing(r); setOpenEditor(true); }}><Pencil size={14} className="mr-2" /> Edit</DropdownMenuItem>
                      {r.status === "draft" ? (
                        <DropdownMenuItem onClick={() => statusMut.mutate({ id: r.id, status: "published" })}><Eye size={14} className="mr-2" /> Publish</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => statusMut.mutate({ id: r.id, status: "draft" })}><EyeOff size={14} className="mr-2" /> Unpublish</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this certification?")) delMut.mutate(r.id); }}><Trash2 size={14} className="mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AdminListPager page={data?.page ?? page} pageSize={data?.pageSize ?? 50} total={data?.total ?? 0} onPage={setPage} />
      </div>

      <CertEditor open={openEditor} onClose={() => setOpenEditor(false)} initial={editing} onSave={(p: any) => upsertMut.mutate(p)} saving={upsertMut.isPending} />
    </div>
  );
}

function CertEditor({ open, onClose, initial, onSave, saving }: any) {
  const [f, setF] = useState<any>(() => initial ?? {
    slug: "", name: "", code: "", vendor: "", category: "", level: "Intermediate",
    tagline: "", description: "", cost_usd: null, duration_minutes: null,
    passing_score: null, validity_years: null, skills: [], learning_outcomes: [], thumbnail_url: "",
  });

  // re-initialize when dialog opens with different row
  useStateSyncOnOpen(open, initial, setF);

  const onSubmit = () => {
    const payload = {
      ...f,
      id: initial?.id,
      cost_usd: f.cost_usd === "" || f.cost_usd === null ? null : Number(f.cost_usd),
      duration_minutes: f.duration_minutes === "" || f.duration_minutes === null ? null : Number(f.duration_minutes),
      passing_score: f.passing_score === "" || f.passing_score === null ? null : Number(f.passing_score),
      validity_years: f.validity_years === "" || f.validity_years === null ? null : Number(f.validity_years),
      skills: Array.isArray(f.skills) ? f.skills : String(f.skills || "").split(",").map((s: string) => s.trim()).filter(Boolean),
      learning_outcomes: Array.isArray(f.learning_outcomes) ? f.learning_outcomes : String(f.learning_outcomes || "").split("\n").map((s: string) => s.trim()).filter(Boolean),
    };
    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>{initial ? "Edit certification" : "New certification"}</DialogTitle>
            <AiFillButton
              formKey="certification"
              currentValues={f}
              onApply={(patch) => setF({ ...f, ...patch })}
              contextHint="SkillTrack-365 certification catalog entry"
            />
          </div>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Slug</Label><Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="aws-saa" /></div>
          <div><Label>Exam code</Label><Input value={f.code ?? ""} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
          <div><Label>Vendor</Label><Input value={f.vendor ?? ""} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></div>
          <div><Label>Category</Label><Input value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Cloud, Data, Security…" /></div>
          <div><Label>Level</Label>
            <Select value={f.level ?? "Intermediate"} onValueChange={(v) => setF({ ...f, level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Beginner","Intermediate","Advanced","Expert"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Cost (USD)</Label><Input type="number" value={f.cost_usd ?? ""} onChange={(e) => setF({ ...f, cost_usd: e.target.value })} /></div>
          <div><Label>Duration (minutes)</Label><Input type="number" value={f.duration_minutes ?? ""} onChange={(e) => setF({ ...f, duration_minutes: e.target.value })} /></div>
          <div><Label>Passing score (%)</Label><Input type="number" value={f.passing_score ?? ""} onChange={(e) => setF({ ...f, passing_score: e.target.value })} /></div>
          <div><Label>Validity (years)</Label><Input type="number" value={f.validity_years ?? ""} onChange={(e) => setF({ ...f, validity_years: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Thumbnail URL</Label><Input value={f.thumbnail_url ?? ""} onChange={(e) => setF({ ...f, thumbnail_url: e.target.value })} placeholder="https://…" /></div>
          <div className="sm:col-span-2"><Label>Tagline</Label><Input value={f.tagline ?? ""} onChange={(e) => setF({ ...f, tagline: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Skills (comma-separated)</Label><Input value={Array.isArray(f.skills) ? f.skills.join(", ") : f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Learning outcomes (one per line)</Label><Textarea rows={3} value={Array.isArray(f.learning_outcomes) ? f.learning_outcomes.join("\n") : f.learning_outcomes} onChange={(e) => setF({ ...f, learning_outcomes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving || !f.name || !f.slug}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from "react";
function useStateSyncOnOpen(open: boolean, initial: any, setF: (v: any) => void) {
  useEffect(() => {
    if (!open) return;
    setF(initial ?? {
      slug: "", name: "", code: "", vendor: "", category: "", level: "Intermediate",
      tagline: "", description: "", cost_usd: null, duration_minutes: null,
      passing_score: null, validity_years: null, skills: [], learning_outcomes: [], thumbnail_url: "",
    });
  }, [open, initial, setF]);
}
