-- Store the waiter-facing presented/not-presented reference.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS served_quantity INTEGER NOT NULL DEFAULT 0;

-- Preserve completed items from the previous kitchen workflow.
UPDATE public.order_items
SET served_quantity = quantity
WHERE kitchen_status = 'done'
  AND served_quantity = 0;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_served_quantity_nonnegative;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_served_quantity_nonnegative
  CHECK (served_quantity >= 0);

COMMENT ON COLUMN public.order_items.served_quantity IS
  'Presentation reference: 0 means not presented; the order-line quantity means presented.';
