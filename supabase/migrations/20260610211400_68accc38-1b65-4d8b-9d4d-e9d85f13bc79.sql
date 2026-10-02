
CREATE TABLE public.invoice_reconciliation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('approved','rejected','skipped')),
  confidence numeric(5,2),
  marked_paid boolean NOT NULL DEFAULT false,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recon_decisions_payment ON public.invoice_reconciliation_decisions(payment_id);
CREATE INDEX idx_recon_decisions_invoice ON public.invoice_reconciliation_decisions(invoice_id);
CREATE INDEX idx_recon_decisions_created ON public.invoice_reconciliation_decisions(created_at DESC);

GRANT SELECT, INSERT ON public.invoice_reconciliation_decisions TO authenticated;
GRANT ALL ON public.invoice_reconciliation_decisions TO service_role;

ALTER TABLE public.invoice_reconciliation_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finance reads recon decisions"
  ON public.invoice_reconciliation_decisions FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'finance_admin'::app_role,'support_admin'::app_role])
  );

CREATE POLICY "finance writes recon decisions"
  ON public.invoice_reconciliation_decisions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'finance_admin'::app_role])
  );
