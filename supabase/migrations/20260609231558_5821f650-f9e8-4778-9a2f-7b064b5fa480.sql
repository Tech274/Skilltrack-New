
-- Super Admin helper
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _uid AND lower(email) = 'admin@skillbridge365.co.in'
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- Role audit log
CREATE TABLE public.role_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  target_user_id uuid NOT NULL,
  target_email text,
  role app_role NOT NULL,
  action text NOT NULL CHECK (action IN ('grant','revoke')),
  source text NOT NULL DEFAULT 'admin_ui',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.role_audit_log TO authenticated;
GRANT ALL ON public.role_audit_log TO service_role;
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super admin reads audit log" ON public.role_audit_log
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE INDEX ON public.role_audit_log (created_at DESC);
CREATE INDEX ON public.role_audit_log (target_user_id);

-- Trigger to capture any user_roles change (defense in depth)
CREATE OR REPLACE FUNCTION public.log_user_role_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_target_email text;
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor;
  IF TG_OP = 'INSERT' THEN
    SELECT email INTO v_target_email FROM auth.users WHERE id = NEW.user_id;
    INSERT INTO public.role_audit_log (actor_id, actor_email, target_user_id, target_email, role, action, source)
    VALUES (v_actor, v_actor_email, NEW.user_id, v_target_email, NEW.role, 'grant', 'db_trigger');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT email INTO v_target_email FROM auth.users WHERE id = OLD.user_id;
    INSERT INTO public.role_audit_log (actor_id, actor_email, target_user_id, target_email, role, action, source)
    VALUES (v_actor, v_actor_email, OLD.user_id, v_target_email, OLD.role, 'revoke', 'db_trigger');
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_log_user_role_change ON public.user_roles;
CREATE TRIGGER trg_log_user_role_change
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_user_role_change();

-- Subscription plans (admin feature gating)
CREATE TABLE public.subscription_plans (
  plan_key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authenticated reads plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin writes plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.subscription_plans (plan_key, label, description, features, sort_order) VALUES
 ('free','Free','Basic admin tools', '["user_management"]'::jsonb, 1),
 ('pro','Pro','Adds security dashboard & audit log', '["user_management","security_dashboard","audit_log"]'::jsonb, 2),
 ('enterprise','Enterprise','All admin features including permissions matrix', '["user_management","security_dashboard","audit_log","permissions_matrix","subscription_management"]'::jsonb, 3);

-- Super admin subscription (single row, but keyed for flexibility)
CREATE TABLE public.super_admin_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid NOT NULL UNIQUE,
  plan_key text NOT NULL REFERENCES public.subscription_plans(plan_key),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled')),
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.super_admin_subscription TO authenticated;
GRANT ALL ON public.super_admin_subscription TO service_role;
ALTER TABLE public.super_admin_subscription ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any admin reads super sub" ON public.super_admin_subscription
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "super admin writes super sub" ON public.super_admin_subscription
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Seed super admin subscription to enterprise if super admin already exists
INSERT INTO public.super_admin_subscription (super_admin_id, plan_key, status)
SELECT id, 'enterprise', 'active' FROM auth.users
WHERE lower(email) = 'admin@skillbridge365.co.in'
ON CONFLICT (super_admin_id) DO NOTHING;

-- Role permissions matrix
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission text NOT NULL,
  allowed boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (role, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "super admin writes permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Seed default permission matrix
INSERT INTO public.role_permissions (role, permission, allowed, description) VALUES
 ('admin','users.read', true,  'View user list'),
 ('admin','users.manage', true,'Grant/revoke roles, delete users'),
 ('admin','security.read', true,'View security findings'),
 ('admin','security.manage', true,'Triage security findings'),
 ('admin','audit.read', true, 'View audit log'),
 ('admin','permissions.manage', true,'Edit role permissions matrix'),
 ('admin','subscription.manage', true,'Manage admin subscription'),
 ('manager','users.read', true, 'View users in their org'),
 ('manager','users.manage', false,'Manage roles'),
 ('manager','security.read', false,'View security findings'),
 ('manager','security.manage', false,'Triage findings'),
 ('manager','audit.read', false,'View audit log'),
 ('manager','permissions.manage', false,'Edit permissions matrix'),
 ('manager','subscription.manage', false,'Manage subscription'),
 ('learner','users.read', false,'View user list'),
 ('learner','users.manage', false,'Manage roles'),
 ('learner','security.read', false,'View security findings'),
 ('learner','security.manage', false,'Triage findings'),
 ('learner','audit.read', false,'View audit log'),
 ('learner','permissions.manage', false,'Edit permissions matrix'),
 ('learner','subscription.manage', false,'Manage subscription');

CREATE TRIGGER trg_role_permissions_touch
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_subscription_plans_touch
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_super_admin_subscription_touch
BEFORE UPDATE ON public.super_admin_subscription
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
