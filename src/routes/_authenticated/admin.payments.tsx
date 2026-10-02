import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, MoreHorizontal } from "lucide-react";
import { listPayments, updatePaymentStatus, searchLearners } from "@/lib/admin-invoices.functions";
import { RecordPaymentDialog } from "./admin.invoices.$id";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — Admin — SkillTrack-365" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const list = useServerFn(listPayments);
  const setStatus = useServerFn(updatePaymentStatus);
  const qc = useQueryClient();

  const [status, setStatusFilter] = useState("all");
  const [mode, setMode] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "payments", status, mode, search],
    queryFn: () => list({ data: { status, mode, search } }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) => setStatus({ data: { id, status } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "payments"] }); toast.success("Updated"); },
  });

  const totals = rows.reduce(
    (acc: any, r: any) => {
      acc.count++;
      if (r.status === "success") acc.success += Number(r.amount || 0);
      if (r.status === "pending") acc.pending += Number(r.amount || 0);
      if (r.status === "refunded") acc.refunded += Number(r.amount || 0);
      return acc;
    },
    { count: 0, success: 0, pending: 0, refunded: 0 },
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record offline payments and reconcile online transactions.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus size={14} /> Record payment</Button></DialogTrigger>
          <StandalonePaymentDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["admin", "payments"] }); }} />
        </Dialog>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Payments" value={String(totals.count)} />
        <Kpi label="Successful" value={`₹ ${totals.success.toFixed(0)}`} tone="emerald" />
        <Kpi label="Pending" value={`₹ ${totals.pending.toFixed(0)}`} tone="amber" />
        <Kpi label="Refunded" value={`₹ ${totals.refunded.toFixed(0)}`} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference / remarks" className="h-9 w-72 pl-9" />
        </div>
        <Select value={status} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
        <Select value={mode} onValueChange={setMode}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modes</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
            <SelectItem value="bank_transfer">Bank</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="gateway">Gateway</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left">Date</th>
              <th className="px-4 py-2.5 text-left">Invoice</th>
              <th className="px-4 py-2.5 text-left">Learner</th>
              <th className="px-4 py-2.5 text-left">Mode</th>
              <th className="px-4 py-2.5 text-left">Reference</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No payments yet.</td></tr>
            )}
            {rows.map((p: any) => (
              <tr key={p.id} className="border-t border-border/60 hover:bg-surface/40">
                <td className="px-4 py-2.5 text-muted-foreground">{new Date(p.paid_at).toLocaleString()}</td>
                <td className="px-4 py-2.5">
                  {p.invoice_id
                    ? <Link to="/admin/invoices/$id" params={{ id: p.invoice_id }} className="text-primary hover:underline">{p.invoices?.invoice_number || "View"}</Link>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{p.invoices?.learner_name || "—"}</div>
                  <div className="text-xs text-muted-foreground">{p.invoices?.learner_email || ""}</div>
                </td>
                <td className="px-4 py-2.5 uppercase">{p.mode}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{p.transaction_id || "—"}</td>
                <td className="px-4 py-2.5 text-right font-medium">{p.currency} {Number(p.amount).toFixed(2)}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${p.status === "success" ? "bg-emerald-500/10 text-emerald-600" : p.status === "failed" ? "bg-rose-500/10 text-rose-600" : p.status === "refunded" ? "bg-amber-500/10 text-amber-600" : "bg-muted text-muted-foreground"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal size={14} /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {["success", "pending", "failed", "refunded"].filter((s) => s !== p.status).map((s) => (
                        <DropdownMenuItem key={s} onClick={() => statusMut.mutate({ id: p.id, status: s })}>
                          Mark as {s}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "";
  return (
    <div className="rounded-lg border border-border/60 bg-surface/40 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function StandalonePaymentDialog({ onDone }: { onDone: () => void }) {
  const findLearners = useServerFn(searchLearners);
  const [learnerQuery, setLearnerQuery] = useState("");
  const [learner, setLearner] = useState<{ id: string; display_name: string | null; email: string | null } | null>(null);

  const { data: learners = [] } = useQuery({
    queryKey: ["admin", "learner-search", learnerQuery],
    queryFn: () => findLearners({ data: { q: learnerQuery } }),
  });

  if (!learner) {
    return (
      <DialogContent>
        <DialogHeader><DialogTitle>Select learner</DialogTitle></DialogHeader>
        <Label>Search learner</Label>
        <Input value={learnerQuery} onChange={(e) => setLearnerQuery(e.target.value)} placeholder="Name…" />
        <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-border/60">
          {learners.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>}
          {learners.map((l: any) => (
            <button key={l.id} type="button" onClick={() => setLearner(l)} className="block w-full px-3 py-2 text-left text-sm hover:bg-surface">
              <div className="font-medium">{l.display_name || "Unnamed"}</div>
              <div className="text-xs text-muted-foreground">{l.email}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    );
  }

  return <RecordPaymentDialog learnerId={learner.id} currency="INR" onDone={onDone} />;
}
