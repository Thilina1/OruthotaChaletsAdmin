-- Splits the final cooking step into two: 'ready' (food is cooked, waiting to
-- be picked up/served) and 'done' (confirmed served/collected) — the item only
-- drops off the Kitchen Orders board once it's 'done'.
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_kitchen_status_check;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_kitchen_status_check
  CHECK (kitchen_status IN ('pending', 'preparing', 'ready', 'done'));
