
-- Restrict mock_exam_questions reads to admins; sensitive columns (correct_answers, explanation) must not be visible to learners. Learner exam flow uses server-side functions with the service role.
DROP POLICY IF EXISTS "read questions of accessible exams" ON public.mock_exam_questions;
CREATE POLICY "admins read mock_exam_questions" ON public.mock_exam_questions
  FOR SELECT
  USING (
    is_super_admin(auth.uid())
    OR is_admin_role(auth.uid(), ARRAY['admin'::app_role, 'content_admin'::app_role, 'support_admin'::app_role])
  );

-- Prevent privilege escalation: remove the ability of existing super admins to grant super-admin via direct RLS-managed writes. Grants/revokes are only allowed through audited server functions using the service role.
DROP POLICY IF EXISTS "super admins manage super_admins" ON public.super_admins;
-- Keep the existing "self read super_admins" policy in place so a user can detect their own status.
-- Allow super admins to list all super admins (read-only) for the admin UI.
CREATE POLICY "super admins read super_admins" ON public.super_admins
  FOR SELECT
  USING (is_super_admin(auth.uid()));
