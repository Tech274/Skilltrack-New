
-- =========================================================
-- 1. Certifications catalog
-- =========================================================
CREATE TABLE public.certifications_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  code text,
  vendor text,
  category text,
  level text,
  tagline text,
  description text,
  thumbnail_url text,
  cost_usd numeric(10,2),
  duration_minutes int,
  passing_score numeric(5,2),
  validity_years int,
  skills text[] DEFAULT '{}',
  learning_outcomes text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certifications_catalog TO authenticated;
GRANT ALL ON public.certifications_catalog TO service_role;

ALTER TABLE public.certifications_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "everyone reads published certifications"
  ON public.certifications_catalog FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role,'support_admin'::app_role])
  );

CREATE POLICY "content writes certifications"
  ON public.certifications_catalog FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]));

CREATE TRIGGER trg_cc_touch BEFORE UPDATE ON public.certifications_catalog
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 2. Mock exams (configuration)
-- =========================================================
CREATE TABLE public.mock_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  certification_slug text,
  duration_minutes int NOT NULL DEFAULT 60,
  passing_score numeric(5,2) NOT NULL DEFAULT 70,
  attempts_allowed int NOT NULL DEFAULT 3,
  randomize_questions boolean NOT NULL DEFAULT true,
  negative_marking boolean NOT NULL DEFAULT false,
  access_tier text NOT NULL DEFAULT 'free' CHECK (access_tier IN ('free','paid')),
  required_plan text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  total_questions int NOT NULL DEFAULT 0,
  total_marks numeric(8,2) NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mock_exams_status_idx ON public.mock_exams(status);
CREATE INDEX mock_exams_cert_idx ON public.mock_exams(certification_slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_exams TO authenticated;
GRANT ALL ON public.mock_exams TO service_role;

ALTER TABLE public.mock_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "everyone reads published mock exams"
  ON public.mock_exams FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role,'support_admin'::app_role])
  );

CREATE POLICY "content writes mock exams"
  ON public.mock_exams FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]));

CREATE TRIGGER trg_me_touch BEFORE UPDATE ON public.mock_exams
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 3. Mock exam questions
-- =========================================================
CREATE TABLE public.mock_exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.mock_exams(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'single' CHECK (question_type IN ('single','multi','true_false','scenario','case_study')),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  marks numeric(6,2) NOT NULL DEFAULT 1,
  negative_marks numeric(6,2) NOT NULL DEFAULT 0,
  explanation text,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX meq_exam_idx ON public.mock_exam_questions(exam_id, order_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mock_exam_questions TO authenticated;
GRANT ALL ON public.mock_exam_questions TO service_role;

ALTER TABLE public.mock_exam_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read questions of accessible exams"
  ON public.mock_exam_questions FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role,'support_admin'::app_role])
    OR EXISTS (SELECT 1 FROM public.mock_exams e WHERE e.id = exam_id AND e.status = 'published')
  );

CREATE POLICY "content writes questions"
  ON public.mock_exam_questions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]));

CREATE TRIGGER trg_meq_touch BEFORE UPDATE ON public.mock_exam_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 4. study_resources: file metadata columns
-- =========================================================
ALTER TABLE public.study_resources
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS file_mime text,
  ADD COLUMN IF NOT EXISTS duration_seconds int,
  ADD COLUMN IF NOT EXISTS storage_path text;

-- =========================================================
-- 5. Storage policies for `content-files` bucket
-- (Bucket itself is created via supabase--storage_create_bucket tool)
-- =========================================================
CREATE POLICY "content admins read content files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'content-files'
    AND (
      public.is_super_admin(auth.uid())
      OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role,'support_admin'::app_role])
    )
  );

CREATE POLICY "content admins write content files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'content-files'
    AND (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]))
  );

CREATE POLICY "content admins update content files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'content-files'
    AND (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]))
  );

CREATE POLICY "content admins delete content files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'content-files'
    AND (public.is_super_admin(auth.uid()) OR public.is_admin_role(auth.uid(), ARRAY['admin'::app_role,'content_admin'::app_role]))
  );
