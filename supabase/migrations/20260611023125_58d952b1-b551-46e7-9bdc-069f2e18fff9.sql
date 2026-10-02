
-- 1. Columns
ALTER TABLE public.ai_extraction_staged_rows
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ai_staged_org ON public.ai_extraction_staged_rows(org_id);

ALTER TABLE public.ai_action_audit
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ai_audit_org ON public.ai_action_audit(org_id);

-- 2. Backfill staged rows org_id from parent job
UPDATE public.ai_extraction_staged_rows sr
SET org_id = j.org_id
FROM public.ai_extraction_jobs j
WHERE sr.job_id = j.id AND sr.org_id IS NULL AND j.org_id IS NOT NULL;

-- 3. Trigger to keep staged_rows.org_id synced from job
CREATE OR REPLACE FUNCTION public.ai_staged_row_set_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id FROM public.ai_extraction_jobs WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ai_staged_set_org ON public.ai_extraction_staged_rows;
CREATE TRIGGER trg_ai_staged_set_org
  BEFORE INSERT ON public.ai_extraction_staged_rows
  FOR EACH ROW EXECUTE FUNCTION public.ai_staged_row_set_org();

-- 4. RLS rewrite: ai_extraction_jobs
DROP POLICY IF EXISTS "ai_extraction_jobs admin all" ON public.ai_extraction_jobs;

CREATE POLICY "ai_jobs read"
  ON public.ai_extraction_jobs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL))
  );

CREATE POLICY "ai_jobs write"
  ON public.ai_extraction_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL))
  );

CREATE POLICY "ai_jobs update"
  ON public.ai_extraction_jobs FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL))
  );

CREATE POLICY "ai_jobs delete"
  ON public.ai_extraction_jobs FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
  );

-- 5. RLS rewrite: ai_extraction_staged_rows
DROP POLICY IF EXISTS "ai_staged_rows admin all" ON public.ai_extraction_staged_rows;

CREATE POLICY "ai_staged read"
  ON public.ai_extraction_staged_rows FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL))
  );

CREATE POLICY "ai_staged write"
  ON public.ai_extraction_staged_rows FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL))
  );

CREATE POLICY "ai_staged update"
  ON public.ai_extraction_staged_rows FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL))
  );

CREATE POLICY "ai_staged delete"
  ON public.ai_extraction_staged_rows FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
  );

-- 6. RLS rewrite: ai_action_audit (keep insert restricted to service role only)
DROP POLICY IF EXISTS "ai_audit admin insert" ON public.ai_action_audit;
DROP POLICY IF EXISTS "ai_audit admin read" ON public.ai_action_audit;

CREATE POLICY "ai_audit read"
  ON public.ai_action_audit FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_super_admin(auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), NULL))
  );

-- No INSERT/UPDATE/DELETE policies for authenticated => service_role only via GRANT.

-- 7. Grants (safe to re-run)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_extraction_jobs TO authenticated;
GRANT ALL ON public.ai_extraction_jobs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_extraction_staged_rows TO authenticated;
GRANT ALL ON public.ai_extraction_staged_rows TO service_role;
GRANT SELECT ON public.ai_action_audit TO authenticated;
GRANT ALL ON public.ai_action_audit TO service_role;
