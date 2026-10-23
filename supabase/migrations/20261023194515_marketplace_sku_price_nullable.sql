-- Drop the historical 999 default on marketplace_skus.price_inr.
-- Existing rows are left unchanged. Rows that still store 999 are not a
-- quoted price: public pages render them as "Price on request".
-- New rows with no price store NULL.

ALTER TABLE public.marketplace_skus
  ALTER COLUMN price_inr DROP DEFAULT,
  ALTER COLUMN price_inr DROP NOT NULL;

COMMENT ON COLUMN public.marketplace_skus.price_inr IS
  'Price amount in the currency column (legacy name). NULL means no quoted price. Rows that still store the historical placeholder 999 are unchanged and render as Price on request.';
