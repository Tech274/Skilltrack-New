
-- Lock down user_roles writes: only service_role may insert/update/delete.
-- Authenticated users keep SELECT (per existing policy) and may read their own role via has_role().
CREATE POLICY "Block authenticated role inserts"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Block authenticated role updates"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (false) WITH CHECK (false);

CREATE POLICY "Block authenticated role deletes"
  ON public.user_roles FOR DELETE TO authenticated
  USING (false);
