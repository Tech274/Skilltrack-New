REVOKE SELECT ON public.organization_members FROM authenticated;
GRANT SELECT (id, org_id, user_id, role, created_at) ON public.organization_members TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;