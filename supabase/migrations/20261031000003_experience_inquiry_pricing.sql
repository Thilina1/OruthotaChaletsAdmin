-- Pricing entered on an experience inquiry, kept until staff edit it again:
-- { "service_charge_rate": 10, "tax_rate": 0, "other_charges": [{ "name": "Transport", "amount": 2500 }] }.
-- Each entry in experiences may also carry its own "rate" per person.
-- Billing starts from these values when the inquiry is confirmed.
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS pricing JSONB;

COMMENT ON COLUMN public.contact_messages.pricing IS
  'Service charge %, tax % and other charges entered on the experience inquiry.';
