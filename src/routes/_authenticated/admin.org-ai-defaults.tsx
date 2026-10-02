import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Settings as SettingsIcon, Save, RotateCcw } from "lucide-react";
import {
  listOrgAiDefaults,
  getOrgAiDefaults,
  setOrgAiDefaults,
  clearOrgAiDefaults,
} from "@/lib/admin-ai-defaults.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/org-ai-defaults")({
  head: () => ({ meta: [{ title: "Org AI Defaults — SkillTrack-365" }] }),
  component: OrgAiDefaultsPage,
});

const KNOWN_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-3-pro-preview",
  "openai/gpt-5",
  "anthropic/claude-sonnet-4-5",
];

function OrgAiDefaultsPage() {
  const listFn = useServerFn(listOrgAiDefaults);
  const { data, isLoading } = useQuery({ queryKey: ["org-ai-defaults", "list"], queryFn: () => listFn() });
  const [selected, setSelected] = useState<string | null>(null);
  const orgs = data?.orgs ?? [];
  const filtered = useMemo(() => orgs, [orgs]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <SettingsIcon size={20} className="text-primary" /> Per-organization AI defaults
        </h1>
        <p className="text-sm text-muted-foreground">
          Override the global default model, max output tokens, and LLM timeout for individual organizations.
          Leave a field blank to fall back to the global default.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-4 rounded-lg border border-border/60">
          <div className="border-b border-border/60 bg-surface/40 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            Organizations
          </div>
          <ul className="max-h-[480px] divide-y divide-border/60 overflow-y-auto text-sm">
            {isLoading && <li className="p-4 text-muted-foreground">Loading…</li>}
            {!isLoading && filtered.length === 0 && (
              <li className="p-4 text-muted-foreground">No organizations.</li>
            )}
            {filtered.map((o: any) => (
              <li
                key={o.id}
                onClick={() => setSelected(o.id)}
                className={`flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-surface/50 ${
                  selected === o.id ? "bg-surface/60" : ""
                }`}
              >
                <span className="truncate">
                  <span className="font-medium">{o.name}</span>{" "}
                  <span className="text-xs text-muted-foreground">/{o.slug}</span>
                </span>
                {o.override && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">override</span>
                )}
              </li>
            ))}
          </ul>
        </aside>

        <section className="col-span-8">
          {selected ? <OrgEditor orgId={selected} /> : (
            <div className="rounded-lg border border-dashed border-border/60 p-12 text-center text-sm text-muted-foreground">
              Select an organization to view or edit its AI defaults.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function OrgEditor({ orgId }: { orgId: string }) {
  const getFn = useServerFn(getOrgAiDefaults);
  const setFn = useServerFn(setOrgAiDefaults);
  const clearFn = useServerFn(clearOrgAiDefaults);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["org-ai-defaults", "row", orgId],
    queryFn: () => getFn({ data: { org_id: orgId } }),
  });

  const [model, setModel] = useState<string>("");
  const [maxTokens, setMaxTokens] = useState<string>("");
  const [timeoutMs, setTimeoutMs] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const o = data?.override;
    setModel(o?.default_model ?? "");
    setMaxTokens(o?.max_output_tokens != null ? String(o.max_output_tokens) : "");
    setTimeoutMs(o?.llm_timeout_ms != null ? String(o.llm_timeout_ms) : "");
    setErrors({});
  }, [data, orgId]);

  function validate(): { ok: boolean; payload?: any } {
    const errs: Record<string, string> = {};
    let mt: number | null = null;
    let to: number | null = null;
    const m: string | null = model.trim() ? model.trim() : null;
    if (m && (m.length < 2 || m.length > 200)) errs.model = "Model id must be 2–200 chars";
    if (maxTokens.trim()) {
      mt = Number(maxTokens);
      if (!Number.isInteger(mt) || mt < 64 || mt > 32000) errs.maxTokens = "Must be an integer 64–32000";
    }
    if (timeoutMs.trim()) {
      to = Number(timeoutMs);
      if (!Number.isInteger(to) || to < 10_000 || to > 120_000) errs.timeoutMs = "Must be an integer 10000–120000 ms";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return { ok: false };
    return {
      ok: true,
      payload: {
        org_id: orgId,
        default_model: m,
        max_output_tokens: mt,
        llm_timeout_ms: to,
      },
    };
  }

  const saveMut = useMutation({
    mutationFn: (payload: any) => setFn({ data: payload }),
    onSuccess: () => {
      toast.success("Org AI defaults saved");
      qc.invalidateQueries({ queryKey: ["org-ai-defaults"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const clearMut = useMutation({
    mutationFn: () => clearFn({ data: { org_id: orgId } }),
    onSuccess: () => {
      toast.success("Org override cleared — falling back to global defaults");
      qc.invalidateQueries({ queryKey: ["org-ai-defaults"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (isLoading) return <div className="rounded-lg border border-border/60 p-6 text-sm text-muted-foreground">Loading…</div>;

  const eff = data?.effective;
  const src = eff?.source;

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-5">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Effective settings</h2>
        <dl className="mt-2 grid grid-cols-3 gap-3 text-xs">
          <div><dt className="text-muted-foreground">Model</dt><dd className="font-mono">{eff?.default_model} <span className="text-muted-foreground">({src?.default_model})</span></dd></div>
          <div><dt className="text-muted-foreground">Max tokens</dt><dd className="font-mono">{eff?.max_output_tokens} <span className="text-muted-foreground">({src?.max_output_tokens})</span></dd></div>
          <div><dt className="text-muted-foreground">Timeout</dt><dd className="font-mono">{eff?.llm_timeout_ms}ms <span className="text-muted-foreground">({src?.llm_timeout_ms})</span></dd></div>
        </dl>
      </div>

      <div className="border-t border-border/60 pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Override</h2>
        <p className="mt-1 text-xs text-muted-foreground">Leave a field blank to use the global default for that field.</p>

        <div className="mt-3 space-y-3">
          <div>
            <Label>Default model</Label>
            <Input list="org-ai-models" value={model} onChange={(e) => setModel(e.target.value)} placeholder="(inherit global)" />
            <datalist id="org-ai-models">
              {KNOWN_MODELS.map((m) => <option key={m} value={m} />)}
            </datalist>
            {errors.model && <p className="mt-1 text-xs text-destructive">{errors.model}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Max output tokens (64–32000)</Label>
              <Input type="number" min={64} max={32000} value={maxTokens} onChange={(e) => setMaxTokens(e.target.value)} placeholder="(inherit)" />
              {errors.maxTokens && <p className="mt-1 text-xs text-destructive">{errors.maxTokens}</p>}
            </div>
            <div>
              <Label>LLM timeout in ms (10000–120000)</Label>
              <Input type="number" min={10000} max={120000} step={5000} value={timeoutMs} onChange={(e) => setTimeoutMs(e.target.value)} placeholder="(inherit)" />
              {errors.timeoutMs && <p className="mt-1 text-xs text-destructive">{errors.timeoutMs}</p>}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button disabled={saveMut.isPending} onClick={() => { const v = validate(); if (v.ok) saveMut.mutate(v.payload); }}>
              <Save size={14} className="mr-1.5" />
              {saveMut.isPending ? "Saving…" : "Save override"}
            </Button>
            <Button variant="outline" disabled={clearMut.isPending || !data?.override} onClick={() => clearMut.mutate()}>
              <RotateCcw size={14} className="mr-1.5" />
              {clearMut.isPending ? "Clearing…" : "Clear override"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
