CREATE TABLE IF NOT EXISTS public.event_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.event_food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'main',
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'servings',
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  dietary_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  activity_time TIMESTAMPTZ,
  provider TEXT,
  cost NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS public.event_payment_receipt_seq START 1001;

CREATE TABLE IF NOT EXISTS public.event_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  receipt_number TEXT NOT NULL UNIQUE DEFAULT ('EVT-' || LPAD(nextval('public.event_payment_receipt_seq')::TEXT, 6, '0')),
  payer_name TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'online', 'other')),
  payment_type TEXT NOT NULL DEFAULT 'deposit' CHECK (payment_type IN ('deposit', 'installment', 'final', 'refund', 'other')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_payments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE v_table_name TEXT;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY['event_schedule_items', 'event_food_items', 'event_activities', 'event_payments']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table_name AND policyname = 'allow_all_' || v_table_name
    ) THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', 'allow_all_' || v_table_name, v_table_name);
    END IF;
  END LOOP;
END;
$$;

CREATE INDEX IF NOT EXISTS event_schedule_items_event_idx ON public.event_schedule_items(event_id, starts_at);
CREATE INDEX IF NOT EXISTS event_food_items_event_idx ON public.event_food_items(event_id);
CREATE INDEX IF NOT EXISTS event_activities_event_idx ON public.event_activities(event_id, activity_time);
CREATE INDEX IF NOT EXISTS event_payments_event_idx ON public.event_payments(event_id, paid_at DESC);
