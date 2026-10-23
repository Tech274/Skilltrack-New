-- Leads row-level security.
--
-- THIS FILE IS NOT APPLIED. Apply it to the live database before relying on
-- these policies. Until then, listSavedLeads is gated only by requireAdmin().
--
-- drizzle/migrations/0003_create_leads.sql creates public.leads and a
-- select-only policy for the `admin` role. This migration is the one to run
-- on the live database: it enables RLS (idempotent), replaces that policy,
-- and adds update plus the insert the public lead API needs.
--
-- Who can read and update (authenticated): the same set as requireAdmin()
-- in src/lib/admin-auth.server.ts — every admin-flavor role, or a row in
-- super_admins. Learners and anonymous clients cannot.
--
-- Insert, rate-limit reads, and sheet-sync updates are what
-- /api/public/lead does with the service role (supabaseAdmin). service_role
-- bypasses RLS on Supabase; the service_role policies below are the same
-- operations, so the public API still works if that bypass is not in effect.
-- anon and authenticated are not granted INSERT, so a browser client cannot
-- skip the API's validation, honeypot, or IP rate limit.

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.leads FROM PUBLIC;
REVOKE ALL ON TABLE public.leads FROM anon;
REVOKE ALL ON TABLE public.leads FROM authenticated;
GRANT SELECT, UPDATE ON TABLE public.leads TO authenticated;
GRANT ALL ON TABLE public.leads TO service_role;

DROP POLICY IF EXISTS "Platform admins can read leads" ON public.leads;
DROP POLICY IF EXISTS "admins select leads" ON public.leads;
DROP POLICY IF EXISTS "admins update leads" ON public.leads;
DROP POLICY IF EXISTS "public lead API insert" ON public.leads;
DROP POLICY IF EXISTS "public lead API read" ON public.leads;
DROP POLICY IF EXISTS "public lead API sheet sync" ON public.leads;

CREATE POLICY "admins select leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_admin_role(
    auth.uid(),
    ARRAY[
      'admin',
      'content_admin',
      'finance_admin',
      'support_admin',
      'certification_admin',
      'lab_admin',
      'operations_admin'
    ]::public.app_role[]
  )
);

CREATE POLICY "admins update leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.is_admin_role(
    auth.uid(),
    ARRAY[
      'admin',
      'content_admin',
      'finance_admin',
      'support_admin',
      'certification_admin',
      'lab_admin',
      'operations_admin'
    ]::public.app_role[]
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_admin_role(
    auth.uid(),
    ARRAY[
      'admin',
      'content_admin',
      'finance_admin',
      'support_admin',
      'certification_admin',
      'lab_admin',
      'operations_admin'
    ]::public.app_role[]
  )
);

-- Fresh public submission. /api/public/lead inserts this shape and does not
-- set status (column default is 'New') or the sheet-sync columns.
CREATE POLICY "public lead API insert"
ON public.leads
FOR INSERT
TO service_role
WITH CHECK (
  status = 'New'
  AND sheet_synced_at IS NULL
  AND sheet_error IS NULL
  AND source IN ('book_a_call', 'results_gate', 'org_seats', 'other')
);

-- Rate-limit count and duplicate lookup in /api/public/lead.
CREATE POLICY "public lead API read"
ON public.leads
FOR SELECT
TO service_role
USING (true);

-- Sheet-sync patch in /api/public/lead (sheet_synced_at / sheet_error).
CREATE POLICY "public lead API sheet sync"
ON public.leads
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);
