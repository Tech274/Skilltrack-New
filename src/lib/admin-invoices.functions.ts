import { requireAdmin } from "@/lib/admin-auth.server";
import { recordAdminAudit, snapshotRow } from "@/lib/admin-audit.server";
import { isSuperAdminUser } from "@/lib/super-admin.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { formatInvoiceAmount, formatInvoiceAmountPdf, INVOICE_CURRENCY_CODES } from "@/lib/invoice-currency";

const FINANCE_ROLES = ["admin", "finance_admin"] as const;
const READ_ROLES = ["admin", "finance_admin", "support_admin"] as const;

async function assertFinanceRead(supabase: any, userId: string) {
  const [{ data: roles }, { data: u }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    (async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      return supabaseAdmin.auth.admin.getUserById(userId);
    })(),
  ]);
  const email = (u?.user?.email ?? "").toLowerCase();
  const isSuper = await isSuperAdminUser(userId);
  const list = (roles ?? []).map((r: any) => r.role);
  if (!isSuper && !list.some((r: string) => READ_ROLES.includes(r as any))) {
    throw new Error("Forbidden: finance role required");
  }
  return { isSuper, roles: list };
}

async function assertFinanceWrite(supabase: any, userId: string) {
  const { isSuper, roles } = await assertFinanceRead(supabase, userId);
  if (!isSuper && !roles.some((r: string) => FINANCE_ROLES.includes(r as any))) {
    throw new Error("Forbidden: finance write permission required");
  }
}

