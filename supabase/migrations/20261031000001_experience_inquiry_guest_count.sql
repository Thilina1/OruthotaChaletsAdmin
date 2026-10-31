-- Number of people an experience inquiry is for. Billing uses it as the
-- starting headcount for each experience.
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS guest_count INTEGER
    CHECK (guest_count IS NULL OR guest_count > 0);

COMMENT ON COLUMN public.contact_messages.guest_count IS
  'Number of people the experience inquiry is for.';
