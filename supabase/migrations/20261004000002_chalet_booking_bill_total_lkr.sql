-- The booking's full bill in LKR as calculated by the booking form: after the
-- coupon, with service charge / VAT / SSCL added only where the booking's
-- charge settings apply them to the guest's currency. Front Desk settlement charges this amount minus what
-- has already been paid. NULL for older bookings, which fall back to grand_total.
ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS bill_total_lkr NUMERIC(15,2);
