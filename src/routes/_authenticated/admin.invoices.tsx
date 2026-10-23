import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatInvoiceAmount, formatCurrencyTotals, sumByCurrency, INVOICE_CURRENCIES, isGstCurrency, type InvoiceCurrency } from "@/lib/invoice-currency";
import { FileText, Plus, Download, Search, Send, Mail, History } from "lucide-react";
import { AdminListPager } from "@/components/admin/admin-list-pager";
import {
  listInvoices,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  generateInvoicePdf,
  searchLearners,
  listCertificationOptions,
  bulkEmailInvoicePdfs,
  listInvoiceEmailAudit,
  emailInvoicePdf,
} from "@/lib/admin-invoices.functions";
import { validateVoucher } from "@/lib/invoice-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { InvoiceRowActions } from "@/components/admin/invoice-row-actions";
import { buildHandoffUrl, SKILLHUB_BASE_URL } from "@/lib/handoff";
import { InvoiceAssistantPanel } from "@/components/admin/invoice-assistant-panel";

export const Route = createFileRoute("/_authenticated/admin/invoices")({
  head: () => ({ meta: [{ title: "Invoices — Admin — SkillTrack-365" }] }),
  component: InvoicesPage,
});

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  paid: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  overdue: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  cancelled: "bg-rose-500/10 text-rose-600 border-rose-500/30",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_TONE[status] || STATUS_TONE.draft}`}
    >
      {status}
    </span>
  );
}

export function downloadPdfFromBase64(base64: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const EMAIL_TONE: Record<string, string> = {
  not_sent: "bg-muted text-muted-foreground border-border",
  queued: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  sent: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  failed: "bg-rose-500/10 text-rose-600 border-rose-500/30",
};
function EmailStatusBadge({ status }: { status?: string | null }) {
  const s = status || "not_sent";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${EMAIL_TONE[s] || EMAIL_TONE.not_sent}`}
    >
      {s.replace("_", " ")}
    </span>
  );
}

