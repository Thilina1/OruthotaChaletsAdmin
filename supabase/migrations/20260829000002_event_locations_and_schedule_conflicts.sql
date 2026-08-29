CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Exclusion-index expressions must be immutable. The built-in timestamptz +
-- interval operator is only STABLE, even though this fixed one-hour offset is
-- timezone-independent.
CREATE OR REPLACE FUNCTION public.event_effective_ends_at(
  event_starts_at TIMESTAMPTZ,
  event_ends_at TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT COALESCE(event_ends_at, event_starts_at + INTERVAL '1 hour');
$$;

CREATE TABLE IF NOT EXISTS public.event_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.event_locations(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_valid_time_range') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_valid_time_range CHECK (ends_at IS NULL OR ends_at > starts_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_location_schedule_no_overlap') THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_location_schedule_no_overlap
      EXCLUDE USING gist (
        location_id WITH =,
        tstzrange(starts_at, public.event_effective_ends_at(starts_at, ends_at), '[)') WITH &&
      )
      WHERE (location_id IS NOT NULL AND status <> 'cancelled');
  END IF;
END;
$$;

ALTER TABLE public.event_locations ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_locations' AND policyname = 'allow_all_event_locations') THEN
    CREATE POLICY "allow_all_event_locations" ON public.event_locations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS events_location_idx ON public.events(location_id);
CREATE INDEX IF NOT EXISTS event_locations_active_idx ON public.event_locations(is_active);
