import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, Brain, ScrollText, FileStack, Plus, CheckCircle2, GitCompare, Settings as SettingsIcon } from "lucide-react";
import { listExtractionJobs, cancelExtractionJob, rerunExtractionJob, purgeExtractionJob } from "@/lib/ai-extraction.functions";
import { listAiAudit, listPromptVersions } from "@/lib/super-ai.functions";
import { createPromptVersion, activatePromptVersion, getPromptDiff } from "@/lib/super-ai-prompts.functions";
import { getAiDefaults, setAiDefaults } from "@/lib/admin-ai-defaults.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/super-ai")({
  head: () => ({ meta: [{ title: "Super Admin AI — SkillTrack-365" }] }),
  component: SuperAi,
});

const TABS = [
  { id: "audit", label: "Audit history", icon: ScrollText },
  { id: "jobs", label: "Extraction jobs", icon: FileStack },
  { id: "prompts", label: "Prompts & schemas", icon: Brain },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;
type TabId = (typeof TABS)[number]["id"];

function SuperAi() {
  const [tab, setTab] = useState<TabId>("audit");
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldAlert size={20} className="text-primary" /> Super Admin AI Controls
        </h1>
        <p className="text-sm text-muted-foreground">Manage AI prompts, schema versions, jobs, and audit history across the platform.</p>
      </div>

      <div className="flex gap-1 border-b border-border/60">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "audit" && <AuditTab />}
      {tab === "jobs" && <JobsTab />}
      {tab === "prompts" && <PromptsTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

function SettingsTab() {
  const getFn = useServerFn(getAiDefaults);
  const setFn = useServerFn(setAiDefaults);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["super-ai", "defaults"], queryFn: () => getFn() });
  const [model, setModel] = useState("");
  const [maxTokens, setMaxTokens] = useState(4096);
  const [timeoutMs, setTimeoutMs] = useState(60_000);
  useEffect(() => {
    if (data?.default_model && model === "") {
      setModel(data.default_model);
      setMaxTokens(data.max_output_tokens);
      setTimeoutMs(data.llm_timeout_ms);
    }
  }, [data, model]);
  const mut = useMutation({
    mutationFn: () => setFn({ data: { default_model: model, max_output_tokens: maxTokens, llm_timeout_ms: timeoutMs } }),
    onSuccess: () => { toast.success("AI defaults saved"); qc.invalidateQueries({ queryKey: ["super-ai", "defaults"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <div className="max-w-xl space-y-4 rounded-lg border border-border/60 p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Global AI defaults</h2>
        <p className="mt-1 text-xs text-muted-foreground">Applied to every extraction, generator, and autofill call unless a per-prompt override exists.</p>
      </div>
      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="space-y-3">
          <div>
            <Label>Default model</Label>
            <Input list="ai-models" value={model} onChange={(e) => setModel(e.target.value)} placeholder="google/gemini-3-flash-preview" />
            <datalist id="ai-models">
              <option value="google/gemini-3-flash-preview" />
              <option value="google/gemini-3-pro-preview" />
              <option value="openai/gpt-5" />
              <option value="anthropic/claude-sonnet-4-5" />
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Max output tokens</Label>
              <Input type="number" min={64} max={32000} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value) || 4096)} />
            </div>
            <div>
              <Label>LLM timeout (ms)</Label>
              <Input type="number" min={10000} max={120000} step={5000} value={timeoutMs} onChange={(e) => setTimeoutMs(Number(e.target.value) || 60000)} />
            </div>
          </div>
          <Button disabled={mut.isPending || !model.trim()} onClick={() => mut.mutate()}>
            {mut.isPending ? "Saving…" : "Save defaults"}
          </Button>
        </div>
      )}
    </div>
  );
}

