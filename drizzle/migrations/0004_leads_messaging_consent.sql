-- DPDP messaging consent for public lead forms.
-- Not applied by this change. Apply this file when you are ready to migrate the live database.
-- Until then, the lead API stores consent and its timestamp in leads.notes.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS messaging_consent boolean,
  ADD COLUMN IF NOT EXISTS messaging_consent_at timestamptz;

COMMENT ON COLUMN public.leads.messaging_consent IS
  'Explicit consent to be contacted by email, phone, WhatsApp, or Telegram.';
COMMENT ON COLUMN public.leads.messaging_consent_at IS
  'Timestamp when messaging_consent was given.';
