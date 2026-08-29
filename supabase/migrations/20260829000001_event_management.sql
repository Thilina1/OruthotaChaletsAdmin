CREATE EXTENSION IF NOT EXISTS btree_gist;

-- PostgreSQL marks timestamptz + interval as STABLE, so it cannot appear
-- directly in the GiST expression used by the exclusion constraint. A fixed
-- one-hour offset is timezone-independent and can safely be exposed as an
-- immutable helper.
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

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'private',
  location_id UUID REFERENCES public.event_locations(id),
  venue TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_location_schedule_no_overlap'
  ) THEN
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

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  guests INTEGER NOT NULL DEFAULT 1 CHECK (guests > 0),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  booking_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (booking_status IN ('pending', 'confirmed', 'checked_in', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_type TEXT NOT NULL DEFAULT 'expense' CHECK (budget_type IN ('income', 'expense')),
  estimated_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (estimated_amount >= 0),
  actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (actual_amount >= 0),
  payment_status TEXT NOT NULL DEFAULT 'planned' CHECK (payment_status IN ('planned', 'approved', 'paid', 'received')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'planning',
  assigned_to UUID REFERENCES public.users(id),
  assigned_name TEXT,
  due_at TIMESTAMPTZ,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  automation_rule TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_workflow_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_events" ON public.events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_event_locations" ON public.event_locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_event_registrations" ON public.event_registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_event_budget_items" ON public.event_budget_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_event_workflow_tasks" ON public.event_workflow_tasks FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS events_starts_at_idx ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS events_location_idx ON public.events(location_id);
CREATE INDEX IF NOT EXISTS event_locations_active_idx ON public.event_locations(is_active);
CREATE INDEX IF NOT EXISTS event_registrations_event_idx ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS event_budget_items_event_idx ON public.event_budget_items(event_id);
CREATE INDEX IF NOT EXISTS event_workflow_tasks_event_idx ON public.event_workflow_tasks(event_id);
CREATE INDEX IF NOT EXISTS event_workflow_tasks_due_idx ON public.event_workflow_tasks(due_at);
