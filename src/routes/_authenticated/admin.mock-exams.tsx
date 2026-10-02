import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal, Trash2, Pencil, Eye, EyeOff, ListChecks, Sparkles, Loader2 } from "lucide-react";
import {
  listMockExams, upsertMockExam, setMockExamStatus, deleteMockExam,
} from "@/lib/admin-content.functions";
import { generateMockQuestions } from "@/lib/ai-content-gen.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiFillButton } from "@/components/ai/ai-fill-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/admin/mock-exams")({
  head: () => ({ meta: [{ title: "Mock Exams — Admin — SkillTrack-365" }] }),
  component: ExamsPage,
});

function StatusPill({ status }: { status: string }) {
  const tone = status === "published"
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
    : "bg-muted text-muted-foreground border-border";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}>{status}</span>;
}

function ExamsPage() {
  const list = useServerFn(listMockExams);
  const upsert = useServerFn(upsertMockExam);
  const setStatus = useServerFn(setMockExamStatus);
  const remove = useServerFn(deleteMockExam);
  const qc = useQueryClient();

  const [status, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [openEditor, setOpenEditor] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "exams", status, search],
    queryFn: () => list({ data: { status, search } }),
  });

  const upsertMut = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "exams"] }); setOpenEditor(false); toast.success("Mock exam saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: any) => setStatus({ data: { id, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "exams"] }); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "exams"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const [genOpen, setGenOpen] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mock Exams</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create exams, configure rules, and author questions.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGenOpen(true)}><Sparkles size={16} className="mr-1.5 text-primary" /> Generate questions with AI</Button>
          <Button onClick={() => { setEditing(null); setOpenEditor(true); }}><Plus size={16} className="mr-1.5" /> New mock exam</Button>
        </div>
      </div>
      <GenerateQuestionsDialog open={genOpen} onClose={() => setGenOpen(false)} exams={rows} />

      <div className="mt-6 flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search title or certification…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatusFilter}>
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
            <tr><th className="px-4 py-2.5">Title</th><th className="px-4 py-2.5">Certification</th><th className="px-4 py-2.5">Duration</th><th className="px-4 py-2.5">Questions</th><th className="px-4 py-2.5">Pass</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No mock exams yet.</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-4 py-2.5 font-medium">{r.title}<div className="text-xs text-muted-foreground">{r.access_tier === "paid" ? `Paid${r.required_plan ? ` • ${r.required_plan}` : ""}` : "Free"}</div></td>
                <td className="px-4 py-2.5">{r.certification_slug || "—"}</td>
                <td className="px-4 py-2.5">{r.duration_minutes} min</td>
                <td className="px-4 py-2.5">{r.total_questions} ({r.total_marks} marks)</td>
                <td className="px-4 py-2.5">{r.passing_score}%</td>
                <td className="px-4 py-2.5"><StatusPill status={r.status} /></td>
                <td className="px-4 py-2.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild><Link to="/admin/mock-exams/$id" params={{ id: r.id }}><ListChecks size={14} className="mr-2" /> Manage questions</Link></DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditing(r); setOpenEditor(true); }}><Pencil size={14} className="mr-2" /> Edit</DropdownMenuItem>
                      {r.status === "draft" ? (
                        <DropdownMenuItem onClick={() => statusMut.mutate({ id: r.id, status: "published" })}><Eye size={14} className="mr-2" /> Publish</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => statusMut.mutate({ id: r.id, status: "draft" })}><EyeOff size={14} className="mr-2" /> Unpublish</DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this exam and all its questions?")) delMut.mutate(r.id); }}><Trash2 size={14} className="mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ExamEditor open={openEditor} onClose={() => setOpenEditor(false)} initial={editing} onSave={(p: any) => upsertMut.mutate(p)} saving={upsertMut.isPending} />
    </div>
  );
}

function emptyExam() {
  return {
    title: "", description: "", certification_slug: "",
    duration_minutes: 60, passing_score: 70, attempts_allowed: 3,
    randomize_questions: true, negative_marking: false,
    access_tier: "free", required_plan: "",
  };
}

