
-- Add org_id (nullable: NULL = global/platform-owned) to mock_exams and certifications_catalog.
ALTER TABLE public.mock_exams
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.certifications_catalog
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_mock_exams_org_id ON public.mock_exams(org_id);
CREATE INDEX IF NOT EXISTS idx_certifications_catalog_org_id ON public.certifications_catalog(org_id);

-- Replace RLS to be tenant-aware.
DROP POLICY IF EXISTS "everyone reads published mock exams" ON public.mock_exams;
DROP POLICY IF EXISTS "content writes mock exams" ON public.mock_exams;

CREATE POLICY "read mock exams tenant aware" ON public.mock_exams
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role,'support_admin'::app_role])
    OR (org_id IS NULL AND status = 'published')
    OR (org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), NULL))
  );

CREATE POLICY "write mock exams platform" ON public.mock_exams
  FOR ALL USING (
    is_super_admin(auth.uid())
    OR is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role])
  ) WITH CHECK (
    is_super_admin(auth.uid())
    OR is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role])
  );

CREATE POLICY "write mock exams org" ON public.mock_exams
  FOR ALL USING (
    org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), ARRAY['exec'::org_role,'manager'::org_role])
  ) WITH CHECK (
    org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), ARRAY['exec'::org_role,'manager'::org_role])
  );

DROP POLICY IF EXISTS "everyone reads published certifications" ON public.certifications_catalog;
DROP POLICY IF EXISTS "content writes certifications" ON public.certifications_catalog;

CREATE POLICY "read certifications tenant aware" ON public.certifications_catalog
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role,'support_admin'::app_role])
    OR (org_id IS NULL AND status = 'published')
    OR (org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), NULL))
  );

CREATE POLICY "write certifications platform" ON public.certifications_catalog
  FOR ALL USING (
    is_super_admin(auth.uid())
    OR is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role])
  ) WITH CHECK (
    is_super_admin(auth.uid())
    OR is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role])
  );

CREATE POLICY "write certifications org" ON public.certifications_catalog
  FOR ALL USING (
    org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), ARRAY['exec'::org_role,'manager'::org_role])
  ) WITH CHECK (
    org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), ARRAY['exec'::org_role,'manager'::org_role])
  );
