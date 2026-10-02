import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getLearner, updateLearner } from "@/lib/admin-learners.functions";
import { listAssignableAssets, assignAsset, updateAssignmentStatus, removeAssignment } from "@/lib/admin-assignments.functions";

export const Route = createFileRoute("/_authenticated/admin/learners/$id")({
  head: () => ({ meta: [{ title: "Learner — Admin — SkillTrack-365" }] }),
  component: LearnerDetail,
});

function LearnerDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fnGet = useServerFn(getLearner);
  const fnUpdate = useServerFn(updateLearner);
  const fnAssets = useServerFn(listAssignableAssets);
  const fnAssign = useServerFn(assignAsset);
  const fnUpdateStatus = useServerFn(updateAssignmentStatus);
  const fnRemove = useServerFn(removeAssignment);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "learner", id],
    queryFn: () => fnGet({ data: { id } }),
  });
  const { data: assets } = useQuery({
    queryKey: ["admin", "assignable-assets"],
    queryFn: () => fnAssets(),
  });

  const update = useMutation({
    mutationFn: (v: any) => fnUpdate({ data: { id, ...v } }),
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["admin", "learner", id] }); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });
  const assignMut = useMutation({
    mutationFn: (v: any) => fnAssign({ data: { learner_id: id, ...v } }),
    onSuccess: () => { toast.success("Assigned"); qc.invalidateQueries({ queryKey: ["admin", "learner", id] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const statusMut = useMutation({
    mutationFn: (v: { id: string; status: any }) => fnUpdateStatus({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "learner", id] }),
  });
  const removeMut = useMutation({
    mutationFn: (v: { id: string }) => fnRemove({ data: v }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["admin", "learner", id] }); },
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data?.profile) return <div className="p-8 text-sm text-destructive">Learner not found.</div>;

  const p = data.profile;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link to="/admin/learners" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Back to learners
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{p.display_name || "Unnamed learner"}</h1>
          <p className="text-sm text-muted-foreground">{data.email ?? "no email"}</p>
        </div>
        <Badge variant={data.status === "active" ? "default" : "secondary"}>{data.status}</Badge>
      </div>

      <Tabs defaultValue="profile" className="mt-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="assignments">Assignments ({data.assignments.length})</TabsTrigger>
          <TabsTrigger value="billing">Billing ({data.invoices.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileForm
            initial={{ display_name: p.display_name ?? "", headline: p.headline ?? "", country: p.country ?? "", target_role: p.target_role ?? "", timezone: p.timezone ?? "UTC" }}
            onSave={(v) => update.mutate(v)}
            saving={update.isPending}
          />
        </TabsContent>

        <TabsContent value="assignments" className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active assignments</h2>
            <AssignDialog assets={assets} onAssign={(v) => assignMut.mutateAsync(v).then(() => true)} />
          </div>
          <div className="rounded-lg border border-border/60 bg-surface/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assignments.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No assignments yet.</TableCell></TableRow>
                )}
                {data.assignments.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.asset_label || a.asset_id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline">{a.asset_type.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{a.due_at ? new Date(a.due_at).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Select value={a.status} onValueChange={(v) => statusMut.mutate({ id: a.id, status: v })}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="revoked">Revoked</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => removeMut.mutate({ id: a.id })}>
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <div className="rounded-lg border border-border/60 bg-surface/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No invoices.</TableCell></TableRow>}
                {data.invoices.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(inv.issue_date).toLocaleDateString()}</TableCell>
                    <TableCell>{inv.currency} {Number(inv.total).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline">{inv.status}</Badge></TableCell>
                    <TableCell><Link to="/admin/invoices/$id" params={{ id: inv.id }} className="text-xs text-primary hover:underline">Open</Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileForm({ initial, onSave, saving }: { initial: any; onSave: (v: any) => void; saving: boolean }) {
  const [form, setForm] = useState(initial);
  return (
    <div className="grid max-w-3xl gap-3 rounded-lg border border-border/60 bg-surface/40 p-5">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Display name</Label><Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
        <div><Label>Target role</Label><Input value={form.target_role} onChange={(e) => setForm({ ...form, target_role: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Country</Label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
        <div><Label>Timezone</Label><Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></div>
      </div>
      <div><Label>Headline</Label><Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} /></div>
      <div className="flex justify-end">
        <Button onClick={() => onSave(form)} disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
      </div>
    </div>
  );
}

function AssignDialog({ assets, onAssign }: { assets: any; onAssign: (v: any) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"certification" | "resource" | "mock_exam">("certification");
  const [assetId, setAssetId] = useState<string>("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const list = assets ? (type === "certification" ? assets.certifications : type === "resource" ? assets.resources : assets.mock_exams) : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus size={14} className="mr-1" />Assign</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign content</DialogTitle>
          <DialogDescription>The learner gets immediate access and an in-app notification.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v: any) => { setType(v); setAssetId(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="certification">Certification</SelectItem>
                <SelectItem value="resource">Study resource</SelectItem>
                <SelectItem value="mock_exam">Mock exam</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Item</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger><SelectValue placeholder="Select an item" /></SelectTrigger>
              <SelectContent>
                {list.map((it: any) => (
                  <SelectItem key={it.id} value={it.id}>
                    {it.label}{it.status === "draft" ? " · draft" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Due date (optional)</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={busy || !assetId} onClick={async () => {
            setBusy(true);
            try {
              const ok = await onAssign({ asset_type: type, asset_id: assetId, due_at: due || null, notes: notes || null });
              if (ok) { setOpen(false); setAssetId(""); setDue(""); setNotes(""); }
            } finally { setBusy(false); }
          }}>{busy ? "Assigning…" : "Assign"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
