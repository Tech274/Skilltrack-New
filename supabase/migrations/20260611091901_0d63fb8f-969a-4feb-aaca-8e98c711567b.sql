
-- Learning paths table (tenant-scoped)
CREATE TABLE public.learning_paths (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_certification_slug TEXT,
  difficulty TEXT,
  estimated_hours NUMERIC,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  assessments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_paths TO authenticated;
GRANT ALL ON public.learning_paths TO service_role;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all learning paths" ON public.learning_paths
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE POLICY "Org members view org learning paths" ON public.learning_paths
  FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid()));

CREATE POLICY "Org execs manage org learning paths" ON public.learning_paths
  FOR ALL TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), ARRAY['exec'::org_role, 'hr'::org_role]))
  WITH CHECK (org_id IS NOT NULL AND public.is_org_member(org_id, auth.uid(), ARRAY['exec'::org_role, 'hr'::org_role]));

CREATE TRIGGER trg_learning_paths_updated
  BEFORE UPDATE ON public.learning_paths
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Add tenant settings & program template JSONB to organizations for autofill targets
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS program_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;
