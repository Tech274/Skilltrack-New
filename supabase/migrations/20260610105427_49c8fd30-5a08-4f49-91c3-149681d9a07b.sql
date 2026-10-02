CREATE TABLE public.ai_recs_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  strategy text NOT NULL,
  source text NOT NULL,
  fallback boolean NOT NULL DEFAULT false,
  message text,
  error text,
  recommendation_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_recs_audit TO authenticated;
GRANT ALL ON public.ai_recs_audit TO service_role;

ALTER TABLE public.ai_recs_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ai_recs_audit"
  ON public.ai_recs_audit FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE INDEX ai_recs_audit_created_at_idx ON public.ai_recs_audit (created_at DESC);
CREATE INDEX ai_recs_audit_user_idx ON public.ai_recs_audit (user_id);