ALTER TABLE public.inventory_items
ADD COLUMN IF NOT EXISTS brand text;

COMMENT ON COLUMN public.inventory_items.brand
IS 'Optional brand or manufacturer label for the inventory item.';