/* -------------------------------------------------------------------------- */
/* INVOICES                                                                    */
/* -------------------------------------------------------------------------- */

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      status: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(100),
    }).partial().optional(),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, learner_id, learner_email, learner_name, description, plan_key, amount, discount, tax, total, currency, status, issue_date, due_date, paid_at, created_at, email_status, email_last_sent_at, email_last_error")
      .order("issue_date", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.status && data.status !== "all") q = q.eq("status", data.status);
    if (data?.search) {
      const s = `%${data.search}%`;
      q = q.or(`invoice_number.ilike.${s},learner_email.ilike.${s},learner_name.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin.from("invoices").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invoice not found");
    const { data: pays } = await supabaseAdmin
      .from("payments")
      .select("id, amount, currency, mode, status, transaction_id, paid_at, remarks")
      .eq("invoice_id", data.id)
      .order("paid_at", { ascending: false });
    return { invoice: inv, payments: pays ?? [] };
  });

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      learnerId: z.string().uuid(),
      learnerEmail: z.string().email().optional(),
      learnerName: z.string().max(200).optional(),
      description: z.string().max(500).optional(),
      planKey: z.string().max(60).optional(),
      certificationSlug: z.string().max(120).optional(),
      amount: z.number().min(0),
      discount: z.number().min(0).default(0),
      tax: z.number().min(0).default(0),
      currency: z.enum(INVOICE_CURRENCY_CODES).default("INR"),
      dueDate: z.string().optional(),
      billingAddress: z.string().max(500).optional(),
      taxNumber: z.string().max(60).optional(),
      status: z.enum(["draft", "sent"]).default("draft"),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Server-side voucher validation. Shared with the client form + unit-tested
    // in src/lib/invoice-validation.test.ts. Must run BEFORE the insert so we
    // never persist (or render a PDF for) a mismatched voucher invoice.
    if (data.certificationSlug) {
      const { data: cat, error: catErr } = await supabaseAdmin
        .from("certifications_catalog")
        .select("slug, name, code, status, cost_usd")
        .eq("slug", data.certificationSlug)
        .maybeSingle();
      if (catErr) throw new Error(catErr.message);
      const { validateVoucher } = await import("@/lib/invoice-validation");
      const result = validateVoucher(cat as any, Number(data.amount));
      if (!result.ok) throw new Error(result.message);
    }

    if (data.currency !== "INR") data.tax = 0; // GST applies to INR only
    const total = Math.max(0, Number(data.amount) - Number(data.discount) + Number(data.tax));
    const { data: row, error } = await supabaseAdmin
      .from("invoices")
      .insert({
        learner_id: data.learnerId,
        learner_email: data.learnerEmail ?? null,
        learner_name: data.learnerName ?? null,
        description: data.description ?? null,
        plan_key: data.planKey ?? null,
        certification_slug: data.certificationSlug ?? null,
        amount: data.amount,
        discount: data.discount,
        tax: data.tax,
        total,
        currency: data.currency,
        due_date: data.dueDate ?? null,
        billing_address: data.billingAddress ?? null,
        tax_number: data.taxNumber ?? null,
        status: data.status,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await recordAdminAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "invoice.create",
      targetTable: "invoices",
      targetId: row.id,
      summary: row.invoice_number,
      after: { status: row.status, total: row.total, currency: row.currency },
    });

    // In-app notifications: learner + admins
    try {
      const { notify, getAdminRecipientIds } = await import("@/lib/admin-notify.server");
      const adminIds = await getAdminRecipientIds();
      const title = `Invoice ${row.invoice_number} generated`;
      const body = `${formatInvoiceAmount(row.total, row.currency)} — ${data.description ?? "Subscription/Service"}`;
      await notify([
        { recipientId: data.learnerId, audience: "learner", category: "invoice_generated", title, body, link: "/dashboard", metadata: { invoice_id: row.id } },
        ...adminIds.map((id) => ({ recipientId: id, audience: "admin" as const, category: "invoice_generated", title: `New invoice ${row.invoice_number}`, body, link: `/admin/invoices/${row.id}`, metadata: { invoice_id: row.id } })),
      ]);
    } catch { /* notifications are best-effort */ }

    return row;
  });

export const updateInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["draft","sent","paid","overdue","cancelled"]) }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = await snapshotRow(supabaseAdmin, "invoices", data.id, "id, invoice_number, status");
    const patch: any = { status: data.status };
    if (data.status === "paid") patch.paid_at = new Date().toISOString();
    if (data.status !== "paid") patch.paid_at = null;
    const { error } = await supabaseAdmin.from("invoices").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordAdminAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "invoice.status",
      targetTable: "invoices",
      targetId: data.id,
      summary: typeof before?.invoice_number === "string" ? `${before.invoice_number} → ${data.status}` : data.status,
      before,
      after: { status: data.status },
    });
    return { ok: true };
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = await snapshotRow(supabaseAdmin, "invoices", data.id, "id, invoice_number, status, total, currency");
    const { error } = await supabaseAdmin.from("invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordAdminAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "invoice.delete",
      targetTable: "invoices",
      targetId: data.id,
      summary: typeof before?.invoice_number === "string" ? before.invoice_number : null,
      before,
    });
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/* PDF GENERATION (pdf-lib, Worker-safe)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Build the invoice line items + totals strictly from the persisted invoice
 * record. Used by both PDF generation and email so the rendered amounts are
 * guaranteed to match what's stored in the database — never recomputed from
 * client input.
 */
function buildInvoiceSnapshot(inv: any, cert: { name: string; code: string | null; vendor: string | null } | null) {
  const amount = Number(inv.amount ?? 0);
  const discount = Number(inv.discount ?? 0);
  const tax = Number(inv.tax ?? 0);
  const storedTotal = Number(inv.total ?? 0);
  const expectedTotal = Math.max(0, +(amount - discount + tax).toFixed(2));

  // STRICT validation: refuse to render a PDF whose totals don't reconcile
  // with the persisted invoice. Mismatch implies tampering or a stale row.
  if (Math.abs(expectedTotal - +storedTotal.toFixed(2)) > 0.01) {
    throw new Error(
      `Invoice ${inv.invoice_number}: stored total (${storedTotal.toFixed(2)}) does not match subtotal - discount + tax (${expectedTotal.toFixed(2)}). Refusing to issue PDF.`,
    );
  }

  const baseDesc =
    inv.description ||
    (cert ? `${cert.vendor ?? ""} Exam Voucher ${cert.code ?? ""} ${cert.name}`.trim() : "Service");

  const qty = 1;
  const unitPrice = amount;
  const lineTotal = +(qty * unitPrice).toFixed(2);

  if (Math.abs(lineTotal - amount) > 0.01) {
    throw new Error(`Invoice ${inv.invoice_number}: line total (${lineTotal}) does not match subtotal (${amount}).`);
  }

  return {
    items: [{ description: baseDesc, qty, unitPrice, lineTotal }],
    subtotal: amount,
    discount,
    tax,
    grandTotal: storedTotal,
    currency: String(inv.currency || "INR"),
  };
}

async function renderInvoicePdfBytes(invoiceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: inv, error } = await supabaseAdmin.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!inv) throw new Error("Invoice not found");
  const { data: pays } = await supabaseAdmin
    .from("payments")
    .select("amount, mode, status, paid_at, transaction_id")
    .eq("invoice_id", invoiceId)
    .eq("status", "success")
    .order("paid_at", { ascending: true });

  let cert: { name: string; code: string | null; vendor: string | null } | null = null;
  if (inv.certification_slug) {
    const { data: c } = await supabaseAdmin
      .from("certifications_catalog")
      .select("name, code, vendor")
      .eq("slug", inv.certification_slug)
      .maybeSingle();
    if (c) cert = c as any;
  }

  const snapshot = buildInvoiceSnapshot(inv, cert);

  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.12, 0.13, 0.18);
  const muted = rgb(0.45, 0.48, 0.55);
  const accent = rgb(0.07, 0.16, 0.36);
  const line = rgb(0.85, 0.87, 0.92);

  const embedLogo = async () => {
    const mod = await import("@/lib/brand-logo");
    const b64 = (mod as any).BRAND_LOGO_PNG_BASE64 as string;
    if (!b64) throw new Error("Brand logo base64 missing");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return pdf.embedPng(bytes);
  };
  let logoImage: any = null;
  try { logoImage = await embedLogo(); }
  catch (e1) {
    console.warn("[generateInvoicePdf] logo embed attempt 1 failed, retrying", e1);
    try { logoImage = await embedLogo(); } catch (e2) { console.error("[generateInvoicePdf] logo embed retry failed", e2); }
  }

  const draw = (t: string, x: number, y: number, opts: any = {}) =>
    page.drawText(String(t ?? ""), { x, y, size: opts.size ?? 10, font: opts.bold ? bold : font, color: opts.color ?? ink });

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }); }
    catch { return String(d); }
  };

  draw("INVOICE", 40, 800, { size: 26, bold: true, color: accent });
  draw(`Invoice No.: ${inv.invoice_number}`, 40, 778, { size: 10, color: muted });
  draw(`Invoice Date: ${fmtDate(String(inv.issue_date))}`, 40, 764, { size: 10, color: muted });

  if (logoImage) {
    const logoH = 48;
    const logoW = (logoImage.width / logoImage.height) * logoH;
    page.drawImage(logoImage, { x: 555 - logoW, y: 770, width: logoW, height: logoH });
    draw("LEARN  GROW  SUCCEED", 555 - logoW, 760, { size: 7, color: muted });
  } else {
    draw("Skilltrack-365", 555 - 110, 800, { size: 14, bold: true, color: accent });
    draw("LEARN  GROW  SUCCEED", 555 - 110, 786, { size: 7, color: muted });
  }

  page.drawLine({ start: { x: 40, y: 748 }, end: { x: 555, y: 748 }, thickness: 0.6, color: line });

  let y = 732;
  draw("FROM", 40, y, { size: 9, bold: true, color: muted });
  draw("Skilltrack-365", 40, y - 14, { size: 12, bold: true });
  draw("#16, Krishna Garden Main Road, Mylasandra,", 40, y - 28, { size: 9, color: muted });
  draw("Bangalore - 560060", 40, y - 40, { size: 9, color: muted });
  draw("www.skilltrack.co.in  |  info@skilltrack.co.in", 40, y - 52, { size: 9, color: muted });

  y = 660;
  const billX = 40;
  const shipX = 310;
  draw("BILL TO", billX, y, { size: 9, bold: true, color: muted });
  draw("SHIP TO", shipX, y, { size: 9, bold: true, color: muted });
  page.drawLine({ start: { x: billX, y: y - 4 }, end: { x: 555, y: y - 4 }, thickness: 0.4, color: line });

  const addrLines = inv.billing_address
    ? String(inv.billing_address).split(/\n/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
    : [];
  const name = inv.learner_name || "Learner";

  draw(name, billX, y - 18, { size: 11, bold: true });
  draw(name, shipX, y - 18, { size: 11, bold: true });
  addrLines.forEach((l, i) => {
    draw(l, billX, y - 32 - i * 12, { size: 9, color: muted });
    draw(l, shipX, y - 32 - i * 12, { size: 9, color: muted });
  });
  if (inv.learner_email) {
    const ey = y - 32 - addrLines.length * 12;
    draw(inv.learner_email, billX, ey, { size: 9, color: muted });
  }

  y = 560;
  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 20, color: rgb(0.95, 0.96, 0.99) });
  draw("CANDIDATE DETAILS", 50, y + 4, { size: 10, bold: true, color: accent });
  y -= 22;
  const row = (label: string, value: string) => {
    draw(label, 50, y, { size: 9, color: muted });
    draw(value, 220, y, { size: 10 });
    page.drawLine({ start: { x: 40, y: y - 6 }, end: { x: 555, y: y - 6 }, thickness: 0.3, color: line });
    y -= 18;
  };
  row("Candidate Name:", name);
  if (inv.tax_number) row("Candidate ID:", inv.tax_number);
  if (cert) {
    row("Examination:", `${cert.code ? cert.code + " " : ""}${cert.name}`);
    row("Certification Body:", cert.vendor || "—");
  }

  y -= 8;
  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 20, color: rgb(0.95, 0.96, 0.99) });
  draw("PURCHASE DETAILS", 50, y + 4, { size: 10, bold: true, color: accent });
  y -= 22;
  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 20, color: accent });
  const white = rgb(1, 1, 1);
  draw("#", 50, y + 4, { size: 9, bold: true, color: white });
  draw("Description", 80, y + 4, { size: 9, bold: true, color: white });
  draw("Qty", 360, y + 4, { size: 9, bold: true, color: white });
  draw(`Unit Price (${snapshot.currency})`, 400, y + 4, { size: 9, bold: true, color: white });
  draw(`Total (${snapshot.currency})`, 490, y + 4, { size: 9, bold: true, color: white });
  y -= 24;

  const fm = (n: unknown) => formatInvoiceAmountPdf(n, snapshot.currency);
  snapshot.items.forEach((it, idx) => {
    const d1 = it.description.slice(0, 60);
    const d2 = it.description.length > 60 ? it.description.slice(60, 120) : (inv.tax_number ? `Candidate ID: ${inv.tax_number}` : "");
    draw(String(idx + 1), 50, y, { size: 10 });
    draw(d1, 80, y, { size: 10 });
    if (d2) draw(d2, 80, y - 12, { size: 9, color: muted });
    draw(String(it.qty), 365, y, { size: 10 });
    draw(fm(it.unitPrice), 400, y, { size: 10 });
    draw(fm(it.lineTotal), 490, y, { size: 10 });
    y -= 28;
  });
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.4, color: line });

  y -= 18;
  const labelCol = 380;
  const rightCol = 490;
  draw("Subtotal", labelCol, y, { size: 10, color: muted });
  draw(fm(snapshot.subtotal), rightCol, y, { size: 10 });
  if (snapshot.discount > 0) {
    y -= 14;
    draw("Discount", labelCol, y, { size: 10, color: muted });
    draw(`- ${fm(snapshot.discount)}`, rightCol, y, { size: 10 });
  }
  if (snapshot.tax > 0 && snapshot.currency === "INR") {
    y -= 14;
    draw("GST", labelCol, y, { size: 10, color: muted });
    draw(fm(snapshot.tax), rightCol, y, { size: 10 });
  }
  y -= 18;
  page.drawRectangle({ x: labelCol - 10, y: y - 8, width: 175, height: 22, color: accent });
  draw("TOTAL", labelCol, y - 2, { size: 12, bold: true, color: white });
  draw(fm(snapshot.grandTotal), rightCol, y - 2, { size: 12, bold: true, color: white });

  if ((pays ?? []).length > 0) {
    y -= 44;
    draw("PAYMENTS RECEIVED", 40, y, { size: 10, bold: true, color: accent });
    y -= 14;
    page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 18, color: rgb(0.96, 0.98, 0.96) });
    draw("Date", 50, y + 2, { size: 9, bold: true });
    draw("Mode", 200, y + 2, { size: 9, bold: true });
    draw("Reference", 300, y + 2, { size: 9, bold: true });
    draw("Amount", 490, y + 2, { size: 9, bold: true });
    for (const p of pays ?? []) {
      y -= 16;
      draw(new Date(p.paid_at).toLocaleDateString(), 50, y, { size: 9 });
      draw(p.mode, 200, y, { size: 9 });
      draw(p.transaction_id || "—", 300, y, { size: 9 });
      draw(fm(p.amount), 490, y, { size: 9 });
    }
  }

  draw("NOTES", 40, 120, { size: 9, bold: true, color: muted });
  const noteText = cert
    ? `Amount shown in ${snapshot.currency}. This invoice covers one ${cert.vendor ?? ""} certification exam voucher${cert.code ? ` (${cert.code})` : ""}.`
    : `Amount shown in ${snapshot.currency}.`;
  draw(noteText.slice(0, 110), 40, 106, { size: 9, color: muted });

  page.drawLine({ start: { x: 40, y: 78 }, end: { x: 555, y: 78 }, thickness: 0.6, color: line });
  draw("Thank you for learning with Skilltrack-365!", 40, 60, { size: 11, bold: true, color: accent });
  draw("#16, Krishna Garden Main Road, Mylasandra, Bangalore - 560060  •  www.skilltrack.co.in  •  info@skilltrack.co.in", 40, 46, { size: 8, color: muted });

  const bytes = await pdf.save();

  // Post-render content assertions: the PDF must include the canonical fields
  // (invoice number, currency totals, line items). pdf-lib doesn't extract
  // text, so we re-assert against the validated snapshot — the same source
  // we drew from — and against required invoice metadata.
  const requiredText: Array<[string, string | undefined]> = [
    ["invoice_number", inv.invoice_number],
    ["issue_date", inv.issue_date ? String(inv.issue_date) : undefined],
  ];
  for (const [field, value] of requiredText) {
    if (!value || !String(value).trim()) {
      throw new Error(`Invoice PDF missing required field: ${field}`);
    }
  }
  if (!snapshot.items.length) throw new Error("Invoice PDF missing line items");
  for (const it of snapshot.items) {
    if (!it.description?.trim()) throw new Error("Invoice PDF has a line item without a description");
    if (!(it.qty > 0)) throw new Error("Invoice PDF has a line item with non-positive quantity");
    if (!(it.unitPrice >= 0)) throw new Error("Invoice PDF has an invalid unit price");
  }
  if (!(snapshot.grandTotal >= 0)) throw new Error("Invoice PDF has an invalid grand total");
  if (bytes.byteLength < 1024) throw new Error("Invoice PDF render produced an empty document");

  return { bytes, invoice: inv, snapshot };
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export const generateInvoicePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    /** Distinguishes a passive view (preview) from an explicit download for the audit log. */
    intent: z.enum(["view", "download", "regenerate"]).default("download"),
  }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceRead(context.supabase, context.userId);
    const { bytes, invoice, snapshot } = await renderInvoicePdfBytes(data.id);
    const { logInvoiceAction } = await import("@/lib/invoice-audit.server");
    await logInvoiceAction({
      invoiceId: invoice.id,
      actorId: context.userId,
      action: data.intent,
      metadata: { invoice_number: invoice.invoice_number, bytes: bytes.byteLength },
    });
    return {
      filename: `${invoice.invoice_number}.pdf`,
      base64: bytesToBase64(bytes),
      snapshot, // exposes the validated totals/line items the PDF was built from
    };
  });

/* -------------------------------------------------------------------------- */
/* EMAIL INVOICE PDF                                                           */
/* -------------------------------------------------------------------------- */

export const emailInvoicePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      to: z.string().email().optional(),
      message: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceWrite(context.supabase, context.userId);
    return sendOneInvoiceEmail({
      invoiceId: data.id,
      to: data.to,
      message: data.message,
      actorId: context.userId,
    });
  });

export const bulkEmailInvoicePdfs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(50),
      message: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceWrite(context.supabase, context.userId);
    const results: Array<{ id: string; ok: boolean; to?: string; error?: string }> = [];
    for (const id of data.ids) {
      try {
        const r = await sendOneInvoiceEmail({
          invoiceId: id,
          message: data.message,
          actorId: context.userId,
        });
        results.push({ id, ok: true, to: r.to });
      } catch (e: any) {
        results.push({ id, ok: false, error: e?.message ?? "Send failed" });
      }
    }
    return {
      total: data.ids.length,
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  });

export const listInvoiceEmailAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      invoiceId: z.string().uuid().optional(),
      recipient: z.string().max(160).optional(),
      invoiceNumber: z.string().max(60).optional(),
      status: z.enum(["queued", "sent", "failed"]).optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
    }).partial().optional(),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("invoice_email_audit")
      .select("id, invoice_id, invoice_number, actor_id, actor_email, recipient_email, status, provider_message_id, error_message, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.invoiceId) q = q.eq("invoice_id", data.invoiceId);
    if (data?.status) q = q.eq("status", data.status);
    if (data?.recipient) q = q.ilike("recipient_email", `%${data.recipient}%`);
    if (data?.invoiceNumber) q = q.ilike("invoice_number", `%${data.invoiceNumber}%`);
    if (data?.fromDate) q = q.gte("created_at", data.fromDate);
    if (data?.toDate) q = q.lte("created_at", data.toDate);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

async function sendOneInvoiceEmail(opts: {
  invoiceId: string;
  to?: string;
  message?: string;
  actorId: string;
}): Promise<{ ok: true; to: string; filename: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Resolve actor email for audit
  const { data: actor } = await supabaseAdmin.auth.admin.getUserById(opts.actorId);
  const actorEmail = actor?.user?.email ?? null;

  // Render + validate first; if it fails we never log a 'queued' row.
  let bytes: Uint8Array;
  let invoice: any;
  let snapshot: any;
  try {
    const r = await renderInvoicePdfBytes(opts.invoiceId);
    bytes = r.bytes; invoice = r.invoice; snapshot = r.snapshot;
  } catch (e: any) {
    const msg = e?.message ?? "PDF render failed";
    await supabaseAdmin.from("invoices")
      .update({ email_status: "failed", email_last_error: msg })
      .eq("id", opts.invoiceId);
    await supabaseAdmin.from("invoice_email_audit").insert({
      invoice_id: opts.invoiceId,
      invoice_number: null,
      actor_id: opts.actorId,
      actor_email: actorEmail,
      recipient_email: opts.to || "(unknown)",
      status: "failed",
      error_message: msg,
    });
    throw e;
  }

  const recipient = opts.to || invoice.learner_email;
  if (!recipient) {
    const msg = "No billing email on file. Add one or provide a recipient.";
    await supabaseAdmin.from("invoices")
      .update({ email_status: "failed", email_last_error: msg })
      .eq("id", invoice.id);
    await supabaseAdmin.from("invoice_email_audit").insert({
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      actor_id: opts.actorId,
      actor_email: actorEmail,
      recipient_email: "(missing)",
      status: "failed",
      error_message: msg,
    });
    throw new Error(msg);
  }

  // Email sending via Resend has been removed from this project.
  // The invoice PDF is still generated and the action is audited, but no
  // outbound email is dispatched. Wire a new provider here when ready.
  const msg = "Email sending is disabled. The invoice PDF was generated but not emailed.";
  await supabaseAdmin.from("invoices")
    .update({ email_status: "failed", email_last_error: msg })
    .eq("id", invoice.id);
  await supabaseAdmin.from("invoice_email_audit").insert({
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    actor_id: opts.actorId,
    actor_email: actorEmail,
    recipient_email: recipient,
    status: "failed",
    error_message: msg,
  });
  throw new Error(msg);
}

/* -------------------------------------------------------------------------- */
/* PAYMENTS                                                                    */
/* -------------------------------------------------------------------------- */

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      status: z.string().optional(),
      mode: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(100),
    }).partial().optional(),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("payments")
      .select("id, invoice_id, learner_id, amount, currency, mode, status, transaction_id, paid_at, remarks, invoices(invoice_number, learner_email, learner_name)")
      .order("paid_at", { ascending: false })
      .limit(data?.limit ?? 100);
    if (data?.status && data.status !== "all") q = q.eq("status", data.status);
    if (data?.mode && data.mode !== "all") q = q.eq("mode", data.mode);
    if (data?.search) {
      const s = `%${data.search}%`;
      q = q.or(`transaction_id.ilike.${s},remarks.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      invoiceId: z.string().uuid().optional(),
      learnerId: z.string().uuid(),
      amount: z.number().min(0),
      currency: z.string().default("INR"),
      mode: z.enum(["upi", "bank_transfer", "card", "cash", "gateway"]),
      status: z.enum(["pending", "success", "failed", "refunded"]).default("success"),
      transactionId: z.string().max(120).optional(),
      paidAt: z.string().optional(),
      remarks: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay, error } = await supabaseAdmin
      .from("payments")
      .insert({
        invoice_id: data.invoiceId ?? null,
        learner_id: data.learnerId,
        amount: data.amount,
        currency: data.currency,
        mode: data.mode,
        status: data.status,
        transaction_id: data.transactionId ?? null,
        paid_at: data.paidAt ?? new Date().toISOString(),
        remarks: data.remarks ?? null,
        recorded_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await recordAdminAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "payment.record",
      targetTable: "payments",
      targetId: pay.id,
      summary: `${data.mode} ${data.status}`,
      after: { invoice_id: data.invoiceId ?? null, amount: data.amount, currency: data.currency, status: data.status },
    });

    // Auto-mark invoice paid when successful payments cover the total
    if (data.invoiceId && data.status === "success") {
      const { data: inv } = await supabaseAdmin.from("invoices").select("total, status, invoice_number, learner_id").eq("id", data.invoiceId).maybeSingle();
      const { data: sums } = await supabaseAdmin.from("payments").select("amount").eq("invoice_id", data.invoiceId).eq("status", "success");
      const paid = (sums ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      if (inv && paid >= Number(inv.total) && inv.status !== "paid") {
        await supabaseAdmin.from("invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", data.invoiceId);
        try {
          const { notify, getAdminRecipientIds } = await import("@/lib/admin-notify.server");
          const adminIds = await getAdminRecipientIds();
          const title = `Invoice ${inv.invoice_number} fully paid`;
          const body = `${formatInvoiceAmount(paid, data.currency)} received.`;
          await notify([
            { recipientId: data.learnerId, audience: "learner", category: "payment_recorded", title: `Payment received — ${inv.invoice_number}`, body, link: "/dashboard", metadata: { invoice_id: data.invoiceId } },
            ...adminIds.map((id) => ({ recipientId: id, audience: "admin" as const, category: "payment_recorded", title, body, link: `/admin/invoices/${data.invoiceId}`, metadata: { invoice_id: data.invoiceId } })),
          ]);
        } catch { /* best-effort */ }
      }
    }
    return pay;
  });

