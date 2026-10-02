import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_TYPES,
  deleteCampaign,
  listCampaignsAdmin,
  upsertCampaign,
  type Campaign,
} from "@/lib/campaigns.functions";
import { CampaignSlide } from "@/components/campaign-carousel";

export const Route = createFileRoute("/_authenticated/admin/campaigns")({
  head: () => ({ meta: [{ title: "Homepage campaigns — SkillTrack Admin" }] }),
  component: CampaignsAdmin,
});

const MAX_BYTES = 5 * 1024 * 1024;
const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

type Draft = Omit<Campaign, "id" | "desktop_src" | "mobile_src"> & {
  id?: string;
  desktop_src?: string | null;
  mobile_src?: string | null;
};

const blank: Draft = {
  slug: "",
  campaign_type: "platform",
  title: "",
  eyebrow: "",
  headline: "",
  description: "",
  desktop_image_url: null,
  mobile_image_url: null,
  image_alt: "",
  primary_cta_label: "",
  primary_cta_url: "/",
  secondary_cta_label: "",
  secondary_cta_url: "",
  audience: "all",
  priority: 100,
  start_date: null,
  end_date: null,
  is_active: true,
  theme: "dark",
  text_alignment: "left",
  image_position: "right",
  badge: "",
  analytics_id: "",
};

function status(c: Campaign) {
  const now = Date.now();
  if (!c.is_active) return { label: "Off", cls: "bg-muted text-muted-foreground" };
  if (c.start_date && new Date(c.start_date).getTime() > now)
    return { label: "Scheduled", cls: "bg-accent/15 text-accent" };
  if (c.end_date && new Date(c.end_date).getTime() < now)
    return { label: "Expired", cls: "bg-destructive/15 text-destructive" };
  return { label: "Live", cls: "bg-primary/15 text-primary" };
}

const toLocal = (v: string | null) => (v ? new Date(v).toISOString().slice(0, 16) : "");
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

function CampaignsAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listCampaignsAdmin);
  const save = useServerFn(upsertCampaign);
  const remove = useServerFn(deleteCampaign);
  const q = useQuery({ queryKey: ["admin-campaigns"], queryFn: () => list() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<Campaign | null>(null);

  const saveM = useMutation({
    mutationFn: (d: Draft) => {
      const { desktop_src, mobile_src, ...rest } = d as Draft & Record<string, unknown>;
      void desktop_src;
      void mobile_src;
      const payload = { ...rest } as Record<string, unknown>;
      delete payload.created_at;
      delete payload.updated_at;
      delete payload.created_by;
      return save({ data: payload as any });
    },
    onSuccess: () => {
      toast.success("Campaign saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Campaign deleted");
      qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Homepage campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rotating banners on the homepage. Live campaigns show in priority order (lowest first),
            up to 8.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...blank })}
          className="inline-flex items-center gap-2 rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus size={16} /> New campaign
        </button>
      </div>

      {q.isLoading && <div className="text-sm text-muted-foreground">Loading campaigns…</div>}
      {q.error && <div className="text-sm text-destructive">{(q.error as Error).message}</div>}

      {!q.isLoading && rows.length === 0 && !q.error && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No campaigns yet — the homepage shows the standard SkillTrack hero.
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Priority</th>
                <th className="p-3">Campaign</th>
                <th className="p-3">Type</th>
                <th className="p-3">Window</th>
                <th className="p-3">Image</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const s = status(c);
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-3 font-mono">{c.priority}</td>
                    <td className="p-3">
                      <div className="font-medium">{c.title}</div>
                      <div className="text-xs text-muted-foreground">{c.headline}</div>
                    </td>
                    <td className="p-3">{c.campaign_type}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {c.start_date ? new Date(c.start_date).toLocaleDateString() : "Any time"} –{" "}
                      {c.end_date ? new Date(c.end_date).toLocaleDateString() : "no end"}
                    </td>
                    <td className="p-3 text-xs">
                      {c.desktop_src || c.mobile_src ? "Yes" : <span className="text-muted-foreground">Text only</span>}
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <IconBtn label="Preview" onClick={() => setPreview(c)}>
                          <Eye size={15} />
                        </IconBtn>
                        <IconBtn label="Edit" onClick={() => setDraft({ ...c })}>
                          <Pencil size={15} />
                        </IconBtn>
                        <IconBtn
                          label="Delete"
                          onClick={() => {
                            if (confirm(`Delete "${c.title}"?`)) delM.mutate(c.id);
                          }}
                        >
                          <Trash2 size={15} />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <Modal title={`Preview — ${preview.title}`} onClose={() => setPreview(null)} wide>
          <div className="relative overflow-hidden rounded-lg border border-border p-6">
            <div className="absolute inset-0 bg-mesh" />
            <div className="relative">
              <CampaignSlide c={preview} />
            </div>
          </div>
        </Modal>
      )}

      {draft && (
        <Editor
          draft={draft}
          setDraft={setDraft}
          saving={saveM.isPending}
          onSave={() => saveM.mutate(draft)}
          onPreview={() => setPreview(draft as Campaign)}
        />
      )}
    </div>
  );
}

function IconBtn(props: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
      className="rounded-md p-2 text-muted-foreground hover:bg-surface hover:text-foreground"
    >
      {props.children}
    </button>
  );
}

