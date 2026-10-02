ALTER TABLE public.marketplace_skus ADD COLUMN currency text NOT NULL DEFAULT 'INR';
ALTER TABLE public.marketplace_skus ADD CONSTRAINT marketplace_skus_currency_check CHECK (currency IN ('INR','USD','CAD','EUR'));
COMMENT ON COLUMN public.marketplace_skus.price_inr IS 'Price amount, denominated in the currency column (legacy name).';

CREATE TABLE public.fx_rates (
  base text NOT NULL DEFAULT 'INR' PRIMARY KEY,
  rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fx_rates TO authenticated;
GRANT ALL ON public.fx_rates TO service_role;
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read fx rates" ON public.fx_rates FOR SELECT TO authenticated USING (true);