-- Leads row-level security.
--
-- THIS FILE IS NOT APPLIED. Apply it to the live database before relying on
-- these policies. Until then, lead reads are gated only by requireLeadAccess().
--
-- drizzle/migrations/0003_create_leads.sql creates public.leads and a
-- select-only policy for the `admin` role. This migration is the one to run
-- on the live database: it enables RLS (idempotent) and replaces that policy.
--
-- Authenticated select and update match the sales-leads page and
-- requireLeadAccess(): admin, operations_admin, finance_admin, support_admin,
-- or a row in super_admins. Other admin-flavor roles cannot read lead PII.
--
-- /api/public/lead inserts and updates sheet-sync columns with the service
-- role, which bypasses RLS. No service_role policies are created. anon and
-- authenticated are not granted INSERT, so a browser client cannot skip the
-- API's validation, honeypot, or IP rate limit.

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
      'operations_admin',
      'finance_admin',
      'support_admin'
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
      'operations_admin',
      'finance_admin',
      'support_admin'
    ]::public.app_role[]
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.is_admin_role(
    auth.uid(),
    ARRAY[
      'admin',
      'operations_admin',
      'finance_admin',
      'support_admin'
    ]::public.app_role[]
  )
);
