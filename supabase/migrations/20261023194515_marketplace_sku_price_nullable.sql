-- Drop the historical 999 default on marketplace_skus.price_inr, then clear
-- rows that still store that placeholder. A missing price is NULL.
-- Only NULL renders as "Price on request".

ALTER TABLE public.marketplace_skus
  ALTER COLUMN price_inr DROP DEFAULT,
  ALTER COLUMN price_inr DROP NOT NULL;

UPDATE public.marketplace_skus
SET price_inr = NULL
WHERE price_inr = 999;

COMMENT ON COLUMN public.marketplace_skus.price_inr IS
  'Price amount in the currency column (legacy name). NULL means no quoted price and renders as Price on request.';
