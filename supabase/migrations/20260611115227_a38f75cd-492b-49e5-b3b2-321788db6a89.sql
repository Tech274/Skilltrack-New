
CREATE TABLE public.learning_path_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  label text,
  snapshot jsonb NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path_id, version_number)
);
CREATE INDEX idx_lp_versions_path ON public.learning_path_versions(path_id, version_number DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_path_versions TO authenticated;
GRANT ALL ON public.learning_path_versions TO service_role;

ALTER TABLE public.learning_path_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all lp versions"
  ON public.learning_path_versions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_super_admin(auth.uid()));

CREATE POLICY "Org execs manage org lp versions"
  ON public.learning_path_versions FOR ALL TO authenticated
  USING (org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), ARRAY['exec'::org_role, 'hr'::org_role]))
  WITH CHECK (org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), ARRAY['exec'::org_role, 'hr'::org_role]));

CREATE POLICY "Org members view org lp versions"
  ON public.learning_path_versions FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND is_org_member(org_id, auth.uid(), NULL::org_role[]));
