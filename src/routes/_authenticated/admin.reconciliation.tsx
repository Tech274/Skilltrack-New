import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Sparkles, Check, X, Loader2, AlertTriangle, ListChecks, ReceiptText } from "lucide-react";
import {
  analyzeReconciliation,
  applyReconciliationMatch,
  rejectReconciliationMatch,
} from "@/lib/admin-reconciliation.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/reconciliation")({
  component: ReconciliationPage,
});

type Candidate = {
  paymentId: string;
  invoiceId: string;
  confidence: number;
  verdict: "likely" | "uncertain" | "unlikely";
  summary: string;
  reasons: string[];
  checklist: string[];
  payment: any;
  invoice: any;
  aiUsed: boolean;
};

function money(amount: any, currency: string) {
  const n = Number(amount ?? 0);
  return `${currency} ${n.toFixed(2)}`;
}

function ConfidenceBadge({ value, verdict }: { value: number; verdict: string }) {
  const color =
    verdict === "likely"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : verdict === "uncertain"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-rose-500/15 text-rose-300 border-rose-500/30";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${color}`}>
      {value.toFixed(0)}% · {verdict}
    </span>
  );
}

function ReconciliationPage() {
  const analyzeFn = useServerFn(analyzeReconciliation);
  const applyFn = useServerFn(applyReconciliationMatch);
  const rejectFn = useServerFn(rejectReconciliationMatch);
  const qc = useQueryClient();

  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["admin", "reconciliation"],
    queryFn: () => analyzeFn({ data: {} as any }),
    refetchOnWindowFocus: false,
  });

  const applyMut = useMutation({
    mutationFn: (vars: { c: Candidate; markPaid: boolean }) =>
      applyFn({
        data: {
          paymentId: vars.c.paymentId,
          invoiceId: vars.c.invoiceId,
          markPaid: vars.markPaid,
          confidence: vars.c.confidence,
          reasons: vars.c.reasons,
          checklist: vars.c.checklist,
        },
      }),
    onSuccess: () => {
      toast.success("Match approved");
      qc.invalidateQueries({ queryKey: ["admin", "reconciliation"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to apply match"),
  });

  const rejectMut = useMutation({
    mutationFn: (c: Candidate) =>
      rejectFn({
        data: { paymentId: c.paymentId, invoiceId: c.invoiceId, confidence: c.confidence },
      }),
    onSuccess: () => {
      toast.success("Match rejected");
      qc.invalidateQueries({ queryKey: ["admin", "reconciliation"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to reject"),
  });

  const candidates: Candidate[] = (data?.candidates as any) ?? [];

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Sparkles className="text-primary" size={22} />
            AI Invoice Reconciliation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Matches recent payments to open invoices and flags low-confidence pairs for human review. No changes are made until you approve.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isFetching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {isFetching ? "Analyzing…" : "Re-run analysis"}
        </button>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {(error as any)?.message || "Failed to load reconciliation analysis."}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Stat label="Unmatched payments (90d)" value={String(data.unmatchedPaymentCount ?? 0)} />
          <Stat label="Open invoices" value={String(data.openInvoiceCount ?? 0)} />
          <Stat label="Candidate matches" value={String(candidates.length)} />
        </div>
      )}

      {isFetching && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Running analysis…
        </div>
      )}

      {data && candidates.length === 0 && !isFetching && (
        <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
          No candidate matches found. Either everything is already reconciled, or no unmatched payments resemble open invoices.
        </div>
      )}

      <div className="space-y-4">
        {candidates.map((c) => (
          <article
            key={`${c.paymentId}::${c.invoiceId}`}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <ConfidenceBadge value={c.confidence} verdict={c.verdict} />
                {!c.aiUsed && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
                    <AlertTriangle size={12} /> heuristic only
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={applyMut.isPending || rejectMut.isPending}
                  onClick={() => applyMut.mutate({ c, markPaid: false })}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-surface-elevated disabled:opacity-50"
                  title="Link payment to invoice without marking paid"
                >
                  <Check size={12} /> Link only
                </button>
                <button
                  disabled={applyMut.isPending || rejectMut.isPending}
                  onClick={() => applyMut.mutate({ c, markPaid: true })}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  <Check size={12} /> Approve & mark paid
                </button>
                <button
                  disabled={applyMut.isPending || rejectMut.isPending}
                  onClick={() => rejectMut.mutate(c)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                >
                  <X size={12} /> Reject
                </button>
              </div>
            </div>

            <p className="mt-3 text-sm text-foreground">{c.summary}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <PaneCard
                title="Payment"
                icon={<ReceiptText size={14} />}
                rows={[
                  ["Amount", money(c.payment.amount, c.payment.currency)],
                  ["Mode", String(c.payment.mode ?? "—")],
                  ["Txn id", c.payment.transaction_id || "—"],
                  ["Paid at", c.payment.paid_at ? new Date(c.payment.paid_at).toLocaleString() : "—"],
                  ["Remarks", c.payment.remarks || "—"],
                ]}
              />
              <PaneCard
                title="Invoice"
                icon={<ReceiptText size={14} />}
                rows={[
                  ["Number", c.invoice.invoice_number],
                  ["Total", money(c.invoice.total, c.invoice.currency)],
                  ["Status", String(c.invoice.status)],
                  ["Learner", c.invoice.learner_name || c.invoice.learner_email || "—"],
                  ["Due", c.invoice.due_date || "—"],
                ]}
              />
            </div>

            {c.reasons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.reasons.map((r, i) => (
                  <span key={i} className="rounded-md border border-border bg-muted/20 px-2 py-0.5 text-xs text-muted-foreground">
                    {r}
                  </span>
                ))}
              </div>
            )}

            {c.checklist.length > 0 && (
              <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
                  <ListChecks size={14} /> Human-review checklist
                </div>
                <ul className="mt-2 space-y-1 pl-5 text-sm text-amber-100/90 list-disc">
                  {c.checklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function PaneCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon} {title}
      </div>
      <dl className="grid grid-cols-3 gap-x-2 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <ConcatRow key={k} k={k} v={v} />
        ))}
      </dl>
    </div>
  );
}

function ConcatRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="col-span-1 text-xs text-muted-foreground">{k}</dt>
      <dd className="col-span-2 truncate text-sm">{v}</dd>
    </>
  );
}
