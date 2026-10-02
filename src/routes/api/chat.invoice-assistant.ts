import { formatInvoiceAmount } from "@/lib/invoice-currency";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { authenticateRoute, assertAnyRole } from "@/lib/route-auth.server";

const READ_ROLES = ["admin", "finance_admin", "support_admin"] as const;
const WRITE_ROLES = ["admin", "finance_admin"] as const;

const SYSTEM = `You are the SkillTrack-365 Invoice Assistant for finance admins.

You help them find, summarize, and act on invoices via tools. Always:
- Use the searchInvoices tool first to gather facts; never invent invoice numbers, amounts, or statuses.
- Render amounts with their currency code (e.g. "INR 1,250.00").
- Be concise. Prefer compact markdown tables for lists.
- For any mutation (markPaid, sendReminder), confirm intent in plain language before calling the tool, then call it.
- If the user is a support_admin (read-only), refuse write actions politely.

Today is ${new Date().toISOString().slice(0, 10)}.`;

export const Route = createFileRoute("/api/chat/invoice-assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let auth;
        try {
          auth = await authenticateRoute(request);
          assertAnyRole(auth, READ_ROLES);
        } catch (e) {
          if (e instanceof Response) return e;
          return new Response("Unauthorized", { status: 401 });
        }

        const canWrite =
          auth.isSuper || auth.roles.some((r) => WRITE_ROLES.includes(r as any));

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        let body: { messages?: UIMessage[] };
        try {
          body = (await request.json()) as any;
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const messages = body.messages;
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const tools = {
          searchInvoices: tool({
            description:
              "Search invoices. Filter by status, learner name/email substring, currency, minimum/maximum total, and a date range on issue_date. Returns up to 25 matching invoices.",
            inputSchema: z.object({
              status: z
                .enum(["draft", "sent", "paid", "overdue", "cancelled"])
                .optional(),
              search: z.string().max(120).optional(),
              currency: z.string().max(8).optional(),
              minTotal: z.number().nonnegative().optional(),
              maxTotal: z.number().nonnegative().optional(),
              issuedAfter: z.string().optional().describe("ISO date, inclusive"),
              issuedBefore: z.string().optional().describe("ISO date, inclusive"),
              limit: z.number().int().min(1).max(25).default(15),
            }),
            execute: async (args) => {
              let q = supabaseAdmin
                .from("invoices")
                .select(
                  "id, invoice_number, learner_email, learner_name, description, amount, discount, tax, total, currency, status, issue_date, due_date, paid_at, email_status",
                )
                .order("issue_date", { ascending: false })
                .limit(args.limit);
              if (args.status) q = q.eq("status", args.status);
              if (args.currency) q = q.eq("currency", args.currency);
              if (typeof args.minTotal === "number") q = q.gte("total", args.minTotal);
              if (typeof args.maxTotal === "number") q = q.lte("total", args.maxTotal);
              if (args.issuedAfter) q = q.gte("issue_date", args.issuedAfter);
              if (args.issuedBefore) q = q.lte("issue_date", args.issuedBefore);
              if (args.search) {
                const s = `%${args.search}%`;
                q = q.or(
                  `invoice_number.ilike.${s},learner_email.ilike.${s},learner_name.ilike.${s},description.ilike.${s}`,
                );
              }
              const { data, error } = await q;
              if (error) return { error: error.message };
              return { count: data?.length ?? 0, invoices: data ?? [] };
            },
          }),

          getInvoiceDetails: tool({
            description: "Get a single invoice plus its payment history by id.",
            inputSchema: z.object({ id: z.string().uuid() }),
            execute: async ({ id }) => {
              const { data: inv, error } = await supabaseAdmin
                .from("invoices")
                .select("*")
                .eq("id", id)
                .maybeSingle();
              if (error) return { error: error.message };
              if (!inv) return { error: "Invoice not found" };
              const { data: payments } = await supabaseAdmin
                .from("payments")
                .select("id, amount, currency, mode, status, transaction_id, paid_at, remarks")
                .eq("invoice_id", id)
                .order("paid_at", { ascending: false });
              return { invoice: inv, payments: payments ?? [] };
            },
          }),

          financeSummary: tool({
            description:
              "Aggregate totals: count and sum of invoices grouped by status, optionally restricted to a date range and currency.",
            inputSchema: z.object({
              issuedAfter: z.string().optional(),
              issuedBefore: z.string().optional(),
              currency: z.string().max(8).optional(),
            }),
            execute: async (args) => {
              let q = supabaseAdmin
                .from("invoices")
                .select("status, total, currency, issue_date")
                .limit(2000);
              if (args.currency) q = q.eq("currency", args.currency);
              if (args.issuedAfter) q = q.gte("issue_date", args.issuedAfter);
              if (args.issuedBefore) q = q.lte("issue_date", args.issuedBefore);
              const { data, error } = await q;
              if (error) return { error: error.message };
              const buckets: Record<string, { count: number; total: number; currency: string }> = {};
              for (const r of data ?? []) {
                const key = `${r.status}:${r.currency}`;
                buckets[key] ??= { count: 0, total: 0, currency: r.currency };
                buckets[key].count++;
                buckets[key].total += Number(r.total ?? 0);
              }
              const groups = Object.entries(buckets).map(([k, v]) => ({
                status: k.split(":")[0],
                currency: v.currency,
                count: v.count,
                total: +v.total.toFixed(2),
              }));
              return { groups, sampleSize: data?.length ?? 0 };
            },
          }),

          markInvoicePaid: tool({
            description:
              "Mark an invoice as paid. WRITE action — only call after the user confirms in plain language.",
            inputSchema: z.object({ id: z.string().uuid() }),
            execute: async ({ id }) => {
              if (!canWrite) return { error: "Forbidden: read-only role" };
              const { error } = await supabaseAdmin
                .from("invoices")
                .update({ status: "paid", paid_at: new Date().toISOString() })
                .eq("id", id);
              if (error) return { error: error.message };
              try {
                const { logInvoiceAction } = await import("@/lib/invoice-audit.server");
                await logInvoiceAction({
                  invoiceId: id,
                  actorId: auth.userId,
                  action: "regenerate",
                  metadata: { via: "ai_assistant", op: "mark_paid" },
                });
              } catch { /* best-effort */ }
              return { ok: true, id };
            },
          }),

          draftReminderEmail: tool({
            description:
              "Draft (but do not send) a polite payment-reminder email for an invoice. Returns subject + body the user can review before sending.",
            inputSchema: z.object({
              id: z.string().uuid(),
              tone: z.enum(["friendly", "neutral", "firm"]).default("friendly"),
            }),
            execute: async ({ id, tone }) => {
              const { data: inv, error } = await supabaseAdmin
                .from("invoices")
                .select("invoice_number, learner_name, learner_email, total, currency, due_date, status")
                .eq("id", id)
                .maybeSingle();
              if (error) return { error: error.message };
              if (!inv) return { error: "Invoice not found" };
              const greeting =
                tone === "firm"
                  ? "Dear customer,"
                  : `Hi ${inv.learner_name || "there"},`;
              const closing =
                tone === "firm"
                  ? "Please settle the amount at your earliest convenience to avoid further action."
                  : tone === "neutral"
                    ? "Please let us know if you have already paid so we can update our records."
                    : "We just wanted to give you a gentle nudge — thanks so much for your time!";
              const subject = `Reminder: Invoice ${inv.invoice_number} (${formatInvoiceAmount(inv.total, inv.currency)})`;
              const body = [
                greeting,
                "",
                `This is a quick reminder that invoice ${inv.invoice_number} for ${formatInvoiceAmount(inv.total, inv.currency)} is currently marked as "${inv.status}"${inv.due_date ? ` and was due on ${inv.due_date}` : ""}.`,
                "",
                closing,
                "",
                "— SkillTrack-365 Billing",
              ].join("\n");
              return {
                to: inv.learner_email,
                subject,
                body,
                preview: true,
                note: "This is a draft. Ask the user to confirm before calling sendReminderEmail.",
              };
            },
          }),

          // sendReminderEmail intentionally omitted from v1: live email sending is
          // routed through the existing emailInvoicePdf server fn from the UI,
          // which carries audit + retry semantics. The assistant produces the
          // draft, then the user clicks the existing "Send" action.
        };

        const gateway = createLovableAiGatewayProvider(apiKey);
        const model = gateway("google/gemini-3-flash-preview");

        const result = streamText({
          model,
          system: SYSTEM,
          messages: await convertToModelMessages(messages),
          tools,
          stopWhen: stepCountIs(50),
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});
