-- Adds an "inactive" chalet status: the chalet is kept (with its booking
-- history) but is no longer offered for new bookings or room assignments.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.chalet_rooms'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.chalet_rooms DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.chalet_rooms
  ADD CONSTRAINT chalet_rooms_status_check
  CHECK (status IN ('available', 'occupied', 'maintenance', 'cleaning', 'inactive'));
