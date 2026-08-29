ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS owner_company TEXT,
  ADD COLUMN IF NOT EXISTS owner_address TEXT,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_mobile TEXT,
  ADD COLUMN IF NOT EXISTS billing_address TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS contact_telephone TEXT;

COMMENT ON COLUMN public.events.owner_name IS 'Primary customer or event owner name';
COMMENT ON COLUMN public.events.owner_company IS 'Company or organization arranging the event';
COMMENT ON COLUMN public.events.owner_address IS 'Residential or registered address of the event owner';
COMMENT ON COLUMN public.events.billing_address IS 'Address to print on event invoices and billing documents';
COMMENT ON COLUMN public.events.contact_person IS 'Operational contact person for the event';
COMMENT ON COLUMN public.events.contact_telephone IS 'Telephone number of the operational contact person';
