
-- 1) Fix privilege escalation on organization_members
DROP POLICY IF EXISTS "User can self-join" ON public.organization_members;
CREATE POLICY "User can self-join as learner"
  ON public.organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'learner');

-- 2) Restrict profiles SELECT to authenticated users
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- 3) Add unique constraint to support ON CONFLICT (org_id, user_id)
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_org_user_unique UNIQUE (org_id, user_id);
