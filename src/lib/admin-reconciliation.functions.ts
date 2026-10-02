// AI-assisted invoice reconciliation.
// - analyzeReconciliation: read-only; pulls unmatched payments + open invoices,
//   builds heuristic candidate matches, calls the AI to score confidence and
//   produce a human-review checklist when confidence is low. NO mutations.
// - applyReconciliationMatch: write; only called when a user clicks Approve.
// - rejectReconciliationMatch: logs a rejection (no DB mutation to invoice/payment).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateObject } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const WRITE_ROLES = ["admin", "finance_admin"];
const READ_ROLES = ["admin", "finance_admin", "support_admin"];

async function assertRoles(context: any, allowed: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: roles }, { data: superRow }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
    supabaseAdmin.from("super_admins").select("user_id").eq("user_id", context.userId).maybeSingle(),
  ]);
  if (superRow) return;
  const userRoles = (roles ?? []).map((r: any) => String(r.role));
  if (!userRoles.some((r) => allowed.includes(r))) {
    throw new Error("Forbidden");
  }
}

type Candidate = {
  paymentId: string;
  invoiceId: string;
  reasons: string[];
  heuristicScore: number; // 0..100
  payment: any;
  invoice: any;
};

function buildHeuristicCandidates(payments: any[], invoices: any[]): Candidate[] {
  const out: Candidate[] = [];
  for (const p of payments) {
    const pAmt = Number(p.amount ?? 0);
    const pCur = String(p.currency ?? "");
    const pLearner = String(p.learner_id ?? "");
    for (const inv of invoices) {
      if (inv.status === "paid" || inv.status === "cancelled") continue;
      const iAmt = Number(inv.total ?? 0);
      const iCur = String(inv.currency ?? "");
      const iLearner = String(inv.learner_id ?? "");

      const reasons: string[] = [];
      let score = 0;
      if (pLearner && pLearner === iLearner) {
        score += 50;
        reasons.push("Same learner");
      }
      if (pCur && pCur === iCur) {
        score += 10;
        reasons.push(`Currency matches (${pCur})`);
      } else if (pCur && iCur) {
        reasons.push(`Currency mismatch (${pCur} vs ${iCur})`);
      }
      const diff = Math.abs(pAmt - iAmt);
      const pct = iAmt > 0 ? diff / iAmt : 1;
      if (diff < 0.01) {
        score += 30;
        reasons.push("Amount matches exactly");
      } else if (pct <= 0.02) {
        score += 20;
        reasons.push(`Amount within 2% (Δ ${diff.toFixed(2)})`);
      } else if (pct <= 0.1) {
        score += 5;
        reasons.push(`Amount within 10% (Δ ${diff.toFixed(2)})`);
      } else {
        reasons.push(`Amount mismatch (Δ ${diff.toFixed(2)})`);
      }
      if (p.transaction_id && inv.invoice_number && String(p.transaction_id).includes(String(inv.invoice_number))) {
        score += 15;
        reasons.push("Transaction id references invoice number");
      }
      // Only surface if at least same learner OR amount close + currency
      if (score >= 35) {
        out.push({
          paymentId: p.id,
          invoiceId: inv.id,
          reasons,
          heuristicScore: Math.min(100, score),
          payment: p,
          invoice: inv,
        });
      }
    }
  }
  // Sort: highest score first; cap fanout per payment to top 3
  out.sort((a, b) => b.heuristicScore - a.heuristicScore);
  const perPayment: Record<string, number> = {};
  return out.filter((c) => {
    perPayment[c.paymentId] = (perPayment[c.paymentId] ?? 0) + 1;
    return perPayment[c.paymentId] <= 3;
  });
}

const AiSchema = z.object({
  matches: z.array(
    z.object({
      paymentId: z.string(),
      invoiceId: z.string(),
      confidence: z.number().min(0).max(100),
      verdict: z.enum(["likely", "uncertain", "unlikely"]),
      summary: z.string().max(280),
      checklist: z.array(z.string().max(160)).max(6),
    }),
  ),
});

