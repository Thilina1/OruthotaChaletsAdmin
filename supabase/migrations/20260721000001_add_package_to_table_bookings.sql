-- Let a buffet table booking be linked to a buffet package, with a snapshot
-- of the computed charges at booking time (so later edits to the package's
-- prices/rates don't retroactively change past bookings).
ALTER TABLE table_bookings
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.buffet_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_per_guest NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_charge_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Note: the existing "Anyone can book a buffet" INSERT policy (WITH CHECK true)
-- already permits the admin dashboard's browser client to insert bookings too,
-- so no new RLS policy is needed here.
