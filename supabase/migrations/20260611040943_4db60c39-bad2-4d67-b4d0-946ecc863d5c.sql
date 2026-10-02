
ALTER TABLE public.ai_extraction_jobs
  ADD COLUMN IF NOT EXISTS column_map jsonb,
  ADD COLUMN IF NOT EXISTS tabular_headers jsonb;
