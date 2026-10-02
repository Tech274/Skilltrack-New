-- 1) Organizations: light + dark logo URLs
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_light_path text,
  ADD COLUMN IF NOT EXISTS logo_dark_path text,
  ADD COLUMN IF NOT EXISTS brand_version integer NOT NULL DEFAULT 1;

-- 2) Storage RLS for org-logos bucket (bucket already created)
CREATE POLICY "org logos authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'org-logos');

CREATE POLICY "org execs upload logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-logos'
    AND public.is_org_member(
      (split_part(name, '/', 1))::uuid,
      auth.uid(),
      ARRAY['exec'::org_role, 'hr'::org_role]
    )
  );

CREATE POLICY "org execs update logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND public.is_org_member(
      (split_part(name, '/', 1))::uuid,
      auth.uid(),
      ARRAY['exec'::org_role, 'hr'::org_role]
    )
  );

CREATE POLICY "org execs delete logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND public.is_org_member(
      (split_part(name, '/', 1))::uuid,
      auth.uid(),
      ARRAY['exec'::org_role, 'hr'::org_role]
    )
  );

-- 3) Email templates
CREATE TABLE public.invoice_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  invoice_type text NULL,
  subject_template text NOT NULL,
  body_html_template text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_email_templates TO authenticated;
GRANT ALL ON public.invoice_email_templates TO service_role;
ALTER TABLE public.invoice_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates read" ON public.invoice_email_templates
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_admin_role(auth.uid(), ARRAY['admin'::app_role, 'finance_admin'::app_role, 'support_admin'::app_role])
    OR (org_id IS NOT NULL AND is_org_member(org_id, auth.uid()))
  );

CREATE POLICY "templates write" ON public.invoice_email_templates
  FOR ALL TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR is_admin_role(auth.uid(), ARRAY['admin'::app_role, 'finance_admin'::app_role])
    OR (org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), ARRAY['exec'::org_role, 'hr'::org_role]))
  )
  WITH CHECK (
    is_super_admin(auth.uid())
    OR is_admin_role(auth.uid(), ARRAY['admin'::app_role, 'finance_admin'::app_role])
    OR (org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), ARRAY['exec'::org_role, 'hr'::org_role]))
  );

CREATE TRIGGER trg_invoice_email_templates_touch
  BEFORE UPDATE ON public.invoice_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.invoice_email_templates (org_id, name, subject_template, body_html_template, is_default)
VALUES (
  NULL,
  'Default invoice email',
  'Invoice {{invoice_number}} from {{brand_name}}',
  '<p>Hi {{learner_name}},</p><p>Please find attached invoice <strong>{{invoice_number}}</strong> for <strong>{{total}} {{currency}}</strong>, due {{due_date}}.</p><p>Thank you,<br/>{{brand_name}}</p>',
  true
);

-- 4) Background email jobs
CREATE TABLE public.invoice_email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','paused','cancelled','done','failed')),
  total integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  succeeded integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  template_id uuid REFERENCES public.invoice_email_templates(id) ON DELETE SET NULL,
  subject_override text,
  body_html_override text,
  last_error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_email_jobs TO authenticated;
GRANT ALL ON public.invoice_email_jobs TO service_role;
ALTER TABLE public.invoice_email_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email jobs read" ON public.invoice_email_jobs
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_admin_role(auth.uid(), ARRAY['admin'::app_role, 'finance_admin'::app_role, 'support_admin'::app_role]));
CREATE POLICY "email jobs write" ON public.invoice_email_jobs
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR is_admin_role(auth.uid(), ARRAY['admin'::app_role, 'finance_admin'::app_role]))
  WITH CHECK (is_super_admin(auth.uid()) OR is_admin_role(auth.uid(), ARRAY['admin'::app_role, 'finance_admin'::app_role]));

CREATE TRIGGER trg_invoice_email_jobs_touch
  BEFORE UPDATE ON public.invoice_email_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.invoice_email_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.invoice_email_jobs(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped')),
  recipient_email text,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_email_job_items TO authenticated;
GRANT ALL ON public.invoice_email_job_items TO service_role;
ALTER TABLE public.invoice_email_job_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email job items read" ON public.invoice_email_job_items
  FOR SELECT TO authenticated
  USING (is_super_admin(auth.uid()) OR is_admin_role(auth.uid(), ARRAY['admin'::app_role, 'finance_admin'::app_role, 'support_admin'::app_role]));
CREATE POLICY "email job items write" ON public.invoice_email_job_items
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()) OR is_admin_role(auth.uid(), ARRAY['admin'::app_role, 'finance_admin'::app_role]))
  WITH CHECK (is_super_admin(auth.uid()) OR is_admin_role(auth.uid(), ARRAY['admin'::app_role, 'finance_admin'::app_role]));

CREATE INDEX invoice_email_job_items_job_idx ON public.invoice_email_job_items(job_id, status);
CREATE INDEX invoice_email_jobs_status_idx ON public.invoice_email_jobs(status, created_at DESC);

-- 5) Audit filter indexes
CREATE INDEX IF NOT EXISTS invoice_email_audit_recipient_idx ON public.invoice_email_audit(recipient_email);
CREATE INDEX IF NOT EXISTS invoice_email_audit_status_idx ON public.invoice_email_audit(status, created_at DESC);
CREATE INDEX IF NOT EXISTS invoice_email_audit_invoice_number_idx ON public.invoice_email_audit(invoice_number);

-- 6) Platform brand version (cache-busting)
CREATE TABLE IF NOT EXISTS public.brand_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brand_settings TO authenticated, anon;
GRANT ALL ON public.brand_settings TO service_role;
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_settings public read" ON public.brand_settings FOR SELECT USING (true);
CREATE POLICY "brand_settings super admin write" ON public.brand_settings
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid())) WITH CHECK (is_super_admin(auth.uid()));
INSERT INTO public.brand_settings (id, version) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;
