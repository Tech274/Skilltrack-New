import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatInvoiceAmount, isGstCurrency } from "@/lib/invoice-currency";
import { buildHandoffUrl, SKILLHUB_BASE_URL } from "@/lib/handoff";
import { ArrowLeft, Download, Eye, Mail, Plus } from "lucide-react";
import {
  getInvoice,
  generateInvoicePdf,
  updateInvoiceStatus,
  recordPayment,
  emailInvoicePdf,
} from "@/lib/admin-invoices.functions";
import { downloadPdfFromBase64 } from "./admin.invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice — Admin — SkillTrack-365" }] }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const get = useServerFn(getInvoice);
  const pdf = useServerFn(generateInvoicePdf);
  const setStatus = useServerFn(updateInvoiceStatus);
  const sendEmail = useServerFn(emailInvoicePdf);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{
    base64: string;
    filename: string;
    snapshot: any;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailMsg, setEmailMsg] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "invoice", id],
    queryFn: () => get({ data: { id } }),
  });

  const pdfMut = useMutation({
    mutationFn: () => pdf({ data: { id } }),
    onSuccess: (r) => downloadPdfFromBase64(r.base64, r.filename),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const statusMut = useMutation({
    mutationFn: (status: any) => setStatus({ data: { id, status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "invoice", id] });
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
      toast.success("Updated");
    },
  });
  const emailMut = useMutation({
    mutationFn: () =>
      sendEmail({ data: { id, to: emailTo || undefined, message: emailMsg || undefined } }),
    onSuccess: (r) => {
      toast.success(`Invoice emailed to ${r.to}`);
      setEmailOpen(false);
      setEmailMsg("");
      qc.invalidateQueries({ queryKey: ["admin", "invoice", id] });
      qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send email"),
  });

  const openPreview = async () => {
    setPreviewLoading(true);
    try {
      const r = await pdf({ data: { id } });
      setPreview({ base64: r.base64, filename: r.filename, snapshot: (r as any).snapshot });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to render preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  if (isLoading || !data) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }
  const { invoice, payments } = data;
  const paidSum = (payments || [])
    .filter((p: any) => p.status === "success")
    .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, Number(invoice.total) - paidSum);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        to="/admin/invoices"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={12} /> Back to invoices
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoice_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{invoice.description || "Invoice"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={previewLoading} onClick={openPreview}>
            <Eye size={14} /> {previewLoading ? "Loading…" : "Preview"}
          </Button>
          <Button variant="outline" onClick={() => pdfMut.mutate()}>
            <Download size={14} /> PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEmailTo(invoice.learner_email || "");
              setEmailOpen(true);
            }}
          >
            <Mail size={14} /> Email PDF
          </Button>
          {invoice.status !== "paid" && (
            <Button onClick={() => statusMut.mutate("paid")}>Mark paid</Button>
          )}
          {invoice.status === "paid" && Boolean((invoice.learner_email || "").trim()) && (
            <Button
              variant="outline"
              onClick={async () => {
                const url = buildHandoffUrl(SKILLHUB_BASE_URL, {
                  email: invoice.learner_email,
                  invoice: invoice.id,
                });
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Hub unlock link copied — Ops grants Hub access manually this cut");
                } catch {
                  toast.error("Couldn't copy", { description: url });
                }
              }}
            >
              Copy Hub unlock link
            </Button>
          )}
        </div>
      </div>

      <Dialog
        open={!!preview}
        onOpenChange={(o) => {
          if (!o) setPreview(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Preview {invoice.invoice_number}</DialogTitle>
          </DialogHeader>
          {preview && (
            <>
              <div className="mb-2 grid grid-cols-3 gap-2 rounded-md border border-border/60 bg-surface/40 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Subtotal: </span>
                  {formatInvoiceAmount(preview.snapshot?.subtotal, invoice.currency)}
                </div>
                <div>
                  {isGstCurrency(invoice.currency) ? (
                    <>
                      <span className="text-muted-foreground">GST/Disc: </span>+
                      {formatInvoiceAmount(preview.snapshot?.tax, invoice.currency)} / -
                    </>
                  ) : (
                    <span className="text-muted-foreground">Disc: </span>
                  )}
                  {formatInvoiceAmount(preview.snapshot?.discount, invoice.currency)}
                </div>
                <div className="font-semibold">
                  <span className="text-muted-foreground font-normal">Total: </span>
                  {formatInvoiceAmount(preview.snapshot?.grandTotal, invoice.currency)}
                </div>
              </div>
              <iframe
                title={`Invoice ${invoice.invoice_number} preview`}
                src={`data:application/pdf;base64,${preview.base64}`}
                className="h-[70vh] w-full rounded-md border border-border/60 bg-white"
              />
            </>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email invoice PDF</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Recipient</Label>
              <Input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="billing@example.com"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Defaults to the billing email on this invoice.
              </p>
            </div>
            <div>
              <Label>Optional message</Label>
              <Textarea
                value={emailMsg}
                onChange={(e) => setEmailMsg(e.target.value)}
                rows={4}
                placeholder="Add a note for the recipient…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button disabled={emailMut.isPending || !emailTo} onClick={() => emailMut.mutate()}>
              {emailMut.isPending ? "Sending…" : "Send with PDF attached"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Status" value={invoice.status.toUpperCase()} />
        <Stat label="Total" value={formatInvoiceAmount(invoice.total, invoice.currency)} />
        <Stat
          label="Collected"
          value={formatInvoiceAmount(paidSum, invoice.currency)}
          tone="emerald"
        />
        <Stat
          label="Balance"
          value={formatInvoiceAmount(balance, invoice.currency)}
          tone={balance > 0 ? "amber" : undefined}
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card title="Bill to">
          <div className="text-sm">
            <div className="font-medium">{invoice.learner_name || "Learner"}</div>
            <div className="text-muted-foreground">{invoice.learner_email}</div>
            {invoice.billing_address && (
              <div className="mt-2 whitespace-pre-line text-muted-foreground">
                {invoice.billing_address}
              </div>
            )}
            {invoice.tax_number && (
              <div className="mt-1 text-xs text-muted-foreground">Tax #: {invoice.tax_number}</div>
            )}
          </div>
        </Card>
        <Card title="Invoice details">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Issue date</dt>
            <dd>{invoice.issue_date}</dd>
            <dt className="text-muted-foreground">Due date</dt>
            <dd>{invoice.due_date || "—"}</dd>
            <dt className="text-muted-foreground">Plan</dt>
            <dd>{invoice.plan_key || "—"}</dd>
            <dt className="text-muted-foreground">Currency</dt>
            <dd>{invoice.currency}</dd>
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatInvoiceAmount(invoice.amount, invoice.currency)}</dd>
            <dt className="text-muted-foreground">Discount</dt>
            <dd>- {formatInvoiceAmount(invoice.discount, invoice.currency)}</dd>
            {isGstCurrency(invoice.currency) && (
              <>
                <dt className="text-muted-foreground">GST</dt>
                <dd>{formatInvoiceAmount(invoice.tax, invoice.currency)}</dd>
              </>
            )}
          </dl>
        </Card>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Payments</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus size={14} /> Record payment
            </Button>
          </DialogTrigger>
          <RecordPaymentDialog
            invoiceId={invoice.id}
            learnerId={invoice.learner_id}
            currency={invoice.currency}
            defaultAmount={balance}
            onDone={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["admin", "invoice", id] });
              qc.invalidateQueries({ queryKey: ["admin", "invoices"] });
              qc.invalidateQueries({ queryKey: ["admin", "payments"] });
            }}
          />
        </Dialog>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Mode</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(payments || []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No payments recorded
                </td>
              </tr>
            )}
            {(payments || []).map((p: any) => (
              <tr key={p.id} className="border-t border-border/60">
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(p.paid_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 uppercase">{p.mode}</td>
                <td className="px-3 py-2 font-mono text-xs">{p.transaction_id || "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${p.status === "success" ? "bg-emerald-500/10 text-emerald-600" : p.status === "failed" ? "bg-rose-500/10 text-rose-600" : p.status === "refunded" ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-medium">
                  {formatInvoiceAmount(p.amount, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: any }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-4">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "amber";
}) {
  const toneCls =
    tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "";
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-semibold ${toneCls}`}>{value}</div>
    </div>
  );
}

export function RecordPaymentDialog({
  invoiceId,
  learnerId,
  currency,
  defaultAmount,
  onDone,
}: {
  invoiceId?: string;
  learnerId: string;
  currency: string;
  defaultAmount?: number;
  onDone: () => void;
}) {
  const record = useServerFn(recordPayment);
  const [amount, setAmount] = useState(defaultAmount ? String(defaultAmount.toFixed(2)) : "");
  const [mode, setMode] = useState<"upi" | "bank_transfer" | "card" | "cash" | "gateway">("upi");
  const [status, setStatus] = useState<"success" | "pending" | "failed" | "refunded">("success");
  const [transactionId, setTransactionId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [paidAt, setPaidAt] = useState<string>("");

  const mut = useMutation({
    mutationFn: () =>
      record({
        data: {
          invoiceId,
          learnerId,
          amount: Number(amount),
          currency,
          mode,
          status,
          transactionId: transactionId || undefined,
          remarks: remarks || undefined,
          paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div>
          <Label>Amount ({currency})</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="gateway">Online gateway</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Reference / Transaction ID</Label>
          <Input
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="UPI ref, txn id…"
          />
        </div>
        <div>
          <Label>Paid at (optional)</Label>
          <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div>
          <Label>Remarks</Label>
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!amount || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? "Saving…" : "Save payment"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
