-- SCRUM-149: append-only audit of admin content, invoice, and user mutations.
-- Timestamp 20261023210000 is unique (the leads RLS migration uses 20261023180000).
-- SELECT is super admins only, matching the server check in listAdminAuditLog.
-- There is no UPDATE or DELETE policy. A trigger rejects those statements
-- even for the service role, which bypasses RLS.

CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id text,
  summary text,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX admin_audit_log_target_idx ON public.admin_audit_log (target_table, target_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_audit_log TO service_role;

CREATE POLICY "super admins read admin audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_audit_log_append_only() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER admin_audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.admin_audit_log_append_only();
