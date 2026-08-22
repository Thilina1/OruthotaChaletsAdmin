-- Track kitchen preparation progress for each unit in an order line.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS prepared_quantity INTEGER NOT NULL DEFAULT 0;

-- Preserve the state of items that were completed before this column existed.
UPDATE public.order_items
SET prepared_quantity = quantity
WHERE kitchen_status IN ('ready', 'done')
  AND prepared_quantity = 0;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_prepared_quantity_nonnegative;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_prepared_quantity_nonnegative
  CHECK (prepared_quantity >= 0);

COMMENT ON COLUMN public.order_items.prepared_quantity IS
  'Number of units in this order line that the kitchen has marked ready.';
