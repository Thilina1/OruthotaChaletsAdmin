-- Comprehensive Inventory Normalization Migration
-- Transitions from flattened stock to a Batch-wise tracking system.

-- 1. Create the inventory_batches table
CREATE TABLE IF NOT EXISTS public.inventory_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id uuid NOT NULL REFERENCES public.hotel_inventory_products(id) ON DELETE CASCADE,
    batch_number text DEFAULT '',
    supplier text DEFAULT '',
    buying_price numeric(10, 2) DEFAULT 0,
    expiry_date date,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Index for fast variant-batch lookups
CREATE INDEX IF NOT EXISTS inventory_batches_product_id_idx ON public.inventory_batches (product_id);
-- Unique index to prevent duplicate batch definitions for the same product variant
CREATE UNIQUE INDEX IF NOT EXISTS inventory_batches_unique_idx 
ON public.inventory_batches (product_id, COALESCE(batch_number, ''), COALESCE(supplier, ''), COALESCE(expiry_date, '1900-01-01'::date), buying_price);

-- 2. Update hotel_inventory_items (Stock Table)
ALTER TABLE public.hotel_inventory_items 
ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.inventory_batches(id) ON DELETE CASCADE;

-- 3. Data Migration: Pull batch info from items into the new batches table
DO $$
DECLARE
    item_record RECORD;
    new_batch_id uuid;
BEGIN
    FOR item_record IN 
        SELECT DISTINCT product_id, COALESCE(batch_number, '') as batch_number, COALESCE(supplier, '') as supplier, 
                        buying_price, expiry_date
        FROM public.hotel_inventory_items 
        WHERE product_id IS NOT NULL
    LOOP
        -- Insert unique batch
        INSERT INTO public.inventory_batches (product_id, batch_number, supplier, buying_price, expiry_date)
        VALUES (item_record.product_id, item_record.batch_number, item_record.supplier, item_record.buying_price, item_record.expiry_date)
        ON CONFLICT (product_id, COALESCE(batch_number, ''), COALESCE(supplier, ''), COALESCE(expiry_date, '1900-01-01'::date), buying_price) 
        DO UPDATE SET updated_at = now()
        RETURNING id INTO new_batch_id;

        -- Update items pointing to this batch combination
        UPDATE public.hotel_inventory_items
        SET batch_id = new_batch_id
        WHERE product_id = item_record.product_id 
          AND COALESCE(batch_number, '') = item_record.batch_number 
          AND COALESCE(supplier, '') = item_record.supplier 
          AND buying_price = item_record.buying_price 
          AND (expiry_date = item_record.expiry_date OR (expiry_date IS NULL AND item_record.expiry_date IS NULL));
    END LOOP;
END $$;

-- 4. Finalize hot_inventory_items (Stock Location Uniqueness)
-- Drop the old huge composite index
DROP INDEX IF EXISTS public.hotel_inventory_items_unique_batch_idx;

-- Create the refined location-based unique index
CREATE UNIQUE INDEX IF NOT EXISTS hotel_inventory_items_location_batch_unique_idx 
ON public.hotel_inventory_items (department_id, batch_id);

-- 5. Update Transactions for Batch Tracking
ALTER TABLE public.inventory_transactions 
ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.inventory_batches(id);

-- Update existing transactions to point to their new bath_id if possible
UPDATE public.inventory_transactions t
SET batch_id = i.batch_id
FROM public.hotel_inventory_items i
WHERE t.item_id = i.id;

-- 6. Add Cross-Warehouse Transfer support to Transactions
ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS from_department_id uuid REFERENCES public.inventory_departments(id),
ADD COLUMN IF NOT EXISTS to_department_id uuid REFERENCES public.inventory_departments(id);
