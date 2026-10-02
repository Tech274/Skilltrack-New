
-- 1) Dedicated table for super admins (avoids hardcoded email checks)
CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.super_admins TO authenticated;
GRANT ALL ON public.super_admins TO service_role;

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read only their own row (used to self-check).
DROP POLICY IF EXISTS "self read super_admins" ON public.super_admins;
CREATE POLICY "self read super_admins" ON public.super_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Only existing super admins may grant/revoke super-admin status.
DROP POLICY IF EXISTS "super admins manage super_admins" ON public.super_admins;
CREATE POLICY "super admins manage super_admins" ON public.super_admins
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins s WHERE s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_admins s WHERE s.user_id = auth.uid()));

-- 2) Seed the existing super admin (one-time bootstrap from the legacy email).
INSERT INTO public.super_admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'admin@skillbridge365.co.in'
ON CONFLICT (user_id) DO NOTHING;

-- 3) Replace is_super_admin to read from the dedicated table.
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = _uid)
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- 4) Remove the trigger that auto-promoted anyone signing up with the hardcoded email.
DROP TRIGGER IF EXISTS auto_promote_super_admin_trg ON auth.users;
DROP FUNCTION IF EXISTS public.auto_promote_super_admin();
