
CREATE TABLE public.permission_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  role app_role NOT NULL,
  permission text NOT NULL,
  previous_allowed boolean,
  new_allowed boolean NOT NULL,
  source text NOT NULL DEFAULT 'admin_ui',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX permission_audit_log_created_at_idx ON public.permission_audit_log (created_at DESC);
CREATE INDEX permission_audit_log_role_perm_idx ON public.permission_audit_log (role, permission);

GRANT SELECT ON public.permission_audit_log TO authenticated;
GRANT ALL ON public.permission_audit_log TO service_role;

ALTER TABLE public.permission_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin reads permission audit"
  ON public.permission_audit_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
