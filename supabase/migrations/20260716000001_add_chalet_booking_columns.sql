-- The live chalet_bookings table pre-dates some columns in the original
-- CREATE TABLE IF NOT EXISTS migration, so those columns were never added.
-- Add them here idempotently.
-- Note: subtotal, service_charge, and total_amount already exist on the live
-- table as GENERATED ALWAYS ... STORED columns, so they're intentionally
-- omitted here and are no longer sent by the app on insert.
ALTER TABLE chalet_bookings
  ADD COLUMN IF NOT EXISTS customer_nic text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS adults int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS children int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS special_requests text,
  ADD COLUMN IF NOT EXISTS rate_per_night numeric,
  ADD COLUMN IF NOT EXISTS total_nights int;
