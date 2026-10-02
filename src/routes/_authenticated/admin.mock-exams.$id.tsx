import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { getMockExam, upsertQuestion, deleteQuestion, setMockExamStatus } from "@/lib/admin-content.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/mock-exams/$id")({
  head: () => ({ meta: [{ title: "Mock Exam — Admin — SkillTrack-365" }] }),
  component: ExamDetailPage,
});

function ExamDetailPage() {
  const { id } = Route.useParams();
  const fetcher = useServerFn(getMockExam);
  const upsert = useServerFn(upsertQuestion);
  const del = useServerFn(deleteQuestion);
  const setStatus = useServerFn(setMockExamStatus);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "exam", id],
    queryFn: () => fetcher({ data: { id } }),
  });

  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const upsertMut = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "exam", id] }); setOpen(false); toast.success("Question saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (qid: string) => del({ data: { id: qid, exam_id: id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "exam", id] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const statusMut = useMutation({
    mutationFn: (status: "draft" | "published") => setStatus({ data: { id, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "exam", id] }); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-sm text-muted-foreground">Not found.</div>;
  const { exam, questions } = data;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link to="/admin/mock-exams" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Back to mock exams</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{exam.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {exam.certification_slug || "no certification"} • {exam.duration_minutes} min • passing {exam.passing_score}% • {questions.length} questions ({exam.total_marks} marks)
          </p>
        </div>
        <div className="flex gap-2">
          {exam.status === "draft" ? (
            <Button onClick={() => statusMut.mutate("published")}>Publish</Button>
          ) : (
            <Button variant="outline" onClick={() => statusMut.mutate("draft")}>Unpublish</Button>
          )}
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus size={16} className="mr-1.5" /> Add question</Button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {questions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface/40 p-8 text-center text-sm text-muted-foreground">
            No questions yet. Add the first one to enable publishing.
          </div>
        ) : questions.map((q: any, idx: number) => (
          <div key={q.id} className="rounded-lg border border-border/60 bg-surface/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Q{idx + 1} • {q.question_type} • {q.marks} marks{Number(q.negative_marks) > 0 ? ` • -${q.negative_marks}` : ""}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm font-medium">{q.question_text}</div>
                {Array.isArray(q.options) && q.options.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {q.options.map((o: any) => (
                      <li key={o.key} className={`flex gap-2 ${(q.correct_answers || []).includes(o.key) ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
                        <span className="w-5 text-xs uppercase">{o.key}.</span><span>{o.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {q.explanation && <div className="mt-2 text-xs text-muted-foreground"><span className="font-medium">Explanation:</span> {q.explanation}</div>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(q); setOpen(true); }}><Pencil size={14} /></Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Delete this question?")) delMut.mutate(q.id); }}><Trash2 size={14} /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <QuestionEditor open={open} onClose={() => setOpen(false)} initial={editing} examId={id} nextOrder={questions.length} onSave={(p: any) => upsertMut.mutate(p)} saving={upsertMut.isPending} />
    </div>
  );
}

function emptyQ(examId: string, order: number) {
  return {
    exam_id: examId,
    question_text: "",
    question_type: "single" as const,
    options: [{ key: "A", text: "" }, { key: "B", text: "" }, { key: "C", text: "" }, { key: "D", text: "" }],
    correct_answers: [] as string[],
    marks: 1,
    negative_marks: 0,
    explanation: "",
    order_index: order,
  };
}

function QuestionEditor({ open, onClose, initial, examId, nextOrder, onSave, saving }: any) {
  const [f, setF] = useState<any>(() => initial ?? emptyQ(examId, nextOrder));
  useEffect(() => { if (open) setF(initial ?? emptyQ(examId, nextOrder)); }, [open, initial, examId, nextOrder]);

  const isTF = f.question_type === "true_false";

  useEffect(() => {
    if (isTF) {
      setF((p: any) => ({ ...p, options: [{ key: "T", text: "True" }, { key: "F", text: "False" }] }));
    }
  }, [isTF]);

  function toggleCorrect(key: string) {
    setF((p: any) => {
      const has = p.correct_answers.includes(key);
      if (p.question_type === "multi") {
        return { ...p, correct_answers: has ? p.correct_answers.filter((k: string) => k !== key) : [...p.correct_answers, key] };
      }
      return { ...p, correct_answers: [key] };
    });
  }

  function updateOption(i: number, text: string) {
    setF((p: any) => {
      const opts = [...p.options]; opts[i] = { ...opts[i], text }; return { ...p, options: opts };
    });
  }

  function addOption() {
    setF((p: any) => {
      const nextKey = String.fromCharCode(65 + p.options.length);
      return { ...p, options: [...p.options, { key: nextKey, text: "" }] };
    });
  }

  function removeOption(key: string) {
    setF((p: any) => ({
      ...p,
      options: p.options.filter((o: any) => o.key !== key),
      correct_answers: p.correct_answers.filter((k: string) => k !== key),
    }));
  }

  const onSubmit = () => {
    if (!f.question_text.trim()) return toast.error("Question text required");
    if (!isTF && f.options.some((o: any) => !o.text.trim())) return toast.error("All option texts required");
    if (f.correct_answers.length === 0) return toast.error("Mark at least one correct answer");
    onSave({ ...f, id: initial?.id, marks: Number(f.marks), negative_marks: Number(f.negative_marks), order_index: Number(f.order_index) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Edit question" : "Add question"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label>Type</Label>
              <Select value={f.question_type} onValueChange={(v) => setF({ ...f, question_type: v, correct_answers: [] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single choice</SelectItem>
                  <SelectItem value="multi">Multi choice</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                  <SelectItem value="scenario">Scenario</SelectItem>
                  <SelectItem value="case_study">Case study</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Marks</Label><Input type="number" value={f.marks} onChange={(e) => setF({ ...f, marks: e.target.value })} /></div>
            <div><Label>Negative marks</Label><Input type="number" value={f.negative_marks} onChange={(e) => setF({ ...f, negative_marks: e.target.value })} /></div>
          </div>
          <div><Label>Question</Label><Textarea rows={3} value={f.question_text} onChange={(e) => setF({ ...f, question_text: e.target.value })} /></div>

          <div>
            <Label>Options {f.question_type === "multi" && <span className="text-xs text-muted-foreground">(toggle multiple correct)</span>}</Label>
            <div className="mt-2 space-y-2">
              {f.options.map((o: any, i: number) => (
                <div key={o.key} className="flex items-center gap-2">
                  <Switch checked={f.correct_answers.includes(o.key)} onCheckedChange={() => toggleCorrect(o.key)} />
                  <div className="w-6 text-xs uppercase text-muted-foreground">{o.key}.</div>
                  <Input className="flex-1" value={o.text} onChange={(e) => updateOption(i, e.target.value)} disabled={isTF} />
                  {!isTF && f.options.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => removeOption(o.key)}><Trash2 size={14} /></Button>
                  )}
                </div>
              ))}
              {!isTF && (
                <Button variant="outline" size="sm" onClick={addOption}><Plus size={14} className="mr-1" /> Add option</Button>
              )}
            </div>
          </div>

          <div><Label>Explanation (shown after answer)</Label><Textarea rows={2} value={f.explanation ?? ""} onChange={(e) => setF({ ...f, explanation: e.target.value })} /></div>
          <div><Label>Order</Label><Input type="number" value={f.order_index} onChange={(e) => setF({ ...f, order_index: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving}>{saving ? "Saving…" : "Save question"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
