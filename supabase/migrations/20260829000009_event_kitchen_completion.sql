ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS kitchen_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS kitchen_completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kitchen_completed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS kitchen_completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_kitchen_status_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events ADD CONSTRAINT events_kitchen_status_check
      CHECK (kitchen_status IN ('pending', 'in_progress', 'completed'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS events_kitchen_status_idx ON public.events(kitchen_status, starts_at);
