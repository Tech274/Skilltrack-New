
-- subscriptions
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('user','org')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_code text NOT NULL CHECK (plan_code IN ('professional','team')),
  billing_interval text NOT NULL CHECK (billing_interval IN ('month','year')),
  seats integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'incomplete',
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  price_id text,
  product_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_scope_target_chk CHECK (
    (scope = 'user' AND user_id IS NOT NULL AND org_id IS NULL)
    OR (scope = 'org' AND org_id IS NOT NULL AND user_id IS NULL)
  )
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_org_id ON public.subscriptions(org_id);
CREATE INDEX idx_subscriptions_stripe_sub ON public.subscriptions(stripe_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own user sub" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    (scope = 'user' AND user_id = auth.uid())
    OR (scope = 'org' AND public.is_org_member(org_id, auth.uid(), NULL))
    OR public.is_admin_role(auth.uid(), ARRAY['admin','content_admin']::app_role[])
    OR public.is_super_admin(auth.uid())
  );

CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- subscription_events (raw audit)
CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  type text NOT NULL,
  payload jsonb NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_events_type ON public.subscription_events(type);
CREATE INDEX idx_subscription_events_received ON public.subscription_events(received_at DESC);

GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view events" ON public.subscription_events
  FOR SELECT TO authenticated
  USING (
    public.is_admin_role(auth.uid(), ARRAY['admin','content_admin']::app_role[])
    OR public.is_super_admin(auth.uid())
  );

-- entitlement helper
CREATE OR REPLACE FUNCTION public.has_active_entitlement(_user uuid, _plan text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.status IN ('trialing','active','past_due')
      AND (s.current_period_end IS NULL OR s.current_period_end > now())
      AND (_plan IS NULL OR s.plan_code = _plan
           OR (_plan = 'professional' AND s.plan_code = 'team'))
      AND (
        (s.scope = 'user' AND s.user_id = _user)
        OR (s.scope = 'org' AND EXISTS (
              SELECT 1 FROM public.organization_members m
              WHERE m.org_id = s.org_id AND m.user_id = _user
            ))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_entitlement(uuid, text) TO authenticated, anon, service_role;
