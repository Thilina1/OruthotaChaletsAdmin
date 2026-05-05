-- 1. Add missing metadata columns to Purchase Order Items
ALTER TABLE public.purchase_order_items 
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS supplier_name text,
ADD COLUMN IF NOT EXISTS item_size text,
ADD COLUMN IF NOT EXISTS batch_number text,
ADD COLUMN IF NOT EXISTS expiry_date date,
ADD COLUMN IF NOT EXISTS received_quantity numeric(10, 2);

-- 2. Add missing metadata columns to Inventory Requests
ALTER TABLE public.inventory_requests
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS supplier_name text,
ADD COLUMN IF NOT EXISTS item_size text;

-- 3. Update the unique index on hotel_inventory_items to include supplier
-- First, drop the old index if it exists
DROP INDEX IF EXISTS public.hotel_inventory_items_unique_batch_idx;

-- Create the refined unique index including supplier
CREATE UNIQUE INDEX IF NOT EXISTS hotel_inventory_items_unique_batch_idx 
ON public.hotel_inventory_items (
    product_id, 
    department_id, 
    COALESCE(batch_number, ''), 
    COALESCE(item_size, ''), 
    COALESCE(brand, ''), 
    COALESCE(supplier, '')
);

-- 4. Ensure batch_number uniqueness across different products (optional but recommended)
-- A batch number should ideally belong to only one product
-- (We use a partial index to ignore NULL/empty batches)
CREATE UNIQUE INDEX IF NOT EXISTS hotel_inventory_items_global_batch_idx
ON public.hotel_inventory_items (batch_number)
WHERE batch_number IS NOT NULL AND batch_number != '';
