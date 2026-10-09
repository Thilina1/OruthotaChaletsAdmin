ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS service_charge_currency TEXT NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS vat_currency TEXT NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS sscl_currency TEXT NOT NULL DEFAULT 'both';

ALTER TABLE public.chalet_bookings
  DROP CONSTRAINT IF EXISTS chalet_bookings_service_charge_currency_check,
  ADD CONSTRAINT chalet_bookings_service_charge_currency_check
    CHECK (service_charge_currency IN ('LKR', 'USD', 'both'));

ALTER TABLE public.chalet_bookings
  DROP CONSTRAINT IF EXISTS chalet_bookings_vat_currency_check,
  ADD CONSTRAINT chalet_bookings_vat_currency_check
    CHECK (vat_currency IN ('LKR', 'USD', 'both'));

ALTER TABLE public.chalet_bookings
  DROP CONSTRAINT IF EXISTS chalet_bookings_sscl_currency_check,
  ADD CONSTRAINT chalet_bookings_sscl_currency_check
    CHECK (sscl_currency IN ('LKR', 'USD', 'both'));
