import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Upload, UserPlus, MoreHorizontal, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listLearners, createLearner, importLearnersCsv, setLearnerStatus } from "@/lib/admin-learners.functions";

export const Route = createFileRoute("/_authenticated/admin/learners")({
  head: () => ({ meta: [{ title: "Learners — Admin — SkillTrack-365" }] }),
  component: LearnersPage,
});

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Tiny CSV parser supporting quoted fields + commas
  const lines: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (field !== "" || cur.length > 0) { cur.push(field); lines.push(cur); cur = []; field = ""; }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else field += c;
    }
  }
  if (field !== "" || cur.length > 0) { cur.push(field); lines.push(cur); }
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).filter((r) => r.some((c) => c.trim() !== "")).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
  return { headers, rows };
}

function LearnersPage() {
  const qc = useQueryClient();
  const fnList = useServerFn(listLearners);
  const fnCreate = useServerFn(createLearner);
  const fnImport = useServerFn(importLearnersCsv);
  const fnSetStatus = useServerFn(setLearnerStatus);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "disabled">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "learners", search, status],
    queryFn: () => fnList({ data: { search: search || undefined, status } }),
  });

  const setStatusMut = useMutation({
    mutationFn: (v: { id: string; status: "active" | "disabled" }) => fnSetStatus({ data: v }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "learners"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Learners</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage every learner on SkillTrack-365.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportCsvDialog onSubmit={async (rows) => {
            const res = await fnImport({ data: { rows, send_invite: true } });
            qc.invalidateQueries({ queryKey: ["admin", "learners"] });
            toast.success(`Imported ${res.created} learners`, { description: res.errors > 0 ? `${res.errors} rows failed` : undefined });
            return res;
          }} />
          <CreateLearnerDialog onCreate={async (v) => {
            await fnCreate({ data: v });
            qc.invalidateQueries({ queryKey: ["admin", "learners"] });
            toast.success("Learner created");
          }} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, target role…" className="pl-8" />
        </div>
        <Tabs value={status} onValueChange={(v: any) => setStatus(v)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="disabled">Disabled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto text-xs text-muted-foreground">{data?.length ?? 0} learners</div>
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-surface/40">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Target role</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>
            )}
            {!isLoading && (data?.length ?? 0) === 0 && (
              <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">No learners yet. Add one or import a CSV.</TableCell></TableRow>
            )}
            {(data ?? []).map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">
                  <Link to="/admin/learners/$id" params={{ id: l.id }} className="hover:underline">{l.display_name || "—"}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{l.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{l.target_role ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{l.country ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={l.status === "active" ? "default" : "secondary"}>{l.status}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatusMut.mutate({ id: l.id, status: l.status === "active" ? "disabled" : "active" })}
                    disabled={setStatusMut.isPending}
                  >
                    {l.status === "active" ? "Disable" : "Enable"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CreateLearnerDialog({ onCreate }: { onCreate: (v: any) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", display_name: "", headline: "", country: "", target_role: "", timezone: "UTC", send_invite: true });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><UserPlus size={14} className="mr-2" />New learner</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create learner</DialogTitle>
          <DialogDescription>An account will be created; an invite email is sent when enabled.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email *</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" />
            </div>
            <div>
              <Label>Full name *</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target role</Label>
              <Input value={form.target_role} onChange={(e) => setForm({ ...form, target_role: e.target.value })} />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Headline</Label>
            <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={busy || !form.email || !form.display_name}
            onClick={async () => {
              setBusy(true);
              try {
                await onCreate(form);
                setOpen(false);
                setForm({ email: "", display_name: "", headline: "", country: "", target_role: "", timezone: "UTC", send_invite: true });
              } catch (e: any) {
                toast.error(e?.message ?? "Failed");
              } finally { setBusy(false); }
            }}
          >{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportCsvDialog({ onSubmit }: { onSubmit: (rows: any[]) => Promise<{ total: number; created: number; errors: number; results: any[] }> }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ total: number; created: number; errors: number; results: any[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    const text = await f.text();
    const { headers, rows: parsed } = parseCsv(text);
    if (!headers.includes("email")) {
      toast.error("CSV must include an 'email' column");
      return;
    }
    setRows(parsed);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRows([]); setResult(null); } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload size={14} className="mr-2" />Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import learners from CSV</DialogTitle>
          <DialogDescription>
            Required column: <code className="rounded bg-surface px-1">email</code>.
            Optional: display_name, headline, country, target_role, timezone. Duplicate emails fail.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <div className="space-y-4">
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border bg-surface/40 p-8 text-center"
              onClick={() => inputRef.current?.click()}
            >
              <FileSpreadsheet size={28} className="text-muted-foreground" />
              <p className="mt-2 text-sm">Click to select a .csv file</p>
              {rows.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{rows.length} rows ready to import</p>}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
            {rows.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-md border border-border/60 text-xs">
                <table className="w-full">
                  <thead className="bg-surface"><tr><th className="px-2 py-1 text-left">email</th><th className="px-2 py-1 text-left">name</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 10).map((r, i) => <tr key={i}><td className="px-2 py-1">{r.email}</td><td className="px-2 py-1 text-muted-foreground">{r.display_name}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border border-border/60 p-3"><div className="text-2xl font-semibold">{result.total}</div><div className="text-xs text-muted-foreground">Processed</div></div>
              <div className="rounded-md border border-border/60 p-3"><div className="text-2xl font-semibold text-emerald-500">{result.created}</div><div className="text-xs text-muted-foreground">Created</div></div>
              <div className="rounded-md border border-border/60 p-3"><div className="text-2xl font-semibold text-destructive">{result.errors}</div><div className="text-xs text-muted-foreground">Errors</div></div>
            </div>
            {result.errors > 0 && (
              <div className="max-h-48 overflow-auto rounded-md border border-border/60 text-xs">
                <table className="w-full">
                  <thead className="bg-surface"><tr><th className="px-2 py-1 text-left">Row</th><th className="px-2 py-1 text-left">Email</th><th className="px-2 py-1 text-left">Error</th></tr></thead>
                  <tbody>
                    {result.results.filter((r) => r.status === "error").map((r, i) => (
                      <tr key={i}><td className="px-2 py-1">{r.row}</td><td className="px-2 py-1">{r.email || "—"}</td><td className="px-2 py-1 text-destructive">{r.message}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{result ? "Close" : "Cancel"}</Button>
          {!result && (
            <Button disabled={busy || rows.length === 0} onClick={async () => {
              setBusy(true);
              try { const res = await onSubmit(rows); setResult(res); }
              catch (e: any) { toast.error(e?.message ?? "Import failed"); }
              finally { setBusy(false); }
            }}>{busy ? "Importing…" : `Import ${rows.length} rows`}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
