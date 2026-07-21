-- Per-day check-off of which package facilities (meals + custom facilities)
-- a checked-in chalet guest has actually used. A row's existence means
-- "used" — front desk toggles it by inserting/deleting, no boolean flag
-- needed.
CREATE TABLE IF NOT EXISTS public.chalet_booking_facility_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.chalet_bookings(id) ON DELETE CASCADE,
    facility_key TEXT NOT NULL,
    facility_name TEXT NOT NULL,
    usage_date DATE NOT NULL,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (booking_id, facility_key, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_chalet_facility_usage_booking_id
  ON public.chalet_booking_facility_usage(booking_id);

ALTER TABLE public.chalet_booking_facility_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on chalet_booking_facility_usage" ON public.chalet_booking_facility_usage;
CREATE POLICY "Allow all on chalet_booking_facility_usage" ON public.chalet_booking_facility_usage FOR ALL USING (TRUE) WITH CHECK (TRUE);
