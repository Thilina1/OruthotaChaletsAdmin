-- Rename total_price to total_cost in reservations table
ALTER TABLE public.reservations RENAME COLUMN total_price TO total_cost;

-- Correct the existing total_cost for reservations
-- We'll assume total_cost should be (nights * price_per_night)
-- For DATE columns, (check_out - check_in) returns integer days.
-- We use GREATEST(..., 1) to handle same-day check-in/out as 1 night.
UPDATE public.reservations r
SET total_cost = (
    SELECT GREATEST(r.check_out_date - r.check_in_date, 1) * rm.price_per_night
    FROM public.rooms rm
    WHERE rm.id = r.room_id
)
WHERE r.room_id IS NOT NULL;
