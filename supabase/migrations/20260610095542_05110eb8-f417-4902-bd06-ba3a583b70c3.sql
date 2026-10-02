
-- ============================================================
-- LEARNER ASSIGNMENTS
-- ============================================================
CREATE TABLE public.learner_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('certification','resource','mock_exam')),
  asset_id uuid NOT NULL,
  asset_label text,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','in_progress','completed','revoked')),
  assigned_by uuid REFERENCES auth.users(id),
  due_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(learner_id, asset_type, asset_id)
);

GRANT SELECT ON public.learner_assignments TO authenticated;
GRANT ALL ON public.learner_assignments TO service_role;

ALTER TABLE public.learner_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learners can view their own assignments"
  ON public.learner_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = learner_id);

CREATE POLICY "Admins can view all assignments"
  ON public.learner_assignments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support_admin')
    OR public.has_role(auth.uid(), 'content_admin')
    OR public.has_role(auth.uid(), 'finance_admin')
    OR public.is_super_admin(auth.uid())
  );

CREATE TRIGGER learner_assignments_touch
  BEFORE UPDATE ON public.learner_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX learner_assignments_learner_idx ON public.learner_assignments(learner_id);
CREATE INDEX learner_assignments_asset_idx ON public.learner_assignments(asset_type, asset_id);

-- ============================================================
-- ADMIN / IN-APP NOTIFICATIONS
-- ============================================================
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  audience text NOT NULL DEFAULT 'admin' CHECK (audience IN ('admin','learner')),
  category text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients can view their notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "Recipients can mark their notifications read"
  ON public.admin_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Admins can view all notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'support_admin')
    OR public.is_super_admin(auth.uid())
  );

CREATE INDEX admin_notifications_recipient_idx ON public.admin_notifications(recipient_id, created_at DESC);
CREATE INDEX admin_notifications_unread_idx ON public.admin_notifications(recipient_id) WHERE read_at IS NULL;
