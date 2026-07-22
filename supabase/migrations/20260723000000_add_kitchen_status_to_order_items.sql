-- Lets kitchen staff track prep progress per dish on the Kitchen Orders
-- display: pending (not started) -> preparing (started cooking) -> ready (done).
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS kitchen_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (kitchen_status IN ('pending', 'preparing', 'ready'));
