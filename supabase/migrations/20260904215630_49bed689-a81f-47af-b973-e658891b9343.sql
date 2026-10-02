INSERT INTO public.learning_paths (org_id, title, description, target_certification_slug, difficulty, estimated_hours, steps, prerequisites, assessments, status)
SELECT
  NULL,
  c.name || ' Prep Path',
  'Structured study plan for ' || c.name || ' covering every exam domain, with a practice-exam checkpoint before you book.',
  c.slug,
  COALESCE(c.level, 'Intermediate'),
  CASE COALESCE(c.level,'Intermediate')
    WHEN 'Beginner' THEN 45 WHEN 'Intermediate' THEN 70 WHEN 'Advanced' THEN 105 WHEN 'Expert' THEN 150 ELSE 70 END,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'order', s.ord,
        'title', 'Study: ' || s.outcome,
        'type', 'study',
        'hours', GREATEST(4, ROUND((CASE COALESCE(c.level,'Intermediate')
            WHEN 'Beginner' THEN 45 WHEN 'Intermediate' THEN 70 WHEN 'Advanced' THEN 105 WHEN 'Expert' THEN 150 ELSE 70 END)::numeric
            / GREATEST(array_length(c.learning_outcomes,1),1)))
      ) ORDER BY s.ord), '[]'::jsonb)
    FROM unnest(c.learning_outcomes) WITH ORDINALITY AS s(outcome, ord)
  )
  || jsonb_build_array(
      jsonb_build_object('order', COALESCE(array_length(c.learning_outcomes,1),0) + 1, 'title', 'Full-length practice exam and gap review', 'type', 'practice', 'hours', 6),
      jsonb_build_object('order', COALESCE(array_length(c.learning_outcomes,1),0) + 2, 'title', 'Book and sit the ' || COALESCE(c.code, c.name) || ' exam', 'type', 'exam', 'hours', 3)
  ),
  '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('title', 'Practice exam', 'passing_score', COALESCE(c.passing_score, 70))),
  'published'
FROM public.certifications_catalog c
WHERE c.status = 'published'
  AND c.org_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.learning_paths lp
    WHERE lp.target_certification_slug = c.slug AND lp.org_id IS NULL
  );