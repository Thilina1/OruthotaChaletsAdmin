-- Extras added on a chalet booking or at check-in: experiences, services
-- (laundry, transport, spa/pool) and buffet bookings, all charged to the
-- guest's room bill. Linking them to the booking lets the booking, the
-- Buffet Bookings page and the Front Desk show where each charge came from.
ALTER TABLE public.service_incomes
  ADD COLUMN IF NOT EXISTS chalet_booking_id UUID
    REFERENCES public.chalet_bookings(id) ON DELETE SET NULL,
  -- The buffet booking a 'Buffet' room-bill charge was raised for.
  ADD COLUMN IF NOT EXISTS table_booking_id UUID
    REFERENCES public.table_bookings(id) ON DELETE SET NULL;

ALTER TABLE public.table_bookings
  ADD COLUMN IF NOT EXISTS chalet_booking_id UUID
    REFERENCES public.chalet_bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_incomes_chalet_booking_id_idx
  ON public.service_incomes (chalet_booking_id)
  WHERE chalet_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS service_incomes_table_booking_id_idx
  ON public.service_incomes (table_booking_id)
  WHERE table_booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS table_bookings_chalet_booking_id_idx
  ON public.table_bookings (chalet_booking_id)
  WHERE chalet_booking_id IS NOT NULL;
