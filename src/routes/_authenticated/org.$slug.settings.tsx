import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Save, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AiFillButton } from "@/components/ai/ai-fill-button";
import { AutofillReasoningPanel } from "@/components/admin/autofill-reasoning-panel";
import { getOrgBySlug } from "@/lib/org.functions";
import { getOrgSettings, updateOrgSettings, proposeOrgSettingsFromJob } from "@/lib/org-settings.functions";

export const Route = createFileRoute("/_authenticated/org/$slug/settings")({
  head: () => ({ meta: [{ title: "Settings — Workspace" }, { name: "robots", content: "noindex" }] }),
  component: OrgSettingsPage,
});




function OrgSettingsPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const orgFn = useServerFn(getOrgBySlug);
  const settingsFn = useServerFn(getOrgSettings);
  const saveFn = useServerFn(updateOrgSettings);
  const proposeFn = useServerFn(proposeOrgSettingsFromJob);

  const orgQ = useQuery({ queryKey: ["org", slug], queryFn: () => orgFn({ data: { slug } }) });
  const orgId = orgQ.data?.id;

  const settingsQ = useQuery({
    queryKey: ["org-settings", orgId],
    queryFn: () => settingsFn({ data: { orgId: orgId! } }),
    enabled: !!orgId,
  });

  const [industry, setIndustry] = useState("");
  const [sizeBand, setSizeBand] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [tpl, setTpl] = useState<Record<string, any>>({});
  const [jobIdImport, setJobIdImport] = useState("");

  useEffect(() => {
    const o = settingsQ.data?.org as any;
    if (!o) return;
    setIndustry(o.industry ?? "");
    setSizeBand(o.size_band ?? "");
    setWebsite(o.website ?? "");
    setDescription(o.description ?? "");
    setSettings(o.settings ?? {});
    setTpl(o.program_template ?? {});
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          orgId: orgId!,
          patch: {
            industry: industry || null,
            size_band: sizeBand || null,
            website: website || null,
            description: description || null,
            settings,
            program_template: tpl,
          },
        },
      }),
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["org-settings", orgId] }); },
    onError: (e: any) => toast.error(e?.message ?? "Save failed"),
  });

  const [proposal, setProposal] = useState<any>(null);
  const importFromJob = useMutation({
    mutationFn: () => proposeFn({ data: { orgId: orgId!, jobId: jobIdImport } }),
    onSuccess: (res) => {
      setProposal(res);
      toast.success(`Proposal ready from job (${res?.fromJob?.target_entity ?? "unknown"}) — review below`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Import failed"),
  });

  const acceptField = (key: string, value: any) => {
    const [bucket, field] = key.split(".");
    if (bucket === "settings") setSettings((s) => ({ ...s, [field]: value }));
    if (bucket === "program_template") setTpl((s) => ({ ...s, [field]: value }));
    toast.success(`Accepted ${key}`);
  };
  const rejectField = (key: string) => {
    setProposal((p: any) => {
      if (!p) return p;
      const next = { ...p, patch: { ...p.patch } };
      const [bucket, field] = key.split(".");
      if (next.patch[bucket]) {
        const { [field]: _, ...rest } = next.patch[bucket];
        next.patch[bucket] = rest;
      }
      const { [key]: __, ...reasonRest } = next.reasoning ?? {};
      next.reasoning = reasonRest;
      return next;
    });
  };
  const acceptAll = () => {
    if (!proposal) return;
    const s = proposal.patch?.settings ?? {};
    const t = proposal.patch?.program_template ?? {};
    if (Object.keys(s).length) setSettings((cur) => ({ ...cur, ...s }));
    if (Object.keys(t).length) setTpl((cur) => ({ ...cur, ...t }));
    setProposal(null);
    toast.success("All proposals accepted");
  };


  const applyAi = (patch: Record<string, unknown>) => {
    if (typeof patch.industry === "string") setIndustry(patch.industry);
    if (typeof patch.size_band === "string") setSizeBand(patch.size_band);
    if (typeof patch.website === "string") setWebsite(patch.website);
    if (typeof patch.description === "string") setDescription(patch.description);
    if (patch.settings && typeof patch.settings === "object") setSettings({ ...settings, ...(patch.settings as any) });
    if (patch.program_template && typeof patch.program_template === "object") setTpl({ ...tpl, ...(patch.program_template as any) });
  };

  if (orgQ.isLoading || settingsQ.isLoading) {
    return <div className="mx-auto max-w-4xl px-6 py-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-primary">Workspace</p>
          <h2 className="text-xl font-semibold tracking-tight">Settings & program template</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant-specific defaults for invoices, reminders, and learner program templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AiFillButton
            formKey="org_settings"
            currentValues={{ industry, size_band: sizeBand, website, description, settings, program_template: tpl }}
            onApply={applyAi}
            contextHint={`Organization: ${orgQ.data?.name ?? slug}. Industry: ${industry || "unknown"}.`}
          />
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save size={14} className="mr-1.5" /> {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Card className="mt-6 p-4">
        <h3 className="text-sm font-semibold">Organization profile</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Industry</Label>
            <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          <div>
            <Label>Size band</Label>
            <select value={sizeBand} onChange={(e) => setSizeBand(e.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
              <option value="">—</option>
              {["1-10", "11-50", "51-200", "201-1000", "1000+"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tenant settings</h3>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Sparkles size={11} /> Merged on save</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Invoice currency</Label>
            <Input
              value={settings.invoice_currency ?? ""}
              onChange={(e) => setSettings({ ...settings, invoice_currency: e.target.value || undefined })}
              placeholder="INR"
            />
          </div>
          <div>
            <Label>Invoice terms (days)</Label>
            <Input
              type="number"
              value={settings.invoice_terms_days ?? ""}
              onChange={(e) => setSettings({ ...settings, invoice_terms_days: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div>
            <Label>Reminder cadence (days)</Label>
            <Input
              type="number"
              value={settings.reminder_cadence_days ?? ""}
              onChange={(e) => setSettings({ ...settings, reminder_cadence_days: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div>
            <Label>Default learner role</Label>
            <Input
              value={settings.default_learner_role ?? ""}
              onChange={(e) => setSettings({ ...settings, default_learner_role: e.target.value || undefined })}
            />
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <h3 className="text-sm font-semibold">Learner program template</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Default certifications (comma-separated slugs)</Label>
            <Input
              value={(tpl.default_certifications ?? []).join(", ")}
              onChange={(e) => setTpl({ ...tpl, default_certifications: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </div>
          <div>
            <Label>Onboarding weeks</Label>
            <Input
              type="number"
              value={tpl.onboarding_weeks ?? ""}
              onChange={(e) => setTpl({ ...tpl, onboarding_weeks: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div>
            <Label>Mentorship</Label>
            <select
              value={tpl.mentorship ?? ""}
              onChange={(e) => setTpl({ ...tpl, mentorship: e.target.value || undefined })}
              className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">—</option>
              <option value="none">None</option>
              <option value="buddy">Buddy</option>
              <option value="coach">Coach</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Required assessments (one per line)</Label>
            <Textarea
              rows={3}
              value={(tpl.required_assessments ?? []).join("\n")}
              onChange={(e) => setTpl({ ...tpl, required_assessments: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Completion criteria</Label>
            <Textarea
              rows={2}
              value={tpl.completion_criteria ?? ""}
              onChange={(e) => setTpl({ ...tpl, completion_criteria: e.target.value || undefined })}
            />
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Wand2 size={14} className="text-primary" /> Pre-fill from extracted upload
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste an AI extraction job ID (from /admin/ai-imports). We will derive sensible defaults from its mapped columns and staged rows — review before saving.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Input value={jobIdImport} onChange={(e) => setJobIdImport(e.target.value)} placeholder="extraction job UUID" className="font-mono" />
          <Button variant="outline" onClick={() => importFromJob.mutate()} disabled={!jobIdImport || importFromJob.isPending}>
            {importFromJob.isPending ? "Importing…" : "Pre-fill"}
          </Button>
        </div>
      </Card>

      <AutofillReasoningPanel
        proposal={proposal}
        currentSettings={settings}
        currentTemplate={tpl}
        onAccept={acceptField}
        onReject={rejectField}
        onAcceptAll={acceptAll}
        onDismiss={() => setProposal(null)}
      />
    </div>
  );
}
