-- SCRUM-150: page auth.users together with profiles and roles.
-- Email lives in auth.users, so PostgREST on public tables cannot search it.
-- EXECUTE is limited to service_role. The app falls back if this function is missing.

CREATE OR REPLACE FUNCTION public.admin_directory_page(
  _role text,
  _search text,
  _status text,
  _page integer,
  _page_size integer,
  _order text
)
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  headline text,
  country text,
  target_role text,
  timezone text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  roles text[],
  is_super_admin boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  lim integer := LEAST(GREATEST(COALESCE(_page_size, 50), 1), 100);
  off integer := (GREATEST(COALESCE(_page, 1), 1) - 1) * lim;
  raw text := btrim(COALESCE(_search, ''));
  pat text := NULL;
  sort_key text := CASE WHEN _order = 'email' THEN 'email' ELSE 'created_at' END;
BEGIN
  IF _role IS NOT NULL AND _role <> '' AND _role NOT IN (
    'learner', 'manager', 'admin', 'content_admin', 'finance_admin', 'support_admin',
    'certification_admin', 'lab_admin', 'operations_admin'
  ) THEN
    RAISE EXCEPTION 'invalid role';
  END IF;

  IF _status IS NOT NULL AND _status <> '' AND _status NOT IN ('all', 'active', 'disabled') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  IF raw <> '' THEN
    raw := replace(raw, '\', '\\');
    raw := replace(raw, '%', '\%');
    raw := replace(raw, '_', '\_');
    pat := '%' || raw || '%';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      u.id,
      u.email::text AS email,
      p.display_name,
      p.avatar_url,
      p.headline,
      p.country,
      p.target_role,
      p.timezone,
      u.created_at,
      u.last_sign_in_at,
      u.banned_until,
      COALESCE(role_row.roles, '{}'::text[]) AS roles,
      EXISTS (SELECT 1 FROM public.super_admins s WHERE s.user_id = u.id) AS is_super_admin
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    LEFT JOIN LATERAL (
      SELECT array_agg(ur.role::text) AS roles
      FROM public.user_roles ur
      WHERE ur.user_id = u.id
    ) role_row ON true
    WHERE (
      _role IS NULL OR _role = '' OR EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = u.id AND r.role::text = _role
      )
    )
    AND (
      pat IS NULL
      OR u.email ILIKE pat ESCAPE '\'
      OR COALESCE(p.display_name, '') ILIKE pat ESCAPE '\'
      OR COALESCE(p.target_role, '') ILIKE pat ESCAPE '\'
      OR COALESCE(p.headline, '') ILIKE pat ESCAPE '\'
    )
    AND (
      _status IS NULL OR _status = '' OR _status = 'all'
      OR (_status = 'disabled' AND u.banned_until IS NOT NULL AND u.banned_until > now())
      OR (_status = 'active' AND (u.banned_until IS NULL OR u.banned_until <= now()))
    )
  ),
  totals AS (
    SELECT COUNT(*)::bigint AS total_count FROM filtered
  ),
  page_rows AS (
    SELECT *
    FROM filtered
    ORDER BY
      CASE WHEN sort_key = 'email' THEN filtered.email END ASC NULLS LAST,
      CASE WHEN sort_key = 'created_at' THEN filtered.created_at END DESC NULLS LAST,
      filtered.email ASC NULLS LAST,
      filtered.id ASC
    LIMIT lim OFFSET off
  )
  SELECT
    pr.id,
    pr.email,
    pr.display_name,
    pr.avatar_url,
    pr.headline,
    pr.country,
    pr.target_role,
    pr.timezone,
    pr.created_at,
    pr.last_sign_in_at,
    pr.banned_until,
    pr.roles,
    pr.is_super_admin,
    t.total_count
  FROM totals t
  LEFT JOIN page_rows pr ON true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_directory_page(text, text, text, integer, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_directory_page(text, text, text, integer, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_directory_page(text, text, text, integer, integer, text) TO service_role;
