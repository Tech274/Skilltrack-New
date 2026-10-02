-- Tighten overly broad read access

-- app_settings: only admins / super admins may read configuration
DROP POLICY IF EXISTS "Authenticated can read app settings" ON public.app_settings;
CREATE POLICY "Admins can read app settings"
ON public.app_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin(auth.uid()));

-- profiles: users may read only their own profile
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- role_permissions: restrict matrix reads to admins / super admins
DROP POLICY IF EXISTS "authenticated read permissions" ON public.role_permissions;
CREATE POLICY "Admins read permissions"
ON public.role_permissions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin(auth.uid()));