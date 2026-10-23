import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatInvoiceAmount, INVOICE_CURRENCIES } from "@/lib/invoice-currency";
import { Eye, EyeOff, Pencil, Plus, Sprout } from "lucide-react";
import {
  listMarketplaceCatalogAdmin,
  seedMarketplaceCatalog,
  setMarketplaceCertActive,
  setMarketplaceOemActive,
  setMarketplaceSkuActive,
  upsertMarketplaceCert,
  upsertMarketplaceOem,
  upsertMarketplaceSku,
} from "@/lib/admin-marketplace.functions";
import { PREP_SKU_TYPE_HUBS, PREP_SKU_TYPE_KEYS } from "@/lib/marketplace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminListPager } from "@/components/admin/admin-list-pager";

export const Route = createFileRoute("/_authenticated/admin/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace catalog — Admin — SkillTrack-365" }] }),
  component: MarketplaceAdminPage,
});

type Tab = "oems" | "certs" | "skus";

function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function MarketplaceAdminPage() {
  const list = useServerFn(listMarketplaceCatalogAdmin);
  const seed = useServerFn(seedMarketplaceCatalog);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("oems");
  const [certOemId, setCertOemId] = useState("all");
  const [certPage, setCertPage] = useState(1);
  const [skuCertId, setSkuCertId] = useState("all");
  const [skuPage, setSkuPage] = useState(1);
  const [skuSearch, setSkuSearch] = useState("");
  const [certChoiceSearch, setCertChoiceSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "marketplace-catalog", certOemId, certPage, skuCertId, skuPage, skuSearch, certChoiceSearch],
    queryFn: () =>
      list({
        data: {
          certPage,
          skuPage,
          pageSize: 50,
          certOemId: certOemId === "all" ? undefined : certOemId,
          skuCertId: skuCertId === "all" ? undefined : skuCertId,
          skuSearch: skuSearch || undefined,
          certChoiceSearch: certChoiceSearch || undefined,
        },
      }),
    retry: false,
  });

  const seedMut = useMutation({
    mutationFn: () => seed(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin", "marketplace-catalog"] });
      toast.success(`Seeded ${r.oems} OEMs · ${r.certs} certs · ${r.skus} SKUs`);
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Seed failed — apply the catalog migration first"),
  });

  const oems = data?.oems ?? [];
  const certs = data?.certs ?? [];
  const skus = data?.skus ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Marketplace catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            OEMs, certifications, and prep SKU types. Public pages read active rows; static seed is
            the offline fallback. Deactivate instead of deleting.
          </p>
        </div>
        <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
          <Sprout size={16} className="mr-1.5" />
          {seedMut.isPending ? "Seeding…" : "Seed static 4×4"}
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["oems", `OEMs (${data?.oemTotal ?? oems.length})`],
            ["certs", `Certs (${data?.certTotal ?? certs.length})`],
            ["skus", `SKUs (${data?.skuTotal ?? skus.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              tab === id
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-6 rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
          Could not load catalog ({(error as Error).message}). Apply{" "}
          <span className="font-mono text-xs">supabase/migrations/*marketplace_catalog*</span> then
          seed.
        </div>
      ) : isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading catalog…</p>
      ) : tab === "oems" ? (
        <OemsTable oems={oems} />
      ) : tab === "certs" ? (
        <CertsTable
          certs={certs}
          oems={oems}
          oemFilter={certOemId}
          onOemFilter={(value) => { setCertOemId(value); setCertPage(1); }}
          page={data?.certPage ?? certPage}
          pageSize={data?.pageSize ?? 50}
          total={data?.certTotal ?? 0}
          onPage={setCertPage}
        />
      ) : (
        <SkusTable
          skus={skus}
          certChoices={data?.certChoices ?? []}
          certFilter={skuCertId}
          onCertFilter={(value) => { setSkuCertId(value); setSkuPage(1); }}
          search={skuSearch}
          onSearch={(value) => { setSkuSearch(value); setSkuPage(1); }}
          certChoiceSearch={certChoiceSearch}
          onCertChoiceSearch={setCertChoiceSearch}
          page={data?.skuPage ?? skuPage}
          pageSize={data?.pageSize ?? 50}
          total={data?.skuTotal ?? 0}
          onPage={setSkuPage}
        />
      )}
    </div>
  );
}

function OemsTable({ oems }: { oems: any[] }) {
  const upsert = useServerFn(upsertMarketplaceOem);
  const setActive = useServerFn(setMarketplaceOemActive);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "marketplace-catalog"] });
      setOpen(false);
      toast.success("OEM saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const activeMut = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => setActive({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "marketplace-catalog"] });
      toast.success("OEM updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="mt-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus size={16} className="mr-1.5" /> New OEM
        </Button>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-border/60 bg-surface/40">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Key</th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Logo</th>
              <th className="px-4 py-2.5">Sort</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {oems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No OEMs. Seed the static 4×4 catalog.
                </td>
              </tr>
            ) : (
              oems.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.key}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {r.name}
                    <div className="text-xs text-muted-foreground">{r.short_name}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                    {r.logo_path}
                  </td>
                  <td className="px-4 py-2.5">{r.sort_order}</td>
                  <td className="px-4 py-2.5">
                    <ActivePill active={r.active} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => activeMut.mutate({ id: r.id, active: !r.active })}
                    >
                      {r.active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <OemDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        pending={save.isPending}
        onSave={(payload) => save.mutate(payload)}
      />
    </div>
  );
}

function OemDialog({
  open,
  onOpenChange,
  editing,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any | null;
  pending: boolean;
  onSave: (payload: any) => void;
}) {
  const [form, setForm] = useState<any>({});
  const ready = open
    ? editing
      ? { ...editing, ...form }
      : {
          key: "",
          name: "",
          short_name: "",
          logo_path: "/logos/oem/",
          sort_order: 10,
          active: true,
          ...form,
        }
    : {};
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setForm({});
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit OEM" : "New OEM"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field
            label="Key"
            value={ready.key ?? ""}
            disabled={Boolean(editing)}
            onChange={(v) => setForm((s: any) => ({ ...s, key: v }))}
          />
          <Field
            label="Name"
            value={ready.name ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, name: v }))}
          />
          <Field
            label="Short name"
            value={ready.short_name ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, short_name: v }))}
          />
          <Field
            label="Logo path"
            value={ready.logo_path ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, logo_path: v }))}
          />
          <Field
            label="Sort"
            value={String(ready.sort_order ?? 0)}
            onChange={(v) => setForm((s: any) => ({ ...s, sort_order: Number(v) || 0 }))}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              onSave({
                id: editing?.id,
                key: ready.key,
                name: ready.name,
                short_name: ready.short_name,
                logo_path: ready.logo_path,
                sort_order: Number(ready.sort_order) || 0,
                active: ready.active !== false,
              })
            }
            disabled={pending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CertsTable({
  certs,
  oems,
  oemFilter,
  onOemFilter,
  page,
  pageSize,
  total,
  onPage,
}: {
  certs: any[];
  oems: any[];
  oemFilter: string;
  onOemFilter: (value: string) => void;
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const upsert = useServerFn(upsertMarketplaceCert);
  const setActive = useServerFn(setMarketplaceCertActive);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const oemName = useMemo(() => Object.fromEntries(oems.map((o) => [o.id, o])), [oems]);
  const rows = certs;

  const save = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "marketplace-catalog"] });
      setOpen(false);
      toast.success("Certification saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const activeMut = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => setActive({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "marketplace-catalog"] });
      toast.success("Certification updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={oemFilter}
          onChange={(e) => onOemFilter(e.target.value)}
        >
          <option value="all">All OEMs</option>
          {oems.map((o) => (
            <option key={o.id} value={o.id}>
              {o.short_name}
            </option>
          ))}
        </select>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          disabled={oems.length === 0}
        >
          <Plus size={16} className="mr-1.5" /> New cert
        </Button>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-border/60 bg-surface/40">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Key</th>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">OEM</th>
              <th className="px-4 py-2.5">Catalog slug</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No certifications.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.key}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {r.name}
                    <div className="text-xs text-muted-foreground">
                      {r.code || "—"} · {r.short_name}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{oemName[r.oem_id]?.short_name ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                    {r.catalog_slug || "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <ActivePill active={r.active} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => activeMut.mutate({ id: r.id, active: !r.active })}
                    >
                      {r.active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <AdminListPager page={page} pageSize={pageSize} total={total} onPage={onPage} />
      </div>
      <CertDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        oems={oems}
        pending={save.isPending}
        onSave={(payload) => save.mutate(payload)}
      />
    </div>
  );
}

function CertDialog({
  open,
  onOpenChange,
  editing,
  oems,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any | null;
  oems: any[];
  pending: boolean;
  onSave: (payload: any) => void;
}) {
  const [form, setForm] = useState<any>({});
  const ready = open
    ? {
        oem_id: oems[0]?.id ?? "",
        key: "",
        catalog_slug: "",
        code: "",
        name: "",
        short_name: "",
        sort_order: 10,
        active: true,
        ...(editing ?? {}),
        ...form,
      }
    : {};
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setForm({});
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit certification" : "New certification"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>OEM</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={ready.oem_id ?? ""}
              onChange={(e) => setForm((s: any) => ({ ...s, oem_id: e.target.value }))}
            >
              {oems.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.short_name}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Key"
            value={ready.key ?? ""}
            disabled={Boolean(editing)}
            onChange={(v) => setForm((s: any) => ({ ...s, key: v }))}
          />
          <Field
            label="Name"
            value={ready.name ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, name: v }))}
          />
          <Field
            label="Short name"
            value={ready.short_name ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, short_name: v }))}
          />
          <Field
            label="Code"
            value={ready.code ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, code: v }))}
          />
          <Field
            label="Certifications catalog slug"
            value={ready.catalog_slug ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, catalog_slug: v }))}
          />
          <Field
            label="Sort"
            value={String(ready.sort_order ?? 0)}
            onChange={(v) => setForm((s: any) => ({ ...s, sort_order: Number(v) || 0 }))}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              onSave({
                id: editing?.id,
                oem_id: ready.oem_id,
                key: ready.key,
                catalog_slug: ready.catalog_slug || null,
                code: ready.code || null,
                name: ready.name,
                short_name: ready.short_name,
                sort_order: Number(ready.sort_order) || 0,
                active: ready.active !== false,
              })
            }
            disabled={pending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkusTable({
  skus,
  certChoices,
  certFilter,
  onCertFilter,
  search,
  onSearch,
  certChoiceSearch,
  onCertChoiceSearch,
  page,
  pageSize,
  total,
  onPage,
}: {
  skus: any[];
  certChoices: any[];
  certFilter: string;
  onCertFilter: (value: string) => void;
  search: string;
  onSearch: (value: string) => void;
  certChoiceSearch: string;
  onCertChoiceSearch: (value: string) => void;
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const upsert = useServerFn(upsertMarketplaceSku);
  const setActive = useServerFn(setMarketplaceSkuActive);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const certName = useMemo(() => {
    const map: Record<string, any> = {};
    for (const cert of certChoices) map[cert.id] = cert;
    for (const sku of skus) {
      if (sku.cert_id && sku.marketplace_certs) {
        map[sku.cert_id] = { ...map[sku.cert_id], ...sku.marketplace_certs, id: sku.cert_id };
      }
    }
    return map;
  }, [certChoices, skus]);
  const dialogCerts = Object.values(certName);
  const rows = skus;

  const save = useMutation({
    mutationFn: (payload: any) => upsert({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "marketplace-catalog"] });
      setOpen(false);
      toast.success("SKU saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const activeMut = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) => setActive({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "marketplace-catalog"] });
      toast.success("SKU updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={certChoiceSearch}
          onChange={(e) => onCertChoiceSearch(e.target.value)}
          placeholder="Find certification"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <select
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          value={certFilter}
          onChange={(e) => onCertFilter(e.target.value)}
        >
          <option value="all">All certs</option>
          {certChoices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.short_name}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search SKU title"
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          disabled={dialogCerts.length === 0}
        >
          <Plus size={16} className="mr-1.5" /> New SKU
        </Button>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-border/60 bg-surface/40">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Cert</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Price</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No SKUs.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-4 py-2.5">{certName[r.cert_id]?.short_name ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{r.sku_type}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.title}</div>
                    <div className="line-clamp-1 text-xs text-muted-foreground">{r.blurb}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{formatInvoiceAmount(r.price_inr, r.currency, 0)}</td>
                  <td className="px-4 py-2.5">
                    <ActivePill active={r.active} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => activeMut.mutate({ id: r.id, active: !r.active })}
                    >
                      {r.active ? <EyeOff size={14} /> : <Eye size={14} />}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <AdminListPager page={page} pageSize={pageSize} total={total} onPage={onPage} />
      </div>
      <SkuDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        certs={dialogCerts}
        pending={save.isPending}
        onSave={(payload) => save.mutate(payload)}
      />
    </div>
  );
}

function SkuDialog({
  open,
  onOpenChange,
  editing,
  certs,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: any | null;
  certs: any[];
  pending: boolean;
  onSave: (payload: any) => void;
}) {
  const [form, setForm] = useState<any>({});
  const ready = open
    ? {
        cert_id: certs[0]?.id ?? "",
        sku_type: "mock",
        title: "",
        blurb: "",
        price_inr: 999,
        currency: "INR",
        active: true,
        mock_exam_id: "",
        study_resource_id: "",
        question_bank_id: "",
        ...(editing ?? {}),
        ...form,
      }
    : {};
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setForm({});
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit SKU" : "New SKU"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Certification</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={ready.cert_id ?? ""}
              onChange={(e) => setForm((s: any) => ({ ...s, cert_id: e.target.value }))}
            >
              {certs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.short_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Type</Label>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={ready.sku_type ?? "mock"}
              disabled={Boolean(editing)}
              onChange={(e) => setForm((s: any) => ({ ...s, sku_type: e.target.value }))}
            >
              {PREP_SKU_TYPE_KEYS.map((t) => (
                <option key={t} value={t}>
                  {PREP_SKU_TYPE_HUBS[t].label}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Title"
            value={ready.title ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, title: v }))}
          />
          <div>
            <Label>Blurb</Label>
            <Textarea
              className="mt-1"
              value={ready.blurb ?? ""}
              onChange={(e) => setForm((s: any) => ({ ...s, blurb: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Currency</Label>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={ready.currency ?? "INR"}
                onChange={(e) => setForm((s: any) => ({ ...s, currency: e.target.value }))}
              >
                {INVOICE_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Price"
              value={String(ready.price_inr ?? 999)}
              onChange={(v) => setForm((s: any) => ({ ...s, price_inr: Number(v) || 0 }))}
            />
          </div>
          <Field
            label="mock_exams id (optional)"
            value={ready.mock_exam_id ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, mock_exam_id: v }))}
          />
          <Field
            label="study_resources id (optional)"
            value={ready.study_resource_id ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, study_resource_id: v }))}
          />
          <Field
            label="question_bank id (optional)"
            value={ready.question_bank_id ?? ""}
            onChange={(v) => setForm((s: any) => ({ ...s, question_bank_id: v }))}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() =>
              onSave({
                id: editing?.id,
                cert_id: ready.cert_id,
                sku_type: ready.sku_type,
                title: ready.title,
                blurb: ready.blurb || "",
                price_inr: Number(ready.price_inr) || 0,
                currency: ready.currency || "INR",
                active: ready.active !== false,
                mock_exam_id: ready.mock_exam_id || null,
                study_resource_id: ready.study_resource_id || null,
                question_bank_id: ready.question_bank_id || null,
                includes: editing?.includes ?? [],
                features: editing?.features ?? [],
                fulfilled_on_label: editing?.fulfilled_on_label ?? null,
                fulfilled_on_href: editing?.fulfilled_on_href ?? null,
              })
            }
            disabled={pending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
