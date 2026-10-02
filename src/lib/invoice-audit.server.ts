/**
 * Server-only helper for recording invoice actions per enterprise.
 *
 * Every invoice-side action (view, download, resend, regenerate) and every
 * branding event that affects rendered invoices (logo_updated) goes through
 * here so finance admins and org members get a complete audit trail in the
 * `invoice_action_audit` table.
 *
 * Failures are swallowed: an audit write must never block the user action.
 */
export type InvoiceAuditAction =
  | "view"
  | "download"
  | "resend"
  | "regenerate"
  | "logo_updated";

export async function logInvoiceAction(opts: {
  invoiceId?: string | null;
  orgId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: InvoiceAuditAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // If actorEmail wasn't supplied but we have an actorId, resolve it once.
    let actorEmail = opts.actorEmail ?? null;
    if (!actorEmail && opts.actorId) {
      try {
        const { data } = await supabaseAdmin.auth.admin.getUserById(opts.actorId);
        actorEmail = data?.user?.email ?? null;
      } catch {
        /* best-effort */
      }
    }

    // If the invoice belongs to a learner that is a member of an org, fall back
    // to that org when the caller didn't provide one explicitly. Keeps the
    // per-enterprise audit complete even when the caller is a platform admin.
    let orgId = opts.orgId ?? null;
    if (!orgId && opts.invoiceId) {
      try {
        const { data: inv } = await supabaseAdmin
          .from("invoices")
          .select("learner_id")
          .eq("id", opts.invoiceId)
          .maybeSingle();
        if (inv?.learner_id) {
          const { data: mem } = await supabaseAdmin
            .from("organization_members")
            .select("org_id")
            .eq("user_id", inv.learner_id)
            .limit(1)
            .maybeSingle();
          orgId = mem?.org_id ?? null;
        }
      } catch {
        /* best-effort */
      }
    }

    await supabaseAdmin.from("invoice_action_audit").insert({
      invoice_id: opts.invoiceId ?? null,
      org_id: orgId,
      actor_id: opts.actorId ?? null,
      actor_email: actorEmail,
      action: opts.action,
      metadata: (opts.metadata ?? {}) as any,
    });
  } catch (e) {
    console.warn("[invoice-audit] failed to record action", opts.action, e);
  }
}