export const updatePaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["pending", "success", "failed", "refunded"]) }))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceWrite(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = await snapshotRow(supabaseAdmin, "payments", data.id, "id, status, invoice_id, amount, currency");
    const { error } = await supabaseAdmin.from("payments").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await recordAdminAudit(supabaseAdmin, {
      actorId: context.userId,
      action: "payment.status",
      targetTable: "payments",
      targetId: data.id,
      summary: data.status,
      before,
      after: { status: data.status },
    });
    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/* LEARNER PICKER                                                              */
/* -------------------------------------------------------------------------- */

export const searchLearners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ q: z.string().default(""), limit: z.number().min(1).max(50).default(20) }).partial().optional())
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    await assertFinanceRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("profiles").select("id, display_name, avatar_url").limit(data?.limit ?? 20);
    if (data?.q) q = q.ilike("display_name", `%${data.q}%`);
    const { data: profs } = await q;
    // attach emails via auth admin
    const out: Array<{ id: string; display_name: string | null; email: string | null }> = [];
    for (const p of profs ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(p.id);
      out.push({ id: p.id, display_name: p.display_name, email: u?.user?.email ?? null });
    }
    return out;
  });

/* -------------------------------------------------------------------------- */
/* CERTIFICATION VOUCHER OPTIONS (for invoice dropdown)                        */
/* -------------------------------------------------------------------------- */

export const listCertificationOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    await assertFinanceRead(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("certifications_catalog")
      .select("id, slug, name, code, vendor, cost_usd")
      .eq("status", "published")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c: any) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      code: c.code,
      vendor: c.vendor,
      voucher_cost: Number(c.cost_usd ?? 0),
    }));
  });
