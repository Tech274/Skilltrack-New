
-- Per-enterprise audit log of invoice actions (view, download, resend, regenerate, logo_updated)
CREATE TABLE public.invoice_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NULL REFERENCES public.invoices(id) ON DELETE SET NULL,
  org_id uuid NULL REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id uuid NULL,
  actor_email text NULL,
  action text NOT NULL CHECK (action IN ('view','download','resend','regenerate','logo_updated')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_iaa_invoice ON public.invoice_action_audit(invoice_id);
CREATE INDEX idx_iaa_org ON public.invoice_action_audit(org_id);
CREATE INDEX idx_iaa_created ON public.invoice_action_audit(created_at DESC);

GRANT SELECT, INSERT ON public.invoice_action_audit TO authenticated;
GRANT ALL ON public.invoice_action_audit TO service_role;

ALTER TABLE public.invoice_action_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance admins read all invoice action audit"
  ON public.invoice_action_audit FOR SELECT TO authenticated
  USING (
    public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin','support_admin']::app_role[])
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Org members read their org invoice action audit"
  ON public.invoice_action_audit FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL));

-- Writes are only performed by service_role (server-side helpers); no INSERT policy for authenticated.

-- Track when an org logo was last changed so on-demand PDF renders can pick up the new asset
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz NULL;
