-- Maintenance blocks: a chalet is closed from start_date start_time to
-- end_date end_time. A booking cannot use the chalet if its stay hours
-- (check-in time on arrival day to check-out time on departure day)
-- overlap the block. Whole days use 00:00 to 23:59.
CREATE TABLE IF NOT EXISTS public.chalet_room_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.chalet_rooms(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME NOT NULL DEFAULT '00:00',
  end_time TIME NOT NULL DEFAULT '23:59',
  reason TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

-- In case the table was created before the time columns existed.
ALTER TABLE public.chalet_room_blocks
  ADD COLUMN IF NOT EXISTS start_time TIME NOT NULL DEFAULT '00:00',
  ADD COLUMN IF NOT EXISTS end_time TIME NOT NULL DEFAULT '23:59';

CREATE INDEX IF NOT EXISTS chalet_room_blocks_room_dates_idx
  ON public.chalet_room_blocks(room_id, start_date, end_date);

ALTER TABLE public.chalet_room_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_chalet_room_blocks" ON public.chalet_room_blocks;
CREATE POLICY "allow_all_chalet_room_blocks"
  ON public.chalet_room_blocks FOR ALL USING (true) WITH CHECK (true);
