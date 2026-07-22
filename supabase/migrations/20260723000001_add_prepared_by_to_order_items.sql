-- Tracks who on the kitchen team actually cooked a dish, and when, for the
-- Kitchen Orders history view.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS prepared_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMPTZ;
