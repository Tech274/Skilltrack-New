import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Trash2, Pencil, Eye, EyeOff, Upload, Download } from "lucide-react";
import {
  listResources, upsertResource, setResourceStatus, deleteResource, getSignedDownloadUrl,
} from "@/lib/admin-content.functions";
import { uploadContentFile } from "@/lib/admin-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiFillButton } from "@/components/ai/ai-fill-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/resources")({
  head: () => ({ meta: [{ title: "Study Resources — Admin — SkillTrack-365" }] }),
  component: ResourcesPage,
});

const TYPES = ["pdf","ppt","doc","video","audio","link","youtube","practice_guide","notes","cheat_sheet","lab_guide","case_study","assignment"];

function StatusPill({ status }: { status: string }) {
  const tone = status === "published"
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : "bg-muted text-muted-foreground border-border";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}>{status}</span>;
}

function TierPill({ tier }: { tier: string }) {
  const tone = tier === "paid"
    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
    : "bg-blue-500/10 text-blue-600 border-blue-500/30";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}>{tier}</span>;
}

function ResourcesPage() {
  const list = useServerFn(listResources);
  const upsert = useServerFn(upsertResource);
  const setStatus = useServerFn(setResourceStatus);
  const remove = useServerFn(deleteResource);
  const dlUrl = useServerFn(getSignedDownloadUrl);
  const qc = useQueryClient();

  const [status, setStatusFilter] = useState("all");
  const [tier, setTier] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [openEditor, setOpenEditor] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "resources", status, tier, search],
    queryFn: () => list({ data: { status, tier, search } }),
  });

  const upsertMut = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "resources"] }); setOpenEditor(false); toast.success("Resource saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: any) => setStatus({ data: { id, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "resources"] }); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "resources"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  async function handleDownload(r: any) {
    try {
      if (r.storage_path) {
        const { url } = await dlUrl({ data: { path: r.storage_path, expires_in: 600 } });
        window.open(url, "_blank");
      } else if (r.external_url) {
        window.open(r.external_url, "_blank");
      } else {
        toast.error("No file or link attached");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Study Resources</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upload, organize, and publish study materials.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpenEditor(true); }}><Plus size={16} className="mr-1.5" /> New resource</Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search title, module, topic…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border/60 bg-surface/40">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-4 py-2.5">Title</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Certification</th><th className="px-4 py-2.5">Tier</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No resources yet.</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-4 py-2.5 font-medium">{r.title}<div className="text-xs text-muted-foreground">{r.module || ""} {r.topic ? `• ${r.topic}` : ""}</div></td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.resource_type}</td>
                <td className="px-4 py-2.5">{r.certification_slug || "—"}</td>
                <td className="px-4 py-2.5"><TierPill tier={r.access_tier} /></td>
                <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                <td className="px-4 py-2.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(r.storage_path || r.external_url) && (
                        <DropdownMenuItem onClick={() => handleDownload(r)}><Download size={14} className="mr-2" /> Open / Download</DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => { setEditing(r); setOpenEditor(true); }}><Pencil size={14} className="mr-2" /> Edit</DropdownMenuItem>
                      {r.status === "draft" ? (
                        <DropdownMenuItem onClick={() => statusMut.mutate({ id: r.id, status: "published" })}><Eye size={14} className="mr-2" /> Publish</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => statusMut.mutate({ id: r.id, status: "draft" })}><EyeOff size={14} className="mr-2" /> Unpublish</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this resource?")) delMut.mutate(r.id); }}><Trash2 size={14} className="mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ResourceEditor open={openEditor} onClose={() => setOpenEditor(false)} initial={editing} onSave={(p: any) => upsertMut.mutate(p)} saving={upsertMut.isPending} />
    </div>
  );
}

function emptyResource() {
  return {
    title: "", description: "", certification_slug: "", module: "", topic: "",
    resource_type: "pdf", external_url: "", storage_path: "", file_url: "",
    file_size_bytes: null, file_mime: "", thumbnail_url: "",
    access_tier: "free", required_plan: "", download_allowed: true,
  };
}

function ResourceEditor({ open, onClose, initial, onSave, saving }: any) {
  const [f, setF] = useState<any>(() => initial ?? emptyResource());
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(initial ?? emptyResource());
  }, [open, initial]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadContentFile(file, "resources");
      setF((prev: any) => ({ ...prev, storage_path: res.path, file_mime: res.mime, file_size_bytes: res.size, title: prev.title || res.filename }));
      toast.success("File uploaded");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const onSubmit = () => {
    onSave({
      ...f,
      id: initial?.id,
      file_size_bytes: f.file_size_bytes ? Number(f.file_size_bytes) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{initial ? "Edit resource" : "New resource"}</span>
            <AiFillButton formKey="study_resource" currentValues={f} onApply={(patch) => setF({ ...f, ...patch })} />
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><Label>Type</Label>
            <Select value={f.resource_type} onValueChange={(v) => setF({ ...f, resource_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Certification slug</Label><Input value={f.certification_slug ?? ""} onChange={(e) => setF({ ...f, certification_slug: e.target.value })} placeholder="aws-saa" /></div>
          <div><Label>Module</Label><Input value={f.module ?? ""} onChange={(e) => setF({ ...f, module: e.target.value })} /></div>
          <div><Label>Topic</Label><Input value={f.topic ?? ""} onChange={(e) => setF({ ...f, topic: e.target.value })} /></div>
          <div><Label>Access tier</Label>
            <Select value={f.access_tier} onValueChange={(v) => setF({ ...f, access_tier: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Required plan (optional)</Label><Input value={f.required_plan ?? ""} onChange={(e) => setF({ ...f, required_plan: e.target.value })} placeholder="pro, elite…" /></div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">Allow downloads</div>
            <Switch checked={!!f.download_allowed} onCheckedChange={(v) => setF({ ...f, download_allowed: v })} />
          </div>
          <div className="sm:col-span-2 rounded-md border border-dashed border-border p-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">File (PDF / video / image)</Label>
            <div className="mt-2 flex items-center gap-2">
              <Input type="file" onChange={onFile} disabled={uploading} accept=".pdf,.ppt,.pptx,.doc,.docx,video/*,audio/*,image/*" />
              {uploading && <span className="text-xs text-muted-foreground">Uploading…</span>}
            </div>
            {f.storage_path && (
              <div className="mt-2 text-xs text-muted-foreground truncate">Uploaded: {f.storage_path} ({f.file_mime}, {f.file_size_bytes ? Math.round(f.file_size_bytes / 1024) + " KB" : "—"})</div>
            )}
          </div>
          <div className="sm:col-span-2"><Label>External URL (YouTube / Drive / link)</Label><Input value={f.external_url ?? ""} onChange={(e) => setF({ ...f, external_url: e.target.value })} placeholder="https://…" /></div>
          <div className="sm:col-span-2"><Label>Thumbnail URL</Label><Input value={f.thumbnail_url ?? ""} onChange={(e) => setF({ ...f, thumbnail_url: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving || !f.title || uploading}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
