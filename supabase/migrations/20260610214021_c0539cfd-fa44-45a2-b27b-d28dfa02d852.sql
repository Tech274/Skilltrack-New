
-- Storage policies for ai-uploads bucket
CREATE POLICY "ai-uploads admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ai-uploads' AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid())));

CREATE POLICY "ai-uploads admin insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-uploads' AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid())));

CREATE POLICY "ai-uploads admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ai-uploads' AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid())));

CREATE POLICY "ai-uploads admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ai-uploads' AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid())));

-- ai_extraction_jobs
CREATE TABLE public.ai_extraction_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_entity text NOT NULL,
  source text NOT NULL DEFAULT 'upload',
  file_path text,
  file_name text,
  file_mime text,
  prompt text,
  status text NOT NULL DEFAULT 'queued',
  model text,
  summary jsonb DEFAULT '{}'::jsonb,
  error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_extraction_jobs TO authenticated;
GRANT ALL ON public.ai_extraction_jobs TO service_role;
ALTER TABLE public.ai_extraction_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_extraction_jobs admin all"
  ON public.ai_extraction_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_ai_extraction_jobs_updated
  BEFORE UPDATE ON public.ai_extraction_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_ai_jobs_status ON public.ai_extraction_jobs(status);
CREATE INDEX idx_ai_jobs_creator ON public.ai_extraction_jobs(created_by);

-- ai_extraction_staged_rows
CREATE TABLE public.ai_extraction_staged_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.ai_extraction_jobs(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized jsonb,
  validation_errors jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  target_row_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_extraction_staged_rows TO authenticated;
GRANT ALL ON public.ai_extraction_staged_rows TO service_role;
ALTER TABLE public.ai_extraction_staged_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_staged_rows admin all"
  ON public.ai_extraction_staged_rows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_ai_staged_rows_updated
  BEFORE UPDATE ON public.ai_extraction_staged_rows
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_ai_staged_job ON public.ai_extraction_staged_rows(job_id);
CREATE INDEX idx_ai_staged_status ON public.ai_extraction_staged_rows(status);

-- ai_action_audit
CREATE TABLE public.ai_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  area text NOT NULL,
  action text NOT NULL,
  target_table text,
  target_id text,
  prompt text,
  model text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_action_audit TO authenticated;
GRANT ALL ON public.ai_action_audit TO service_role;
ALTER TABLE public.ai_action_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_audit admin read"
  ON public.ai_action_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "ai_audit admin insert"
  ON public.ai_action_audit FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_ai_audit_actor ON public.ai_action_audit(actor_id);
CREATE INDEX idx_ai_audit_area ON public.ai_action_audit(area);
CREATE INDEX idx_ai_audit_created ON public.ai_action_audit(created_at DESC);

-- ai_prompt_versions
CREATE TABLE public.ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key text NOT NULL,
  version int NOT NULL DEFAULT 1,
  system_prompt text NOT NULL,
  schema_json jsonb,
  model text,
  is_active boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_key, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompt_versions TO authenticated;
GRANT ALL ON public.ai_prompt_versions TO service_role;
ALTER TABLE public.ai_prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_prompt_versions admin read"
  ON public.ai_prompt_versions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_super_admin(auth.uid()));
CREATE POLICY "ai_prompt_versions super admin write"
  ON public.ai_prompt_versions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_ai_prompt_versions_updated
  BEFORE UPDATE ON public.ai_prompt_versions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_ai_prompt_versions_form ON public.ai_prompt_versions(form_key);
