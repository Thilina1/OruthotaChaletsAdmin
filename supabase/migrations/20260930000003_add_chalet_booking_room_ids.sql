ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS room_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS room_packages JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS room_guests JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.chalet_bookings
SET room_ids = ARRAY[room_id]
WHERE room_id IS NOT NULL
  AND (room_ids IS NULL OR cardinality(room_ids) = 0);

UPDATE public.chalet_bookings
SET room_packages = jsonb_build_object(room_id::text, package_id::text)
WHERE room_id IS NOT NULL
  AND package_id IS NOT NULL
  AND (room_packages IS NULL OR room_packages = '{}'::jsonb);

UPDATE public.chalet_bookings
SET room_guests = jsonb_build_object(room_id::text, jsonb_build_object('adults', COALESCE(adults, 1), 'children', COALESCE(children, 0)))
WHERE room_id IS NOT NULL
  AND (room_guests IS NULL OR room_guests = '{}'::jsonb);
