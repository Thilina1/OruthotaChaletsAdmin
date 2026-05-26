-- Add check_in_time and check_out_time columns to reservations table
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS check_in_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS check_out_time TIMESTAMPTZ;

-- Create function to automatically record check-in and check-out times
CREATE OR REPLACE FUNCTION public.record_reservation_times()
RETURNS TRIGGER AS $$
BEGIN
    -- If status transitions to 'checked-in'
    IF NEW.status = 'checked-in' AND (OLD.status IS NULL OR OLD.status <> 'checked-in') THEN
        IF NEW.check_in_time IS NULL THEN
            NEW.check_in_time := NOW();
        END IF;
    END IF;

    -- If status transitions to 'checked-out' or 'completed'
    IF NEW.status IN ('checked-out', 'completed') AND (OLD.status IS NULL OR OLD.status NOT IN ('checked-out', 'completed')) THEN
        IF NEW.check_out_time IS NULL THEN
            NEW.check_out_time := NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on reservations table
DROP TRIGGER IF EXISTS trg_record_reservation_times ON public.reservations;
CREATE TRIGGER trg_record_reservation_times
BEFORE INSERT OR UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.record_reservation_times();
