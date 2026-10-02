CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('book_a_call','results_gate','org_seats','other')),
  name text NOT NULL CHECK (char_length(name) <= 100),
  email text NOT NULL CHECK (char_length(email) <= 255),
  phone text NOT NULL CHECK (char_length(phone) <= 30),
  certs text,
  timing text,
  hear_about text,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  page_path text,
  submission_id text NOT NULL UNIQUE,
  ip_hash text,
  status text NOT NULL DEFAULT 'New',
  sheet_synced_at timestamptz,
  sheet_error text
);

CREATE INDEX leads_ip_hash_created_at_idx ON public.leads (ip_hash, created_at DESC);
CREATE INDEX leads_created_at_idx ON public.leads (created_at DESC);

GRANT SELECT ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can read leads"
ON public.leads FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));