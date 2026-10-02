-- Promote admin@skillbridge365.co.in to admin (acts as Super Admin)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email='admin@skillbridge365.co.in'
ON CONFLICT (user_id, role) DO NOTHING;

-- Auto-promote on signup if email matches (in case user re-registers)
CREATE OR REPLACE FUNCTION public.auto_promote_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'admin@skillbridge365.co.in' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_promote_super_admin_trg ON auth.users;
CREATE TRIGGER auto_promote_super_admin_trg
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_promote_super_admin();