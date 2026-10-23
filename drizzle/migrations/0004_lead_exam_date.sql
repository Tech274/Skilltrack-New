-- Target exam date for the public lead form on the home page and certification pages.
-- Reuses public.leads. Anonymous visitors may insert an exam_date row only.
-- They cannot select, update, or delete leads.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS target_exam_date date;

ALTER TABLE public.leads
  ALTER COLUMN name SET DEFAULT '';

ALTER TABLE public.leads
  ALTER COLUMN phone SET DEFAULT '';

-- The original source check is inline, so its name can vary. Drop every check that mentions source.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'leads'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN ('book_a_call', 'results_gate', 'org_seats', 'other', 'exam_date'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_exam_date_requires_target;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_exam_date_requires_target
  CHECK (source <> 'exam_date' OR target_exam_date IS NOT NULL);

COMMENT ON COLUMN public.leads.target_exam_date IS
  'Visitor-submitted exam date. Required when source is exam_date. Future dates are enforced by the API and the anon insert policy.';

-- Replace broad grants. anon gets column-limited INSERT and no read.
REVOKE ALL ON TABLE public.leads FROM PUBLIC;
REVOKE ALL ON TABLE public.leads FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.leads FROM authenticated;

GRANT SELECT ON TABLE public.leads TO authenticated;
GRANT ALL ON TABLE public.leads TO service_role;

GRANT INSERT (
  source,
  email,
  name,
  phone,
  certs,
  target_exam_date,
  page_path,
  submission_id,
  notes,
  utm_source,
  utm_medium,
  utm_campaign,
  timing,
  hear_about
) ON TABLE public.leads TO anon;

DROP POLICY IF EXISTS "Anon can insert exam date leads" ON public.leads;

CREATE POLICY "Anon can insert exam date leads"
ON public.leads
FOR INSERT
TO anon
WITH CHECK (
  source = 'exam_date'
  AND char_length(btrim(email)) BETWEEN 3 AND 255
  AND position('@' IN email) > 1
  AND target_exam_date IS NOT NULL
  AND target_exam_date > (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
  AND char_length(name) <= 100
  AND char_length(phone) <= 30
  AND (certs IS NULL OR char_length(certs) <= 200)
  AND (page_path IS NULL OR char_length(page_path) <= 200)
  AND (notes IS NULL OR char_length(notes) <= 1000)
  AND char_length(submission_id) BETWEEN 8 AND 64
);
