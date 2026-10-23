-- Target exam date for leads saved by /api/public/lead.
-- Nullable so existing rows and leads without an exam date stay valid.
-- Browser clients cannot write leads. The server endpoint uses the service
-- role, which bypasses row-level security. This file does not change grants
-- or policies.
-- Journal slot 0005, after 0004_leads_messaging_consent. Apply only once that
-- consent migration is on production.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS target_exam_date date;

COMMENT ON COLUMN public.leads.target_exam_date IS
  'Visitor-submitted exam date. Null when the visitor did not give one. The public API omits this column until it exists.';

-- Replace the source check only when it does not already allow exam_date.
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
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%exam_date%'
  LOOP
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN ('book_a_call', 'results_gate', 'org_seats', 'other', 'exam_date'));

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_exam_date_requires_target;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_exam_date_requires_target
  CHECK (source <> 'exam_date' OR target_exam_date IS NOT NULL);
