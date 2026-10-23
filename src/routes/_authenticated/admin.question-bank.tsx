import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Trash2, Pencil, Upload } from "lucide-react";
import {
  listQuestions, upsertQuestion, deleteQuestion, importQuestions,
} from "@/lib/question-bank.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { AdminListPager } from "@/components/admin/admin-list-pager";

export const Route = createFileRoute("/_authenticated/admin/question-bank")({
  head: () => ({ meta: [{ title: "Question Bank — Admin — SkillTrack-365" }] }),
  component: QuestionBankPage,
});

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const QTYPES = ["single", "multi", "true_false"] as const;

type Q = {
  id: string;
  org_id: string | null;
  certification_slug: string | null;
  topic: string | null;
  difficulty: string | null;
  question_type: string;
  question_text: string;
  options: string[];
  correct_answers: number[];
  explanation: string | null;
  reference_url: string | null;
  tags: string[];
  active: boolean;
};

// Minimal CSV parser supporting quoted fields and embedded commas/newlines.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}

function QuestionBankPage() {
  const list = useServerFn(listQuestions);
  const upsert = useServerFn(upsertQuestion);
  const remove = useServerFn(deleteQuestion);
  const importFn = useServerFn(importQuestions);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [cert, setCert] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Partial<Q> | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "question-bank", search, difficulty, cert, page],
    queryFn: () => list({ data: { search, difficulty, certification_slug: cert || undefined, page, pageSize: 50 } }),
  });
  const rows = data?.rows ?? [];

  const upsertMut = useMutation({
    mutationFn: (p: any) => upsert({ data: p }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "question-bank"] }); setOpen(false); toast.success("Question saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "question-bank"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const importMut = useMutation({
    mutationFn: (rows: any[]) => importFn({ data: { rows } }),
    onSuccess: (r: any) => { qc.invalidateQueries({ queryKey: ["admin", "question-bank"] }); toast.success(`Imported ${r.inserted} questions`); },
    onError: (e: any) => toast.error(e?.message ?? "Import failed"),
  });

  function openNew() {
    setEditing({
      certification_slug: null, topic: null, difficulty: null, question_type: "single",
      question_text: "", options: ["", "", "", ""], correct_answers: [], explanation: null,
      reference_url: null, tags: [], active: true,
    });
    setOpen(true);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    const grid = parseCsv(text);
    if (grid.length < 2) { toast.error("CSV is empty"); return; }
    const header = grid[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    const iQ = idx("question");
    const iCert = idx("certification_slug");
    const iTopic = idx("topic");
    const iDiff = idx("difficulty");
    const iType = idx("question_type");
    const iExpl = idx("explanation");
    const iCorrect = idx("correct"); // comma-separated indices
    const optionCols = header.map((h, i) => h.startsWith("option") ? i : -1).filter((i) => i >= 0);
    if (iQ < 0 || optionCols.length === 0) { toast.error("CSV needs 'question' and option1..N columns"); return; }
    const rows = grid.slice(1).map((r) => {
      const options = optionCols.map((c) => r[c] ?? "").filter((v) => v.length > 0);
      const correct = iCorrect >= 0 ? (r[iCorrect] ?? "").split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n)) : [];
      return {
        question_text: r[iQ] ?? "",
        certification_slug: iCert >= 0 ? (r[iCert] || null) : null,
        topic: iTopic >= 0 ? (r[iTopic] || null) : null,
        difficulty: iDiff >= 0 && DIFFICULTIES.includes((r[iDiff] || "") as any) ? (r[iDiff] as any) : null,
        question_type: iType >= 0 && QTYPES.includes((r[iType] || "") as any) ? (r[iType] as any) : "single",
        options, correct_answers: correct,
        explanation: iExpl >= 0 ? (r[iExpl] || null) : null,
        tags: [], active: true,
      };
    }).filter((r) => r.question_text && r.options.length >= 2);
    if (rows.length === 0) { toast.error("No valid rows found"); return; }
    importMut.mutate(rows);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Question Bank</h1>
          <p className="text-sm text-muted-foreground">Central pool of questions, taggable by certification, topic, and difficulty.</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.currentTarget.value = ""; }} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importMut.isPending}><Upload size={14} className="mr-1" />Import CSV</Button>
          <Button onClick={openNew}><Plus size={14} className="mr-1" />New question</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-72" placeholder="Search question text…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Input className="w-48" placeholder="certification slug" value={cert} onChange={(e) => { setCert(e.target.value); setPage(1); }} />
        <Select value={difficulty} onValueChange={(value) => { setDifficulty(value); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulties</SelectItem>
            {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left">Question</th>
              <th className="px-4 py-2.5 text-left">Cert / Topic</th>
              <th className="px-4 py-2.5 text-left">Diff</th>
              <th className="px-4 py-2.5 text-left">Type</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No questions yet</td></tr>}
            {(rows as any[]).map((q: Q) => (
              <tr key={q.id} className="border-t">
                <td className="px-4 py-2.5 max-w-md">
                  <div className="line-clamp-2">{q.question_text}</div>
                  <div className="text-xs text-muted-foreground">{(q.options ?? []).length} options</div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-mono text-xs">{q.certification_slug ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{q.topic ?? ""}</div>
                </td>
                <td className="px-4 py-2.5 text-xs">{q.difficulty ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs">{q.question_type}</td>
                <td className="px-4 py-2.5 text-xs">{q.active ? "active" : "inactive"}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(q); setOpen(true); }}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => delMut.mutate(q.id)}><Trash2 size={14} className="text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AdminListPager page={data?.page ?? page} pageSize={data?.pageSize ?? 50} total={data?.total ?? 0} onPage={setPage} />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit question" : "New question"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-4">
              <div>
                <Label>Question text</Label>
                <Textarea rows={3} value={editing.question_text ?? ""} onChange={(e) => setEditing({ ...editing, question_text: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><Label>Certification slug</Label><Input value={editing.certification_slug ?? ""} onChange={(e) => setEditing({ ...editing, certification_slug: e.target.value || null })} /></div>
                <div><Label>Topic</Label><Input value={editing.topic ?? ""} onChange={(e) => setEditing({ ...editing, topic: e.target.value || null })} /></div>
                <div>
                  <Label>Difficulty</Label>
                  <Select value={editing.difficulty ?? "none"} onValueChange={(v) => setEditing({ ...editing, difficulty: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Type</Label>
                  <Select value={editing.question_type ?? "single"} onValueChange={(v) => setEditing({ ...editing, question_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{QTYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Active</Label><div className="pt-2"><Switch checked={!!editing.active} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /></div></div>
              </div>
              <div>
                <Label>Options (one per line)</Label>
                <Textarea rows={4} value={(editing.options ?? []).join("\n")} onChange={(e) => setEditing({ ...editing, options: e.target.value.split("\n") })} />
              </div>
              <div>
                <Label>Correct answer indices (comma-separated, 0-based)</Label>
                <Input value={(editing.correct_answers ?? []).join(",")} onChange={(e) => setEditing({ ...editing, correct_answers: e.target.value.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n)) })} placeholder="0,2" />
              </div>
              <div>
                <Label>Explanation</Label>
                <Textarea rows={2} value={editing.explanation ?? ""} onChange={(e) => setEditing({ ...editing, explanation: e.target.value || null })} />
              </div>
              <div>
                <Label>Reference URL</Label>
                <Input value={editing.reference_url ?? ""} onChange={(e) => setEditing({ ...editing, reference_url: e.target.value || null })} placeholder="https://…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => editing && upsertMut.mutate({
                ...editing,
                options: (editing.options ?? []).filter((o) => o.trim().length > 0),
              })}
              disabled={upsertMut.isPending}
            >{upsertMut.isPending ? "Saving…" : "Save question"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
