ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS room_allocations JSONB NOT NULL DEFAULT '[]'::jsonb;
