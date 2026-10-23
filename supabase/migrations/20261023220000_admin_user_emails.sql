-- Batch auth emails for admin lists. EXECUTE is service_role only.
-- Not applied to a live database from this PR.

CREATE OR REPLACE FUNCTION public.admin_user_emails(_ids uuid[])
RETURNS TABLE (id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id, u.email::text
  FROM auth.users u
  WHERE u.id = ANY(COALESCE(_ids, ARRAY[]::uuid[]));
$$;

REVOKE ALL ON FUNCTION public.admin_user_emails(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_emails(uuid[]) TO service_role;
