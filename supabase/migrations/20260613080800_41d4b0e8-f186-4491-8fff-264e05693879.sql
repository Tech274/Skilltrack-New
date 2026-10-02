
-- 1. New app_role values (must be committed before being used as literals)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'certification_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lab_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations_admin';

-- 2. Fix Super Admin read on super_admin_subscription
DROP POLICY IF EXISTS "any admin reads super sub" ON public.super_admin_subscription;
CREATE POLICY "admins and super admins read super sub"
  ON public.super_admin_subscription FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_super_admin(auth.uid())
  );