export const analyzeReconciliation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRoles(context, READ_ROLES);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sinceISO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: payments }, { data: invoices }, { data: decisions }] = await Promise.all([
      supabaseAdmin
        .from("payments")
        .select("id, invoice_id, learner_id, amount, currency, mode, status, transaction_id, paid_at, remarks")
        .gte("paid_at", sinceISO)
        .eq("status", "success")
        .order("paid_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("invoices")
        .select("id, invoice_number, learner_id, learner_name, learner_email, total, currency, status, issue_date, due_date")
        .in("status", ["sent", "overdue", "draft"])
        .order("issue_date", { ascending: false })
        .limit(400),
      supabaseAdmin
        .from("invoice_reconciliation_decisions")
        .select("payment_id, invoice_id, action")
        .gte("created_at", sinceISO),
    ]);

    // Exclude payments already linked to an invoice and already-decided pairs.
    const decided = new Set(
      (decisions ?? []).map((d: any) => `${d.payment_id}::${d.invoice_id}`),
    );
    const unmatchedPayments = (payments ?? []).filter((p: any) => !p.invoice_id);

    const candidates = buildHeuristicCandidates(unmatchedPayments, invoices ?? []).filter(
      (c) => !decided.has(`${c.paymentId}::${c.invoiceId}`),
    );

    if (candidates.length === 0) {
      return {
        candidates: [],
        unmatchedPaymentCount: unmatchedPayments.length,
        openInvoiceCount: (invoices ?? []).length,
        generatedAt: new Date().toISOString(),
      };
    }

    // Cap what we send to the model.
    const top = candidates.slice(0, 25);
    const apiKey = process.env.LOVABLE_API_KEY;
    let aiByKey: Record<string, z.infer<typeof AiSchema>["matches"][number]> = {};

    if (apiKey) {
      try {
        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway("google/gemini-3-flash-preview");
        const compact = top.map((c) => ({
          paymentId: c.paymentId,
          invoiceId: c.invoiceId,
          heuristicScore: c.heuristicScore,
          reasons: c.reasons,
          payment: {
            amount: c.payment.amount,
            currency: c.payment.currency,
            mode: c.payment.mode,
            transaction_id: c.payment.transaction_id,
            paid_at: c.payment.paid_at,
            remarks: c.payment.remarks,
          },
          invoice: {
            invoice_number: c.invoice.invoice_number,
            total: c.invoice.total,
            currency: c.invoice.currency,
            status: c.invoice.status,
            issue_date: c.invoice.issue_date,
            due_date: c.invoice.due_date,
            learner_name: c.invoice.learner_name,
            learner_email: c.invoice.learner_email,
          },
        }));

        const { object } = await generateObject({
          model,
          schema: AiSchema,
          system:
            "You are a finance reconciliation assistant. For each candidate payment↔invoice pair, judge if the payment settles that invoice. Respond with a confidence 0-100, a verdict, a one-sentence summary, and (for confidence < 80) a short human-review checklist of what to verify before approving. Never fabricate fields.",
          prompt: `Candidate pairs (JSON):\n${JSON.stringify(compact)}`,
        });
        for (const m of object.matches) {
          aiByKey[`${m.paymentId}::${m.invoiceId}`] = m;
        }
      } catch (e) {
        // fall back to heuristic-only
        aiByKey = {};
      }
    }

    const enriched = top.map((c) => {
      const ai = aiByKey[`${c.paymentId}::${c.invoiceId}`];
      const confidence = ai?.confidence ?? c.heuristicScore;
      const verdict: "likely" | "uncertain" | "unlikely" =
        ai?.verdict ?? (confidence >= 80 ? "likely" : confidence >= 50 ? "uncertain" : "unlikely");
      const checklist =
        ai?.checklist ??
        (confidence < 80
          ? [
              "Confirm the learner matches on both records",
              "Verify amount and currency",
              "Cross-check the payment transaction id with the bank statement",
            ]
          : []);
      return {
        paymentId: c.paymentId,
        invoiceId: c.invoiceId,
        confidence: +confidence.toFixed(1),
        verdict,
        summary: ai?.summary ?? c.reasons.join("; "),
        reasons: c.reasons,
        checklist,
        payment: c.payment,
        invoice: c.invoice,
        aiUsed: !!ai,
      };
    });

    return {
      candidates: enriched,
      unmatchedPaymentCount: unmatchedPayments.length,
      openInvoiceCount: (invoices ?? []).length,
      generatedAt: new Date().toISOString(),
    };
  });

export const applyReconciliationMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; invoiceId: string; markPaid: boolean; confidence?: number; reasons?: string[]; checklist?: string[]; notes?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertRoles(context, WRITE_ROLES);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: payErr } = await supabaseAdmin
      .from("payments")
      .update({ invoice_id: data.invoiceId })
      .eq("id", data.paymentId);
    if (payErr) throw new Error(payErr.message);

    if (data.markPaid) {
      const { error: invErr } = await supabaseAdmin
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", data.invoiceId);
      if (invErr) throw new Error(invErr.message);
    }

    await supabaseAdmin.from("invoice_reconciliation_decisions").insert({
      payment_id: data.paymentId,
      invoice_id: data.invoiceId,
      action: "approved",
      confidence: data.confidence ?? null,
      marked_paid: data.markPaid,
      reasons: data.reasons ?? [],
      checklist: data.checklist ?? [],
      notes: data.notes ?? null,
      decided_by: context.userId,
    });

    try {
      const { logInvoiceAction } = await import("@/lib/invoice-audit.server");
      await logInvoiceAction({
        invoiceId: data.invoiceId,
        actorId: context.userId,
        action: "regenerate",
        metadata: { via: "ai_reconciliation", paymentId: data.paymentId, markedPaid: data.markPaid },
      });
    } catch { /* best-effort */ }

    return { ok: true };
  });

export const rejectReconciliationMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; invoiceId: string; reason?: string; confidence?: number }) => input)
  .handler(async ({ data, context }) => {
    await assertRoles(context, WRITE_ROLES);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("invoice_reconciliation_decisions").insert({
      payment_id: data.paymentId,
      invoice_id: data.invoiceId,
      action: "rejected",
      confidence: data.confidence ?? null,
      notes: data.reason ?? null,
      decided_by: context.userId,
    });
    return { ok: true };
  });
