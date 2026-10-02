import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, GripVertical, Save, ArrowLeft, Sparkles, AlertCircle, FileDown, FileText, History, LayoutPanelLeft, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiFillButton } from "@/components/ai/ai-fill-button";
import {
  listLearningPaths, getLearningPath, saveLearningPath, deleteLearningPath,
} from "@/lib/learning-paths.functions";
import { validatePath, hasBlockingErrors, type Issue } from "@/lib/learning-path-validation";
import { pathToCsv, pathToPdf, downloadBlob, type ExportablePath } from "@/lib/learning-path-export";
import { MilestoneTimeline } from "@/components/learning/milestone-timeline";
import { PathVersionHistory } from "@/components/learning/path-version-history";

export const Route = createFileRoute("/_authenticated/admin/learning-paths")({
  head: () => ({ meta: [{ title: "Learning Paths — Admin" }, { name: "robots", content: "noindex" }] }),
  component: LearningPathsAdmin,
});

type Step = { title: string; topics?: string[]; estimated_hours?: number; resource_hints?: string[] };
type Assessment = { title: string; kind?: string; passing_score?: number };

function LearningPathsAdmin() {
  const listFn = useServerFn(listLearningPaths);
  const list = useQuery({
    queryKey: ["lp-list"],
    queryFn: () => listFn({ data: {} }),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (editingId || creating) {
    return (
      <PathEditor
        id={editingId}
        onClose={() => { setEditingId(null); setCreating(false); }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-primary">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight">Learning paths</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Design structured paths with steps, prerequisites, and assessments. Review before saving.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-1.5">
          <Plus size={14} /> New path
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {(list.data?.rows ?? []).length === 0 && !list.isLoading && (
          <Card className="p-6 text-sm text-muted-foreground">No paths yet. Create one to get started.</Card>
        )}
        {(list.data?.rows ?? []).map((r: any) => (
          <Card key={r.id} className="flex items-center gap-4 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{r.title}</span>
                <Badge variant={r.status === "published" ? "default" : "outline"}>{r.status}</Badge>
                {r.difficulty && <Badge variant="outline">{r.difficulty}</Badge>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {r.target_certification_slug ?? "—"} · {r.estimated_hours ?? "?"}h
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditingId(r.id)}>Edit</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PathEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getLearningPath);
  const saveFn = useServerFn(saveLearningPath);
  const delFn = useServerFn(deleteLearningPath);

  const loaded = useQuery({
    queryKey: ["lp", id],
    queryFn: () => getFn({ data: { id: id! } }),
    enabled: !!id,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetCert, setTargetCert] = useState("");
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced" | "">("");
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [prereqs, setPrereqs] = useState<string[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [versionLabel, setVersionLabel] = useState("");
  const [tab, setTab] = useState<"editor" | "timeline" | "history">("editor");

  useEffect(() => {
    const r = loaded.data?.row as any;
    if (!r) return;
    setTitle(r.title ?? "");
    setDescription(r.description ?? "");
    setTargetCert(r.target_certification_slug ?? "");
    setDifficulty(r.difficulty ?? "");
    setEstimatedHours(r.estimated_hours != null ? String(r.estimated_hours) : "");
    setSteps(Array.isArray(r.steps) ? r.steps : []);
    setPrereqs(Array.isArray(r.prerequisites) ? r.prerequisites : []);
    setAssessments(Array.isArray(r.assessments) ? r.assessments : []);
    setStatus(r.status ?? "draft");
  }, [loaded.data]);

  const draftPayload = {
    title,
    estimated_hours: estimatedHours ? Number(estimatedHours) : null,
    steps,
    prerequisites: prereqs,
    assessments,
    status,
  };
  const issues: Issue[] = useMemo(() => validatePath(draftPayload as any), [title, estimatedHours, steps, prereqs, assessments, status]);
  const blocked = hasBlockingErrors(issues);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: id ?? undefined,
          title,
          description: description || null,
          target_certification_slug: targetCert || null,
          difficulty: (difficulty || null) as any,
          estimated_hours: estimatedHours ? Number(estimatedHours) : null,
          steps,
          prerequisites: prereqs,
          assessments,
          status,
          version_label: versionLabel || null,
        },
      }),
    onSuccess: () => {
      toast.success("Learning path saved");
      qc.invalidateQueries({ queryKey: ["lp-list"] });
      qc.invalidateQueries({ queryKey: ["lp-versions", id ?? ""] });
      setVersionLabel("");
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id: id! } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["lp-list"] }); onClose(); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const applyAi = (patch: Record<string, unknown>) => {
    if (typeof patch.title === "string") setTitle(patch.title);
    if (typeof patch.description === "string") setDescription(patch.description);
    if (typeof patch.target_certification_slug === "string") setTargetCert(patch.target_certification_slug);
    if (typeof patch.difficulty === "string") setDifficulty(patch.difficulty as any);
    if (typeof patch.estimated_hours === "number") setEstimatedHours(String(patch.estimated_hours));
    if (Array.isArray(patch.modules)) {
      const next: Step[] = (patch.modules as any[]).map((m) => ({
        title: String(m.title ?? ""),
        topics: Array.isArray(m.topics) ? m.topics.map(String) : [],
        estimated_hours: typeof m.estimated_hours === "number" ? m.estimated_hours : undefined,
      })).filter((s) => s.title);
      if (next.length) setSteps(next);
    }
  };

  const exportable: ExportablePath = {
    title,
    description,
    target_certification_slug: targetCert,
    difficulty,
    estimated_hours: estimatedHours ? Number(estimatedHours) : null,
    status,
    steps,
    prerequisites: prereqs,
    assessments,
    milestones: assessments.map((a) => ({ title: a.title, success_criteria: a.passing_score ? `≥ ${a.passing_score}% to pass` : undefined })),
  };
  const slug = (title || "learning-path").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onClose} className="gap-1.5">
          <ArrowLeft size={14} /> Back
        </Button>
        <div className="flex items-center gap-2">
          <AiFillButton
            formKey="learning_path"
            currentValues={{ title, description, target_certification_slug: targetCert, difficulty, estimated_hours: estimatedHours ? Number(estimatedHours) : undefined, modules: steps }}
            onApply={applyAi}
            contextHint="Design a learning path for a certification with modules ordered from foundational to advanced."
            label="Fill with AI"
          />
          <Button size="sm" variant="outline" onClick={() => downloadBlob(`${slug}.csv`, "text/csv;charset=utf-8", pathToCsv(exportable))}>
            <FileDown size={14} className="mr-1.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadBlob(`${slug}.pdf`, "application/pdf", pathToPdf(exportable))}>
            <FileText size={14} className="mr-1.5" /> PDF
          </Button>
          {id && (
            <Button variant="outline" size="sm" onClick={() => del.mutate()} disabled={del.isPending}>
              <Trash2 size={14} className="mr-1.5" /> Delete
            </Button>
          )}
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || !title || blocked}>
            <Save size={14} className="mr-1.5" /> {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{id ? "Edit learning path" : "New learning path"}</h1>

      {/* Tabs */}
      <div className="mt-4 flex gap-1 border-b border-border">
        {[
          { id: "editor", label: "Editor", icon: LayoutPanelLeft },
          { id: "timeline", label: "Timeline", icon: Calendar },
          { id: "history", label: "History", icon: History },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === (t.id as any);
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              disabled={t.id === "history" && !id}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${active ? "border-primary font-semibold" : "border-transparent text-muted-foreground"} ${t.id === "history" && !id ? "opacity-40" : ""}`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Validation panel - always visible */}
      {issues.length > 0 && (
        <Card className={`mt-4 p-3 text-sm ${blocked ? "border-destructive/50" : "border-amber-500/40"}`}>
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle size={14} className={blocked ? "text-destructive" : "text-amber-500"} />
            {blocked ? "Fix these before saving" : "Recommendations"}
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {issues.map((i, idx) => (
              <li key={idx} className={i.level === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}>
                <code className="mr-1 font-mono">{i.field}</code> — {i.message}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === "editor" && (
        <div className="mt-4 grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AWS Solutions Architect Foundations" />
            </div>
            <div>
              <Label>Target certification slug</Label>
              <Input value={targetCert} onChange={(e) => setTargetCert(e.target.value)} placeholder="aws-saa-c03" className="font-mono" />
            </div>
            <div>
              <Label>Difficulty</Label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              >
                <option value="">—</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <Label>Estimated hours</Label>
              <Input type="number" value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Prerequisites</h2>
              <Button size="sm" variant="outline" onClick={() => setPrereqs([...prereqs, ""])}>
                <Plus size={12} className="mr-1" /> Add
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {prereqs.length === 0 && <p className="text-xs text-muted-foreground">None set.</p>}
              {prereqs.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={p}
                    onChange={(e) => setPrereqs(prereqs.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="e.g. Comfortable with Linux command line"
                  />
                  <Button size="icon" variant="ghost" onClick={() => setPrereqs(prereqs.filter((_, j) => j !== i))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Steps / modules</h2>
              <Button size="sm" variant="outline" onClick={() => setSteps([...steps, { title: "", topics: [] }])}>
                <Plus size={12} className="mr-1" /> Add step
              </Button>
            </div>
            <div className="mt-3 space-y-3">
              {steps.length === 0 && <p className="text-xs text-muted-foreground">No steps yet. Use Fill with AI or add manually.</p>}
              {steps.map((s, i) => (
                <div key={i} className="rounded-md border border-border/60 p-3">
                  <div className="flex items-start gap-2">
                    <GripVertical size={14} className="mt-2 text-muted-foreground" />
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={s.title}
                          onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                          placeholder={`Step ${i + 1} title`}
                        />
                        <Input
                          type="number"
                          value={s.estimated_hours ?? ""}
                          onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, estimated_hours: e.target.value ? Number(e.target.value) : undefined } : x)))}
                          placeholder="hrs"
                          className="w-24"
                        />
                      </div>
                      <Textarea
                        rows={2}
                        value={(s.topics ?? []).join("\n")}
                        onChange={(e) =>
                          setSteps(steps.map((x, j) => (j === i ? { ...x, topics: e.target.value.split("\n").map((t) => t.trim()).filter(Boolean) } : x)))
                        }
                        placeholder="One topic per line"
                      />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Assessments</h2>
              <Button size="sm" variant="outline" onClick={() => setAssessments([...assessments, { title: "" }])}>
                <Plus size={12} className="mr-1" /> Add
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {assessments.length === 0 && <p className="text-xs text-muted-foreground">No assessments yet.</p>}
              {assessments.map((a, i) => (
                <div key={i} className="grid grid-cols-12 items-center gap-2">
                  <Input
                    className="col-span-6"
                    value={a.title}
                    onChange={(e) => setAssessments(assessments.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    placeholder="Assessment title"
                  />
                  <Input
                    className="col-span-3"
                    value={a.kind ?? ""}
                    onChange={(e) => setAssessments(assessments.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}
                    placeholder="quiz / lab / mock"
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    value={a.passing_score ?? ""}
                    onChange={(e) => setAssessments(assessments.map((x, j) => (j === i ? { ...x, passing_score: e.target.value ? Number(e.target.value) : undefined } : x)))}
                    placeholder="pass %"
                  />
                  <Button size="icon" variant="ghost" className="col-span-1" onClick={() => setAssessments(assessments.filter((_, j) => j !== i))}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Label className="m-0">Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <div className="flex items-center gap-2">
              <Label className="m-0 text-xs">Version label</Label>
              <Input value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="e.g. Added cloud labs" className="h-9 w-64" />
            </div>
            <p className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles size={12} /> Save creates a version snapshot.
            </p>
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <Card className="mt-4 p-4">
          <h2 className="mb-3 text-sm font-semibold">Milestone timeline</h2>
          <MilestoneTimeline
            steps={steps}
            prerequisites={prereqs}
            milestones={assessments.map((a) => ({
              title: a.title || "Assessment",
              success_criteria: a.passing_score ? `Pass at ≥ ${a.passing_score}%` : undefined,
            }))}
          />
        </Card>
      )}

      {tab === "history" && id && (
        <div className="mt-4">
          <PathVersionHistory pathId={id} onRolledBack={() => qc.invalidateQueries({ queryKey: ["lp", id] })} />
        </div>
      )}
    </div>
  );
}
