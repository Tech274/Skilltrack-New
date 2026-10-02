
ALTER TABLE public.user_certifications ADD COLUMN IF NOT EXISTS remind_at timestamptz;

CREATE TABLE IF NOT EXISTS public.study_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_certification_id uuid NOT NULL REFERENCES public.user_certifications(id) ON DELETE CASCADE,
  certification_slug text NOT NULL,
  title text NOT NULL,
  description text,
  due_date date,
  order_index integer NOT NULL DEFAULT 0,
  milestone_type text NOT NULL DEFAULT 'study',
  source text NOT NULL DEFAULT 'manual',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_milestones TO authenticated;
GRANT ALL ON public.study_milestones TO service_role;

ALTER TABLE public.study_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own milestones"
  ON public.study_milestones FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_study_milestones_updated_at
  BEFORE UPDATE ON public.study_milestones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_study_milestones_user_cert
  ON public.study_milestones(user_certification_id, order_index);
