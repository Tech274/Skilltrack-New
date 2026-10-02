
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS email_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS email_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_last_error text;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_email_status_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_email_status_check
  CHECK (email_status IN ('not_sent','queued','sent','failed'));

CREATE TABLE IF NOT EXISTS public.invoice_email_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  invoice_number text,
  actor_id uuid,
  actor_email text,
  recipient_email text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued','sent','failed')),
  provider_message_id text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_email_audit_invoice_idx
  ON public.invoice_email_audit (invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoice_email_audit_created_idx
  ON public.invoice_email_audit (created_at DESC);

GRANT SELECT ON public.invoice_email_audit TO authenticated;
GRANT ALL ON public.invoice_email_audit TO service_role;

ALTER TABLE public.invoice_email_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance reads invoice_email_audit" ON public.invoice_email_audit;
CREATE POLICY "finance reads invoice_email_audit"
  ON public.invoice_email_audit
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin','support_admin']::app_role[])
  );
