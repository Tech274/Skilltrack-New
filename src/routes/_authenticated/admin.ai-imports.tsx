import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Sparkles, Loader2, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listExtractionJobs, createExtractionJob, runExtraction, getAiUploadUrl,
} from "@/lib/ai-extraction.functions";
import { generateMockQuestions } from "@/lib/ai-content-gen.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/ai-imports")({
  head: () => ({ meta: [{ title: "AI Imports — Admin — SkillTrack-365" }] }),
  component: AiImportsPage,
});

const TARGETS: Array<{ value: string; label: string }> = [
  { value: "certifications", label: "Certifications" },
  { value: "study_resources", label: "Study Resources" },
  { value: "mock_questions", label: "Mock Exam Questions" },
];

function statusTone(s: string) {
  if (s === "ready") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30";
  if (s === "running" || s === "queued") return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  if (s === "failed") return "bg-destructive/10 text-destructive border-destructive/30";
  if (s === "committed") return "bg-primary/10 text-primary border-primary/30";
  return "bg-muted text-muted-foreground border-border";
}

function AiImportsPage() {
  const listFn = useServerFn(listExtractionJobs);
  const createFn = useServerFn(createExtractionJob);
  const runFn = useServerFn(runExtraction);
  const uploadUrlFn = useServerFn(getAiUploadUrl);
  const genFn = useServerFn(generateMockQuestions);
  const qc = useQueryClient();

  const [target, setTarget] = useState("study_resources");
  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mock-question generator
  const [genCertSlug, setGenCertSlug] = useState("");
  const [genExamId, setGenExamId] = useState("");
  const [genCount, setGenCount] = useState(10);
  const [genSyllabus, setGenSyllabus] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-imports", "jobs"],
    queryFn: () => listFn(),
    refetchInterval: 5000,
  });
  const jobs = data?.jobs ?? [];

  const uploadMut = useMutation({
    mutationFn: async () => {
      let file_path: string | undefined;
      let file_name: string | undefined;
      let file_mime: string | undefined;
      if (file) {
        const u = await uploadUrlFn({ data: { filename: file.name, size_bytes: file.size, mime: file.type || undefined } });
        const { error } = await supabase.storage
          .from("ai-uploads")
          .uploadToSignedUrl(u.path, u.token, file);
        if (error) throw new Error(error.message);
        file_path = u.path;
        file_name = file.name;
        file_mime = file.type || undefined;
      }
      const { job } = await createFn({
        data: { target_entity: target, source: "upload", file_path, file_name, file_mime, prompt: prompt || undefined },
      });
      await runFn({ data: { job_id: job.id } });
      return job;
    },
    onSuccess: () => {
      toast.success("Extraction started");
      setFile(null); setPrompt("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["ai-imports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const genMut = useMutation({
    mutationFn: () => genFn({ data: {
      certification_slug: genCertSlug || undefined,
      exam_id: genExamId || undefined,
      count: genCount,
      difficulty: "medium" as const,
      syllabus: genSyllabus || undefined,
    } }),
    onSuccess: (res) => {
      toast.success(`Generated ${res.row_count} questions`);
      setGenSyllabus("");
      qc.invalidateQueries({ queryKey: ["ai-imports"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Sparkles size={20} className="text-primary" /> AI Imports
          </h1>
          <p className="text-sm text-muted-foreground">Upload PDF / DOCX / XLSX / CSV or generate content with AI. Review and approve before saving.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCcw size={14} className="mr-1.5" /> Refresh</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <FileUp size={14} /> Extract from file or prompt
          </h2>
          <div className="grid gap-3">
            <div>
              <Label>Target entity</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGETS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>File (PDF, DOCX, XLSX, CSV) — max 20MB</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.xls,.csv,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 20 * 1024 * 1024) {
                    toast.error(`"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)}MB — files must be under 20MB.`);
                    if (fileRef.current) fileRef.current.value = "";
                    setFile(null);
                    return;
                  }
                  setFile(f);
                }}
              />
              {file && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {file.name} · {(file.size / 1024 / 1024).toFixed(2)}MB
                </p>
              )}
            </div>
            <div>
              <Label>Extra prompt (optional)</Label>
              <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Only include questions from the Security module." />
            </div>
            <Button disabled={uploadMut.isPending || (!file && !prompt)} onClick={() => uploadMut.mutate()}>
              {uploadMut.isPending ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Extracting…</> : <><Sparkles size={14} className="mr-1.5" /> Start extraction</>}
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles size={14} /> Generate mock questions
          </h2>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Certification slug</Label><Input value={genCertSlug} onChange={(e) => setGenCertSlug(e.target.value)} placeholder="aws-saa" /></div>
              <div><Label>Count</Label><Input type="number" min={1} max={50} value={genCount} onChange={(e) => setGenCount(Number(e.target.value) || 10)} /></div>
            </div>
            <div><Label>Exam ID (optional — required to commit)</Label><Input value={genExamId} onChange={(e) => setGenExamId(e.target.value)} placeholder="uuid…" /></div>
            <div><Label>Syllabus / topics text (optional)</Label><Textarea rows={4} value={genSyllabus} onChange={(e) => setGenSyllabus(e.target.value)} placeholder="Paste syllabus, topics, or learning objectives…" /></div>
            <Button disabled={genMut.isPending} onClick={() => genMut.mutate()}>
              {genMut.isPending ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Generating…</> : <><Sparkles size={14} className="mr-1.5" /> Generate</>}
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent jobs</h2>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-surface/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Created</th>
                <th className="p-3 text-left">Target</th>
                <th className="p-3 text-left">Source</th>
                <th className="p-3 text-left">File</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Rows</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No jobs yet.</td></tr>
              ) : jobs.map((j: any) => (
                <tr key={j.id} className="border-t border-border/60">
                  <td className="p-3 text-xs text-muted-foreground">{new Date(j.created_at).toLocaleString()}</td>
                  <td className="p-3">{j.target_entity}</td>
                  <td className="p-3 text-xs">{j.source}</td>
                  <td className="p-3 max-w-[200px] truncate text-xs text-muted-foreground">{j.file_name ?? "—"}</td>
                  <td className="p-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${statusTone(j.status)}`}>{j.status}</span>
                  </td>
                  <td className="p-3 text-xs">{j.summary?.row_count ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Link to="/admin/ai-imports/$jobId" params={{ jobId: j.id }} className="text-primary hover:underline text-xs">Review →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
