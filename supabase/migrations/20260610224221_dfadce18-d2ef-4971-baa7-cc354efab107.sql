ALTER TABLE public.ai_action_audit ADD COLUMN IF NOT EXISTS prompt_version_id uuid REFERENCES public.ai_prompt_versions(id) ON DELETE SET NULL;
ALTER TABLE public.ai_extraction_jobs ADD COLUMN IF NOT EXISTS prompt_version_id uuid REFERENCES public.ai_prompt_versions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ai_audit_prompt_version ON public.ai_action_audit(prompt_version_id);