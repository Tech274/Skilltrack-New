
CREATE TABLE public.super_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  target_user_id uuid NOT NULL,
  target_email text,
  action text NOT NULL CHECK (action IN ('grant','revoke')),
  source text NOT NULL DEFAULT 'admin_ui',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX super_admin_audit_log_created_at_idx ON public.super_admin_audit_log (created_at DESC);
CREATE INDEX super_admin_audit_log_target_idx ON public.super_admin_audit_log (target_user_id);

GRANT SELECT ON public.super_admin_audit_log TO authenticated;
GRANT ALL ON public.super_admin_audit_log TO service_role;

ALTER TABLE public.super_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins read super_admin_audit_log"
  ON public.super_admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_super_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_target_email text;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  IF TG_OP = 'INSERT' THEN
    SELECT email INTO v_target_email FROM auth.users WHERE id = NEW.user_id;
    INSERT INTO public.super_admin_audit_log (actor_id, actor_email, target_user_id, target_email, action, source)
    VALUES (v_actor, v_actor_email, NEW.user_id, v_target_email, 'grant', 'db_trigger');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT email INTO v_target_email FROM auth.users WHERE id = OLD.user_id;
    INSERT INTO public.super_admin_audit_log (actor_id, actor_email, target_user_id, target_email, action, source)
    VALUES (v_actor, v_actor_email, OLD.user_id, v_target_email, 'revoke', 'db_trigger');
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_log_super_admin_change ON public.super_admins;
CREATE TRIGGER trg_log_super_admin_change
AFTER INSERT OR DELETE ON public.super_admins
FOR EACH ROW EXECUTE FUNCTION public.log_super_admin_change();