function AuditTab() {
  const fn = useServerFn(listAiAudit);
  const { data, isLoading } = useQuery({ queryKey: ["super-ai", "audit"], queryFn: () => fn() });
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-surface/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="p-3 text-left">When</th>
            <th className="p-3 text-left">Area</th>
            <th className="p-3 text-left">Action</th>
            <th className="p-3 text-left">Target</th>
            <th className="p-3 text-left">Model</th>
            <th className="p-3 text-left">Prompt v</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
          : (data?.rows ?? []).length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No audit entries yet.</td></tr>
          : (data!.rows).map((r: any) => (
            <tr key={r.id} className="border-t border-border/60">
              <td className="p-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
              <td className="p-3 text-xs">{r.area}</td>
              <td className="p-3 text-xs">{r.action}</td>
              <td className="p-3 max-w-[280px] truncate text-xs">{r.target_table}{r.target_id ? ` · ${r.target_id}` : ""}</td>
              <td className="p-3 text-xs text-muted-foreground">{r.model ?? "—"}</td>
              <td className="p-3 text-xs font-mono">{r.prompt_version_id ? r.prompt_version_id.slice(0, 8) : "default"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobsTab() {
  const fn = useServerFn(listExtractionJobs);
  const cancelFn = useServerFn(cancelExtractionJob);
  const rerunFn = useServerFn(rerunExtractionJob);
  const purgeFn = useServerFn(purgeExtractionJob);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["super-ai", "jobs"],
    queryFn: () => fn(),
    refetchInterval: (q) => {
      const jobs = (q.state.data as any)?.jobs ?? [];
      return jobs.some((j: any) => j.status === "queued" || j.status === "running") ? 3000 : false;
    },
  });
  const act = (p: Promise<any>, label: string) => {
    p.then(() => { toast.success(label); qc.invalidateQueries({ queryKey: ["super-ai", "jobs"] }); })
     .catch((e: any) => toast.error(e?.message ?? "Failed"));
  };
  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <table className="w-full text-sm">
        <thead className="bg-surface/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="p-3 text-left">Created</th>
            <th className="p-3 text-left">Target</th>
            <th className="p-3 text-left">Source</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Rows</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
          : (data?.jobs ?? []).map((j: any) => {
            const active = j.status === "queued" || j.status === "running";
            return (
              <tr key={j.id} className="border-t border-border/60">
                <td className="p-3 text-xs">{new Date(j.created_at).toLocaleString()}</td>
                <td className="p-3 text-xs">{j.target_entity}</td>
                <td className="p-3 text-xs">{j.source}</td>
                <td className="p-3 text-xs">{j.status}{j.summary?.parse?.truncated ? " · truncated" : ""}</td>
                <td className="p-3 text-xs">{j.summary?.row_count ?? "—"}</td>
                <td className="p-3 text-right text-xs space-x-2">
                  <Link to="/admin/ai-imports/$jobId" params={{ jobId: j.id }} className="text-primary hover:underline">Open</Link>
                  {active && <button className="text-amber-600 hover:underline" onClick={() => act(cancelFn({ data: { job_id: j.id } }), "Cancelled")}>Cancel</button>}
                  {!active && j.status !== "committed" && <button className="text-muted-foreground hover:underline" onClick={() => act(rerunFn({ data: { job_id: j.id } }), "Rerun queued")}>Rerun</button>}
                  <button className="text-destructive hover:underline" onClick={() => { if (confirm("Purge job and uploaded file?")) act(purgeFn({ data: { job_id: j.id } }), "Purged"); }}>Purge</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PromptsTab() {
  const fn = useServerFn(listPromptVersions);
  const activateFn = useServerFn(activatePromptVersion);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["super-ai", "prompts"], queryFn: () => fn() });
  const [editor, setEditor] = useState<{ form_key: string; clone?: any } | null>(null);
  const [diff, setDiff] = useState<{ a_id: string; b_id: string } | null>(null);
  const [picked, setPicked] = useState<Record<string, string | null>>({}); // form_key -> id chosen for diff

  const activateMut = useMutation({
    mutationFn: (id: string) => activateFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["super-ai", "prompts"] }); toast.success("Activated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const r of data?.rows ?? []) (g[r.form_key] ||= []).push(r);
    return g;
  }, [data]);

  const formKeys = Object.keys(grouped).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Versioned overrides for AI prompts & models. The active version is used live; others remain available for rollback.</p>
        <NewVersionPicker onCreate={(form_key) => setEditor({ form_key })} />
      </div>

      {isLoading && <div className="rounded-md border border-border/60 p-6 text-center text-muted-foreground">Loading…</div>}

      {formKeys.length === 0 && !isLoading && (
        <div className="rounded-md border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No overrides yet — defaults from the in-code registry are active. Click "New version" to publish an override.
        </div>
      )}

      {formKeys.map((fk) => {
        const versions = grouped[fk];
        return (
          <div key={fk} className="rounded-lg border border-border/60">
            <div className="flex items-center justify-between border-b border-border/60 bg-surface/40 p-3">
              <div className="font-mono text-sm">{fk}</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!picked[fk]}
                  onClick={() => {
                    const active = versions.find((v) => v.is_active);
                    if (active && picked[fk]) setDiff({ a_id: active.id, b_id: picked[fk]! });
                  }}
                >
                  <GitCompare size={12} className="mr-1.5" /> Diff vs active
                </Button>
                <Button size="sm" onClick={() => {
                  const active = versions.find((v) => v.is_active) ?? versions[0];
                  setEditor({ form_key: fk, clone: active });
                }}>
                  <Plus size={12} className="mr-1.5" /> New version
                </Button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Pick</th>
                  <th className="p-3 text-left">Version</th>
                  <th className="p-3 text-left">Active</th>
                  <th className="p-3 text-left">Model</th>
                  <th className="p-3 text-left">Notes</th>
                  <th className="p-3 text-left">Updated</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v: any) => (
                  <tr key={v.id} className="border-t border-border/60">
                    <td className="p-3"><input type="radio" name={`pick-${fk}`} checked={picked[fk] === v.id} onChange={() => setPicked((p) => ({ ...p, [fk]: v.id }))} /></td>
                    <td className="p-3 text-xs">v{v.version}</td>
                    <td className="p-3 text-xs">{v.is_active ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600"><CheckCircle2 size={10} /> active</span> : ""}</td>
                    <td className="p-3 text-xs">{v.model ?? "default"}</td>
                    <td className="p-3 max-w-[300px] truncate text-xs text-muted-foreground">{v.notes ?? "—"}</td>
                    <td className="p-3 text-xs">{new Date(v.updated_at).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      {!v.is_active && (
                        <Button size="sm" variant="outline" onClick={() => activateMut.mutate(v.id)} disabled={activateMut.isPending}>
                          Rollback / activate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {editor && <VersionEditor form_key={editor.form_key} clone={editor.clone} onClose={() => setEditor(null)} onSaved={() => { qc.invalidateQueries({ queryKey: ["super-ai", "prompts"] }); setEditor(null); }} />}
      {diff && <DiffDialog a_id={diff.a_id} b_id={diff.b_id} onClose={() => setDiff(null)} />}
    </div>
  );
}

const KNOWN_KEYS = [
  "certification", "study_resource", "mock_question", "mock_exam", "milestone", "organization", "invoice_email_template",
  "certifications", "study_resources", "mock_questions",
];

function NewVersionPicker({ onCreate }: { onCreate: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState("");
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus size={12} className="mr-1.5" /> New override</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Pick a form key</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>form_key</Label>
            <Input list="known-keys" value={k} onChange={(e) => setK(e.target.value)} placeholder="e.g. certification" />
            <datalist id="known-keys">{KNOWN_KEYS.map((x) => <option key={x} value={x} />)}</datalist>
            <p className="text-xs text-muted-foreground">Use the autofill form keys (e.g. <code>certification</code>) or extraction entity keys (e.g. <code>mock_questions</code>).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!k.trim()} onClick={() => { onCreate(k.trim()); setOpen(false); }}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VersionEditor({ form_key, clone, onClose, onSaved }: { form_key: string; clone?: any; onClose: () => void; onSaved: () => void }) {
  const fn = useServerFn(createPromptVersion);
  const [system, setSystem] = useState<string>(clone?.system_prompt ?? "");
  const [model, setModel] = useState<string>(clone?.model ?? "");
  const [notes, setNotes] = useState<string>("");
  const [activate, setActivate] = useState(true);
  const mut = useMutation({
    mutationFn: () => fn({ data: { form_key, system_prompt: system, model: model || null, notes: notes || null, activate } }),
    onSuccess: () => { toast.success(`Created new version for ${form_key}`); onSaved(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>New version · <code className="font-mono">{form_key}</code></DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>System prompt</Label><Textarea rows={10} value={system} onChange={(e) => setSystem(e.target.value)} className="font-mono text-xs" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Model (optional override)</Label><Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="google/gemini-3-flash-preview" /></div>
            <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed and why" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} /> Activate immediately
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={mut.isPending || system.trim().length < 2} onClick={() => mut.mutate()}>{mut.isPending ? "Saving…" : "Publish version"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiffDialog({ a_id, b_id, onClose }: { a_id: string; b_id: string; onClose: () => void }) {
  const fn = useServerFn(getPromptDiff);
  const { data, isLoading } = useQuery({ queryKey: ["super-ai", "diff", a_id, b_id], queryFn: () => fn({ data: { a_id, b_id } }) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Prompt diff</DialogTitle></DialogHeader>
        {isLoading ? <div className="p-6 text-center text-muted-foreground">Loading…</div> : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-xs font-semibold">Active · v{data?.a?.version} · {data?.a?.model ?? "default model"}</div>
              <pre className="max-h-[60vh] overflow-auto rounded border border-border/60 bg-muted/30 p-2 font-mono text-xs whitespace-pre-wrap">{data?.a?.system_prompt}</pre>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold">Picked · v{data?.b?.version} · {data?.b?.model ?? "default model"}</div>
              <pre className="max-h-[60vh] overflow-auto rounded border border-border/60 bg-muted/30 p-2 font-mono text-xs whitespace-pre-wrap">{data?.b?.system_prompt}</pre>
            </div>
          </div>
        )}
        <DialogFooter><Button onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
