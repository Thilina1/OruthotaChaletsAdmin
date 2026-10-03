ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS payment_option TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_notes TEXT;

ALTER TABLE public.chalet_bookings
  DROP CONSTRAINT IF EXISTS chalet_bookings_payment_option_check,
  ADD CONSTRAINT chalet_bookings_payment_option_check
    CHECK (payment_option IN ('none', 'half', 'full', 'custom'));

ALTER TABLE public.chalet_bookings
  DROP CONSTRAINT IF EXISTS chalet_bookings_payment_method_check,
  ADD CONSTRAINT chalet_bookings_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'bank_transfer', 'online'));
