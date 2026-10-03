ALTER TABLE public.chalet_rates
  ADD COLUMN IF NOT EXISTS usd_rate_per_night NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd_to_lkr_rate NUMERIC(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offer_name TEXT,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lkr_discount_type TEXT NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS lkr_discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lkr_discount_fixed_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd_discount_type TEXT NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS usd_discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS usd_discount_fixed_value NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.chalet_rates
  DROP CONSTRAINT IF EXISTS chalet_rates_lkr_discount_type_check;

ALTER TABLE public.chalet_rates
  ADD CONSTRAINT chalet_rates_lkr_discount_type_check CHECK (lkr_discount_type IN ('percentage', 'fixed'));

ALTER TABLE public.chalet_rates
  DROP CONSTRAINT IF EXISTS chalet_rates_usd_discount_type_check;

ALTER TABLE public.chalet_rates
  ADD CONSTRAINT chalet_rates_usd_discount_type_check CHECK (usd_discount_type IN ('percentage', 'fixed'));

ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'LKR';

ALTER TABLE public.chalet_bookings
  DROP CONSTRAINT IF EXISTS chalet_bookings_currency_check;

ALTER TABLE public.chalet_bookings
  ADD CONSTRAINT chalet_bookings_currency_check CHECK (currency IN ('LKR', 'USD'));
