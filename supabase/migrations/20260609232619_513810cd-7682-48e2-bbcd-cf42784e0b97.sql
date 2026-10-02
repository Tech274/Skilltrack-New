
-- ===== Helper: is_admin_role =====
CREATE OR REPLACE FUNCTION public.is_admin_role(_uid uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role = ANY(_roles)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin_role(uuid, app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_role(uuid, app_role[]) TO authenticated;

-- ===== learner_subscriptions =====
CREATE TABLE public.learner_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL,
  plan_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','expired','canceled','pending')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learner_subscriptions TO authenticated;
GRANT ALL ON public.learner_subscriptions TO service_role;
ALTER TABLE public.learner_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learner reads own sub" ON public.learner_subscriptions
  FOR SELECT TO authenticated USING (learner_id = auth.uid());
CREATE POLICY "admins read subs" ON public.learner_subscriptions
  FOR SELECT TO authenticated USING (
    public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin','support_admin']::app_role[])
  );
CREATE POLICY "finance writes subs" ON public.learner_subscriptions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin']::app_role[]))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin']::app_role[]));
CREATE INDEX ON public.learner_subscriptions (learner_id);
CREATE INDEX ON public.learner_subscriptions (status);
CREATE INDEX ON public.learner_subscriptions (end_date);
CREATE TRIGGER trg_ls_touch BEFORE UPDATE ON public.learner_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== invoices =====
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1000;
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE DEFAULT ('INV-' || lpad(nextval('public.invoice_seq')::text, 6, '0')),
  learner_id uuid NOT NULL,
  learner_email text,
  learner_name text,
  description text,
  plan_key text,
  certification_slug text,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  paid_at timestamptz,
  billing_address text,
  tax_number text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learner reads own invoices" ON public.invoices
  FOR SELECT TO authenticated USING (learner_id = auth.uid());
CREATE POLICY "admins read invoices" ON public.invoices
  FOR SELECT TO authenticated USING (
    public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin','support_admin']::app_role[])
  );
CREATE POLICY "finance writes invoices" ON public.invoices
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin']::app_role[]))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin']::app_role[]));
CREATE INDEX ON public.invoices (learner_id);
CREATE INDEX ON public.invoices (status);
CREATE INDEX ON public.invoices (issue_date DESC);
CREATE TRIGGER trg_inv_touch BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== payments =====
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  learner_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  mode text NOT NULL DEFAULT 'gateway' CHECK (mode IN ('upi','bank_transfer','card','cash','gateway')),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('pending','success','failed','refunded')),
  transaction_id text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  remarks text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learner reads own payments" ON public.payments
  FOR SELECT TO authenticated USING (learner_id = auth.uid());
CREATE POLICY "admins read payments" ON public.payments
  FOR SELECT TO authenticated USING (
    public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin','support_admin']::app_role[])
  );
CREATE POLICY "finance writes payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin']::app_role[]))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin','finance_admin']::app_role[]));
CREATE INDEX ON public.payments (invoice_id);
CREATE INDEX ON public.payments (learner_id);
CREATE INDEX ON public.payments (paid_at DESC);
CREATE TRIGGER trg_pay_touch BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== study_resources =====
CREATE TABLE public.study_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  certification_slug text,
  module text,
  topic text,
  resource_type text NOT NULL CHECK (resource_type IN ('pdf','ppt','doc','video','audio','link','youtube','practice_guide','notes','cheat_sheet','lab_guide','case_study','assignment')),
  file_url text,
  external_url text,
  access_tier text NOT NULL DEFAULT 'free' CHECK (access_tier IN ('free','paid')),
  required_plan text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  download_allowed boolean NOT NULL DEFAULT true,
  views_count int NOT NULL DEFAULT 0,
  downloads_count int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_resources TO authenticated;
GRANT ALL ON public.study_resources TO service_role;
ALTER TABLE public.study_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "everyone reads published resources" ON public.study_resources
  FOR SELECT TO authenticated USING (
    status = 'published'
    OR public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin','content_admin','support_admin']::app_role[])
  );
CREATE POLICY "content writes resources" ON public.study_resources
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin','content_admin']::app_role[]))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin','content_admin']::app_role[]));
CREATE INDEX ON public.study_resources (certification_slug);
CREATE INDEX ON public.study_resources (status);
CREATE TRIGGER trg_sr_touch BEFORE UPDATE ON public.study_resources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