function Modal(props: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-label={props.title}>
      <div className={`mt-8 w-full ${props.wide ? "max-w-6xl" : "max-w-3xl"} rounded-xl border border-border bg-card p-6 shadow-card`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <IconBtn label="Close" onClick={props.onClose}>
            <X size={16} />
          </IconBtn>
        </div>
        {props.children}
      </div>
    </div>
  );
}

function Field(props: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{props.label}</span>
      {props.children}
      {props.hint && <span className="block text-xs text-muted-foreground">{props.hint}</span>}
    </label>
  );
}

function ImageField(props: {
  label: string;
  value: string | null;
  src: string | null | undefined;
  onChange: (path: string | null, src: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    if (!/^image\/(png|jpe?g|webp|avif)$/.test(file.type)) return toast.error("Use PNG, JPG, WebP or AVIF");
    if (file.size > MAX_BYTES) return toast.error("Image must be 5 MB or smaller");
    setBusy(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `campaigns/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("campaign-images").upload(path, file, { contentType: file.type });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    const { data } = await supabase.storage.from("campaign-images").createSignedUrl(path, 3600);
    setBusy(false);
    props.onChange(path, data?.signedUrl ?? null);
  };
  return (
    <Field label={props.label}>
      <div className="flex items-center gap-3">
        <div className="h-16 w-24 overflow-hidden rounded-md border border-border bg-surface">
          {props.src && <img src={props.src} alt="" className="h-full w-full object-cover" />}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface">
          <Upload size={14} /> {busy ? "Uploading…" : props.value ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
        </label>
        {props.value && (
          <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => props.onChange(null, null)}>
            Remove
          </button>
        )}
      </div>
    </Field>
  );
}

function Editor(props: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  saving: boolean;
  onSave: () => void;
  onPreview: () => void;
}) {
  const d = props.draft;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => props.setDraft({ ...d, [k]: v });
  const text = (k: keyof Draft, max: number) => (
    <input className={input} maxLength={max} value={(d[k] as string) ?? ""} onChange={(e) => set(k, e.target.value as any)} />
  );
  return (
    <Modal title={d.id ? "Edit campaign" : "New campaign"} onClose={() => props.setDraft(null as any)}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          props.onSave();
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Internal title">{text("title", 120)}</Field>
          <Field label="Slug" hint="lowercase-with-hyphens">{text("slug", 80)}</Field>
          <Field label="Type">
            <select className={input} value={d.campaign_type} onChange={(e) => set("campaign_type", e.target.value)}>
              {CAMPAIGN_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Audience">
            <select className={input} value={d.audience} onChange={(e) => set("audience", e.target.value)}>
              {CAMPAIGN_AUDIENCES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Eyebrow">{text("eyebrow", 80)}</Field>
          <Field label="Badge" hint="Short label, e.g. New">{text("badge", 40)}</Field>
        </div>
        <Field label="Headline" hint="Keep it under ~12 words">{text("headline", 120)}</Field>
        <Field label="Description">
          <textarea className={input} rows={3} maxLength={280} value={d.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Button label">{text("primary_cta_label", 40)}</Field>
          <Field label="Button link" hint="/page or https://…">{text("primary_cta_url", 500)}</Field>
          <Field label="Secondary text link label (optional)">{text("secondary_cta_label", 40)}</Field>
          <Field label="Secondary link (optional)">{text("secondary_cta_url", 500)}</Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ImageField label="Desktop image" value={d.desktop_image_url} src={d.desktop_src} onChange={(p, s) => props.setDraft({ ...d, desktop_image_url: p, desktop_src: s })} />
          <ImageField label="Mobile image (optional)" value={d.mobile_image_url} src={d.mobile_src} onChange={(p, s) => props.setDraft({ ...d, mobile_image_url: p, mobile_src: s })} />
        </div>
        <Field label="Image alt text" hint="Required when an image is set">{text("image_alt", 200)}</Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Priority" hint="Lower shows first">
            <input type="number" className={input} value={d.priority} onChange={(e) => set("priority", Number(e.target.value) || 0)} />
          </Field>
          <Field label="Starts">
            <input type="datetime-local" className={input} value={toLocal(d.start_date)} onChange={(e) => set("start_date", fromLocal(e.target.value))} />
          </Field>
          <Field label="Ends">
            <input type="datetime-local" className={input} value={toLocal(d.end_date)} onChange={(e) => set("end_date", fromLocal(e.target.value))} />
          </Field>
          <Field label="Image side">
            <select className={input} value={d.image_position} onChange={(e) => set("image_position", e.target.value)}>
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </Field>
          <Field label="Text alignment">
            <select className={input} value={d.text_alignment} onChange={(e) => set("text_alignment", e.target.value)}>
              <option value="left">Left</option>
              <option value="center">Center</option>
            </select>
          </Field>
          <Field label="Analytics ID">{text("analytics_id", 80)}</Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.is_active} onChange={(e) => set("is_active", e.target.checked)} />
          Active
        </label>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button type="button" onClick={props.onPreview} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm">
            <Eye size={15} /> Preview
          </button>
          <button type="submit" disabled={props.saving} className="rounded-md bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {props.saving ? "Saving…" : "Save campaign"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
