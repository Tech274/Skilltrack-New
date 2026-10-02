CREATE TABLE public.ai_org_defaults (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  default_model text,
  max_output_tokens integer,
  llm_timeout_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ai_org_defaults_max_output_tokens_range CHECK (max_output_tokens IS NULL OR (max_output_tokens BETWEEN 64 AND 32000)),
  CONSTRAINT ai_org_defaults_timeout_range CHECK (llm_timeout_ms IS NULL OR (llm_timeout_ms BETWEEN 10000 AND 120000))
);

GRANT SELECT ON public.ai_org_defaults TO authenticated;
GRANT ALL ON public.ai_org_defaults TO service_role;

ALTER TABLE public.ai_org_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read org ai defaults"
  ON public.ai_org_defaults FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(org_id, auth.uid(), NULL)
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Org execs manage ai defaults"
  ON public.ai_org_defaults FOR ALL
  TO authenticated
  USING (
    public.is_org_member(org_id, auth.uid(), ARRAY['exec']::org_role[])
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    public.is_org_member(org_id, auth.uid(), ARRAY['exec']::org_role[])
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_super_admin(auth.uid())
  );

CREATE TRIGGER ai_org_defaults_touch_updated_at
  BEFORE UPDATE ON public.ai_org_defaults
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