function ExamEditor({ open, onClose, initial, onSave, saving }: any) {
  const [f, setF] = useState<any>(() => initial ?? emptyExam());
  useEffect(() => { if (open) setF(initial ?? emptyExam()); }, [open, initial]);

  const onSubmit = () => onSave({
    ...f, id: initial?.id,
    duration_minutes: Number(f.duration_minutes),
    passing_score: Number(f.passing_score),
    attempts_allowed: Number(f.attempts_allowed),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{initial ? "Edit mock exam" : "New mock exam"}</span>
            <AiFillButton formKey="mock_exam" currentValues={f} onApply={(patch) => setF({ ...f, ...patch })} />
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div><Label>Certification slug</Label><Input value={f.certification_slug ?? ""} onChange={(e) => setF({ ...f, certification_slug: e.target.value })} /></div>
          <div><Label>Duration (minutes)</Label><Input type="number" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: e.target.value })} /></div>
          <div><Label>Passing score (%)</Label><Input type="number" value={f.passing_score} onChange={(e) => setF({ ...f, passing_score: e.target.value })} /></div>
          <div><Label>Attempts allowed</Label><Input type="number" value={f.attempts_allowed} onChange={(e) => setF({ ...f, attempts_allowed: e.target.value })} /></div>
          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">Randomize questions</div>
            <Switch checked={f.randomize_questions} onCheckedChange={(v) => setF({ ...f, randomize_questions: v })} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
            <div className="text-sm">Negative marking</div>
            <Switch checked={f.negative_marking} onCheckedChange={(v) => setF({ ...f, negative_marking: v })} />
          </div>
          <div><Label>Access tier</Label>
            <Select value={f.access_tier} onValueChange={(v) => setF({ ...f, access_tier: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Required plan</Label><Input value={f.required_plan ?? ""} onChange={(e) => setF({ ...f, required_plan: e.target.value })} placeholder="pro, elite…" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving || !f.title}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GenerateQuestionsDialog({ open, onClose, exams }: { open: boolean; onClose: () => void; exams: any[] }) {
  const navigate = useNavigate();
  const fn = useServerFn(generateMockQuestions);
  const [examId, setExamId] = useState<string>("");
  const [certSlug, setCertSlug] = useState<string>("");
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [syllabus, setSyllabus] = useState("");

  useEffect(() => {
    if (open) {
      setExamId(""); setCertSlug(""); setCount(10); setDifficulty("medium"); setSyllabus("");
    }
  }, [open]);

  const mut = useMutation({
    mutationFn: () => fn({
      data: {
        exam_id: examId || undefined,
        certification_slug: certSlug || undefined,
        count, difficulty,
        syllabus: syllabus || undefined,
      },
    }),
    onSuccess: (res) => {
      toast.success(`Generated ${res.row_count} questions. Opening review…`);
      onClose();
      navigate({ to: "/admin/ai-imports/$jobId", params: { jobId: res.job_id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Generation failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles size={16} className="text-primary" /> Generate mock questions</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Target exam (optional)</Label>
              <Select value={examId || "none"} onValueChange={(v) => setExamId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None (stage only) —</SelectItem>
                  {exams.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Certification slug</Label>
              <Input value={certSlug} onChange={(e) => setCertSlug(e.target.value)} placeholder="aws-saa-c03" />
            </div>
            <div>
              <Label>Number of questions</Label>
              <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Syllabus / source material (optional)</Label>
            <Textarea rows={6} value={syllabus} onChange={(e) => setSyllabus(e.target.value)} placeholder="Paste syllabus, learning objectives, or topic outlines…" />
          </div>
          <p className="text-xs text-muted-foreground">Each question is staged for preview-before-apply review. Nothing saves to your exam until you approve and commit.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={mut.isPending || (!examId && !certSlug && !syllabus)} onClick={() => mut.mutate()}>
            {mut.isPending ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Generating…</> : <><Sparkles size={14} className="mr-1.5" /> Generate</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