function InvoicesPage() {
  const list = useServerFn(listInvoices);
  const pdf = useServerFn(generateInvoicePdf);
  const setStatus = useServerFn(updateInvoiceStatus);
  const remove = useServerFn(deleteInvoice);
  const bulkEmail = useServerFn(bulkEmailInvoicePdfs);
  const sendOne = useServerFn(emailInvoicePdf);
  const qc = useQueryClient();

  const [status, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openNew, setOpenNew] = useState(false);
  const [preview, setPreview] = useState<{
    id: string;
    number: string;
    base64: string;
    filename: string;
  } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [download, setDownload] = useState<{
    id: string;
    number: string;
    base64: string;
    defaultName: string;
  } | null>(null);
  const [downloadName, setDownloadName] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [auditOpen, setAuditOpen] = useState<{ id: string; number: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "invoices", status, search, page],
    queryFn: () => list({ data: { status, search, page, pageSize: 50 } }),
  });
  const rows = data?.rows ?? [];

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const allOnPage = rows.length > 0 && rows.every((r: any) => selected[r.id]);

  const pdfMut = useMutation({
    mutationFn: (id: string) => pdf({ data: { id } }),
    onSuccess: (r, id) => {
      const row: any = rows.find((x: any) => x.id === id);
      setDownload({
        id,
        number: row?.invoice_number ?? "invoice",
        base64: r.base64,
        defaultName: r.filename,
      });
      setDownloadName(r.filename);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to generate PDF"),
  });
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) =>
      setStatus({ data: { id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
      toast.success("Invoice updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
      toast.success("Invoice deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const bulkMut = useMutation({
    mutationFn: () => bulkEmail({ data: { ids: selectedIds, message: bulkMessage || undefined } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
      if (r.failed === 0) toast.success(`Emailed ${r.sent} invoice${r.sent === 1 ? "" : "s"}.`);
      else toast.warning(`Sent ${r.sent} • Failed ${r.failed}. Check the email audit for details.`);
      setBulkOpen(false);
      setSelected({});
      setBulkMessage("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Bulk email failed"),
  });
  const retryMut = useMutation({
    mutationFn: (id: string) => sendOne({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
      qc.invalidateQueries({ queryKey: ["admin", "invoice-email-audit"] });
      toast.success("Invoice resent");
    },
    onError: (e: any) => toast.error(e?.message ?? "Retry failed"),
  });

  const totals = {
    count: rows.length,
    value: sumByCurrency(rows, (r: any) => r.currency, (r: any) => r.total),
    paid: sumByCurrency(rows.filter((r: any) => r.status === "paid"), (r: any) => r.currency, (r: any) => r.total),
    outstanding: sumByCurrency(rows.filter((r: any) => r.status === "sent" || r.status === "overdue"), (r: any) => r.currency, (r: any) => r.total),
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate, send, and track invoices for learners and subscribers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setAuditOpen({ id: "", number: "All invoices" })}
          >
            <History size={14} /> Email audit
          </Button>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button>
                <Plus size={14} /> New invoice
              </Button>
            </DialogTrigger>
            <NewInvoiceDialog onDone={() => setOpenNew(false)} />
          </Dialog>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Invoices" value={String(data?.total ?? rows.length)} sub="Matching filters" icon={FileText} />
        <KpiCard label="Page value" value={formatCurrencyTotals(totals.value)} sub="This page" />
        <KpiCard label="Collected" value={formatCurrencyTotals(totals.paid)} tone="emerald" sub="This page" />
        <KpiCard label="Outstanding" value={formatCurrencyTotals(totals.outstanding)} tone="amber" sub="This page" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search invoice #, learner, email"
            className="h-9 w-72 pl-9"
          />
        </div>
        <Select value={status} onValueChange={(value) => { setStatusFilter(value); setPage(1); }}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
              <Button size="sm" onClick={() => setBulkOpen(true)}>
                <Mail size={14} /> Email selected as PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left w-8">
                <Checkbox
                  checked={allOnPage}
                  onCheckedChange={(v) => {
                    if (v) {
                      const next: Record<string, boolean> = { ...selected };
                      rows.forEach((r: any) => {
                        next[r.id] = true;
                      });
                      setSelected(next);
                    } else {
                      const next: Record<string, boolean> = { ...selected };
                      rows.forEach((r: any) => {
                        delete next[r.id];
                      });
                      setSelected(next);
                    }
                  }}
                />
              </th>
              <th className="px-4 py-2.5 text-left">Invoice</th>
              <th className="px-4 py-2.5 text-left">Learner</th>
              <th className="px-4 py-2.5 text-left">Issue date</th>
              <th className="px-4 py-2.5 text-left">Due</th>
              <th className="px-4 py-2.5 text-right">Total</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-left">Email</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  No invoices yet. Create your first one.
                </td>
              </tr>
            )}
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-border/60 hover:bg-surface/40">
                <td className="px-3 py-2.5">
                  <Checkbox
                    checked={!!selected[r.id]}
                    onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.id]: !!v }))}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Link
                    to="/admin/invoices/$id"
                    params={{ id: r.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {r.invoice_number}
                  </Link>
                  {r.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {r.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{r.learner_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.learner_email || ""}</div>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.issue_date}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.due_date || "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {formatInvoiceAmount(r.total, r.currency)}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <EmailStatusBadge status={r.email_status} />
                    {r.email_last_sent_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(r.email_last_sent_at).toLocaleString()}
                      </span>
                    )}
                    {r.email_status === "failed" && r.email_last_error && (
                      <span
                        className="text-[10px] text-rose-600 line-clamp-1"
                        title={r.email_last_error}
                      >
                        {r.email_last_error}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <InvoiceRowActions
                    invoice={r}
                    isPreviewLoading={previewLoadingId === r.id}
                    onDownload={() => pdfMut.mutate(r.id)}
                    onViewAudit={() => setAuditOpen({ id: r.id, number: r.invoice_number })}
                    onRetryEmail={() => retryMut.mutate(r.id)}
                    onPreviewAndSend={async () => {
                      setPreviewLoadingId(r.id);
                      try {
                        const out = await pdf({ data: { id: r.id } });
                        setPreview({
                          id: r.id,
                          number: r.invoice_number,
                          base64: out.base64,
                          filename: out.filename,
                        });
                      } catch (e: any) {
                        toast.error(e?.message ?? "Failed to render preview");
                      } finally {
                        setPreviewLoadingId(null);
                      }
                    }}
                    onMarkPaid={() => statusMut.mutate({ id: r.id, status: "paid" })}
                    onCopyHubUnlock={async () => {
                      const email = (r.learner_email || "").trim();
                      if (!email) {
                        toast.error("No learner email on this invoice");
                        return;
                      }
                      const url = buildHandoffUrl(SKILLHUB_BASE_URL, {
                        email,
                        invoice: r.id,
                      });
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Hub unlock link copied");
                      } catch {
                        toast.error("Couldn't copy", { description: url });
                      }
                    }}
                    onCancel={() => statusMut.mutate({ id: r.id, status: "cancelled" })}
                    onDelete={() => {
                      if (confirm(`Delete ${r.invoice_number}?`)) delMut.mutate(r.id);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AdminListPager page={data?.page ?? page} pageSize={data?.pageSize ?? 50} total={data?.total ?? 0} onPage={setPage} />
      </div>

      {/* Bulk email dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Email {selectedIds.length} invoice{selectedIds.length === 1 ? "" : "s"} as PDF
            </DialogTitle>
            <DialogDescription>
              Each invoice is sent to its billing recipient's email on file. Invoices missing an
              email will be marked as failed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Optional message (added to each email)</Label>
            <Textarea
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
              placeholder="A short note shown to the recipient"
              maxLength={2000}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button disabled={bulkMut.isPending} onClick={() => bulkMut.mutate()}>
              <Mail size={14} />{" "}
              {bulkMut.isPending
                ? "Sending…"
                : `Send ${selectedIds.length} email${selectedIds.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download confirmation + filename customization */}
      <Dialog
        open={!!download}
        onOpenChange={(o) => {
          if (!o) {
            setDownload(null);
            setDownloadName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download invoice {download?.number}</DialogTitle>
            <DialogDescription>
              Confirm the filename. The file contents match the previewed PDF exactly.
            </DialogDescription>
          </DialogHeader>
          {download && (
            <iframe
              title="Download preview"
              src={`data:application/pdf;base64,${download.base64}`}
              className="h-[40vh] w-full rounded-md border border-border/60 bg-white"
            />
          )}
          <div className="space-y-2">
            <Label>Filename</Label>
            <Input
              value={downloadName}
              onChange={(e) => setDownloadName(e.target.value)}
              placeholder={download?.defaultName ?? "invoice.pdf"}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDownload(null);
                setDownloadName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!download) return;
                let name = (downloadName || download.defaultName).trim();
                if (!name) name = download.defaultName;
                if (!/\.pdf$/i.test(name)) name = `${name}.pdf`;
                downloadPdfFromBase64(download.base64, name);
                toast.success("Invoice PDF downloaded");
                setDownload(null);
                setDownloadName("");
              }}
            >
              <Download size={14} /> Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email audit dialog */}
      <Dialog
        open={!!auditOpen}
        onOpenChange={(o) => {
          if (!o) setAuditOpen(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Email audit — {auditOpen?.number}</DialogTitle>
            <DialogDescription>Delivery results recorded for each send attempt.</DialogDescription>
          </DialogHeader>
          {auditOpen && <EmailAuditList invoiceId={auditOpen.id || undefined} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditOpen(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!preview}
        onOpenChange={(o) => {
          if (!o) setPreview(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Preview invoice {preview?.number}</DialogTitle>
          </DialogHeader>
          {preview && (
            <iframe
              title={`Invoice ${preview.number} preview`}
              src={`data:application/pdf;base64,${preview.base64}`}
              className="h-[70vh] w-full rounded-md border border-border/60 bg-white"
            />
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => preview && downloadPdfFromBase64(preview.base64, preview.filename)}
            >
              <Download size={14} /> Download
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Close
            </Button>
            <Button
              disabled={statusMut.isPending}
              onClick={() => {
                if (!preview) return;
                statusMut.mutate(
                  { id: preview.id, status: "sent" },
                  { onSuccess: () => setPreview(null) },
                );
              }}
            >
              <Send size={14} /> Confirm & mark as sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InvoiceAssistantPanel />
    </div>
  );
}

function EmailAuditList({ invoiceId }: { invoiceId?: string }) {
  const listAudit = useServerFn(listInvoiceEmailAudit);
  const [recipient, setRecipient] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const filters = {
    invoiceId,
    recipient: recipient || undefined,
    invoiceNumber: invoiceNumber || undefined,
    status: status === "all" ? undefined : (status as any),
    fromDate: fromDate || undefined,
    toDate: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
    page,
    pageSize: 50,
  };
  const { data, isLoading } = useQuery({
    queryKey: [
      "admin",
      "invoice-email-audit",
      invoiceId ?? "all",
      recipient,
      invoiceNumber,
      status,
      fromDate,
      toDate,
      page,
    ],
    queryFn: () => listAudit({ data: filters }),
  });
  const rows = data?.rows ?? [];
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {!invoiceId && (
          <Input
            placeholder="Invoice #"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="h-8"
          />
        )}
        <Input
          placeholder="Recipient email"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="h-8"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-8"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-8"
        />
      </div>
      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Loading audit…</div>
      ) : rows.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No email attempts match these filters.
        </div>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">When</th>
                <th className="px-2 py-2 text-left">Invoice</th>
                <th className="px-2 py-2 text-left">Recipient</th>
                <th className="px-2 py-2 text-left">Actor</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5">{r.invoice_number || r.invoice_id?.slice(0, 8)}</td>
                  <td className="px-2 py-1.5">{r.recipient_email}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {r.actor_email || r.actor_id?.slice(0, 8) || "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    <EmailStatusBadge status={r.status} />
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {r.status === "failed" ? (
                      <span className="text-rose-600">{r.error_message}</span>
                    ) : (
                      r.provider_message_id || "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <AdminListPager page={data?.page ?? page} pageSize={data?.pageSize ?? 50} total={data?.total ?? 0} onPage={setPage} />
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "emerald" | "amber";
  icon?: any;
}) {
  const toneCls =
    tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "";
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon size={14} />}
      </div>
      <div className={`mt-1 text-xl font-semibold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function NewInvoiceDialog({ onDone }: { onDone: () => void }) {
  const create = useServerFn(createInvoice);
  const findLearners = useServerFn(searchLearners);
  const listCerts = useServerFn(listCertificationOptions);
  const qc = useQueryClient();

  const [learnerQuery, setLearnerQuery] = useState("");
  const [learner, setLearner] = useState<{
    id: string;
    display_name: string | null;
    email: string | null;
  } | null>(null);
  const [certId, setCertId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [planKey, setPlanKey] = useState("");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"draft" | "sent">("draft");

  const { data: certs = [] } = useQuery({
    queryKey: ["admin", "cert-options"],
    queryFn: () => listCerts({}),
  });

  const { data: learners = [] } = useQuery({
    queryKey: ["admin", "learner-search", learnerQuery],
    queryFn: () => findLearners({ data: { q: learnerQuery } }),
  });

  const [currency, setCurrency] = useState<InvoiceCurrency>("INR");
  const gst = isGstCurrency(currency);
  const total = Math.max(0, Number(amount || 0) - Number(discount || 0) + (gst ? Number(tax || 0) : 0));

  // Client-side voucher validation — mirrors the server-side rule so the user
  // sees the problem before submitting and the submit button is disabled while
  // the selected voucher does not resolve to a positive, matching cost.
  const selectedCert: any = certs.find((c: any) => c.id === certId);
  const voucherCheck =
    certId && selectedCert
      ? validateVoucher(
          {
            slug: selectedCert.slug,
            name: selectedCert.name,
            code: selectedCert.code ?? null,
            status: selectedCert.status ?? "published",
            cost_usd: Number(selectedCert.voucher_cost ?? 0),
          },
          Number(amount || 0),
        )
      : { ok: true as const };
  const voucherError = !voucherCheck.ok ? voucherCheck.message : null;

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          learnerId: learner!.id,
          learnerEmail: learner?.email ?? undefined,
          learnerName: learner?.display_name ?? undefined,
          description: description || undefined,
          planKey: planKey || undefined,
          certificationSlug: certs.find((c: any) => c.id === certId)?.slug,
          amount: Number(amount),
          discount: Number(discount || 0),
          tax: gst ? Number(tax || 0) : 0,
          currency,
          dueDate: dueDate || undefined,
          status,
        },
      }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
      toast.success(`Created ${r.invoice_number}`);
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create invoice"),
  });

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>New invoice</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Learner</Label>
          {learner ? (
            <div className="mt-1 flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{learner.display_name || "Learner"}</div>
                <div className="text-xs text-muted-foreground">{learner.email}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setLearner(null)}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Search learners…"
                value={learnerQuery}
                onChange={(e) => setLearnerQuery(e.target.value)}
                className="mt-1"
              />
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border/60">
                {learners.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
                )}
                {learners.map((l: any) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLearner(l)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-surface"
                  >
                    <div className="font-medium">{l.display_name || "Unnamed"}</div>
                    <div className="text-xs text-muted-foreground">{l.email}</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div>
          <Label>Certification voucher</Label>
          <Select
            value={certId || "none"}
            onValueChange={(v) => {
              if (v === "none") {
                setCertId("");
                return;
              }
              const c: any = certs.find((x: any) => x.id === v);
              setCertId(v);
              if (c) {
                setAmount(String(c.voucher_cost ?? ""));
                setDescription(`${c.name}${c.code ? ` (${c.code})` : ""} — Exam voucher`);
                if (!planKey) setPlanKey(c.slug);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a certification (auto-fills cost)" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="none">— None / custom —</SelectItem>
              {certs.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  Exam: {c.name}
                  {c.code ? ` (${c.code})` : ""}
                  {c.vendor ? ` · ${c.vendor}` : ""} — {formatInvoiceAmount(c.voucher_cost, "INR", 0)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Picking a certification auto-fills the voucher cost and description.
          </p>
          {voucherError && (
            <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {voucherError}
            </p>
          )}
        </div>
        <div>
          <Label>Description</Label>
          <Input
            placeholder="e.g. Premium plan — 6 months"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Plan key</Label>
            <Input
              value={planKey}
              onChange={(e) => setPlanKey(e.target.value)}
              placeholder="premium"
            />
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as InvoiceCurrency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Discount</Label>
            <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>
          {gst && (
            <div>
              <Label>GST</Label>
              <Input type="number" value={tax} onChange={(e) => setTax(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-surface px-3 py-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
          <div className="text-lg font-semibold">{formatInvoiceAmount(total, currency)}</div>
        </div>
        <div>
          <Label>Status on create</Label>
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button
          disabled={!learner || !amount || !!voucherError || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending ? "Creating…" : "Create invoice"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
