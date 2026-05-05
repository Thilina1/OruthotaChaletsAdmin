-- Refine Product Identity in Hotel Inventory
-- Adds Brand and Size to the master product table to allow for variant-aware master records.

-- 1. Add columns to hotel_inventory_products
ALTER TABLE public.hotel_inventory_products 
ADD COLUMN IF NOT EXISTS brand text DEFAULT '',
ADD COLUMN IF NOT EXISTS item_size text DEFAULT '';

-- 2. Drop the old name-only unique index
DROP INDEX IF EXISTS public.hotel_inventory_products_name_idx;

-- 3. Create the new composite unique index
CREATE UNIQUE INDEX IF NOT EXISTS hotel_inventory_products_identity_idx 
ON public.hotel_inventory_products (name, COALESCE(brand, ''), COALESCE(item_size, ''));

-- 4. Data Migration: Ensure every unique (name, brand, size) in items has a unique product record
DO $$
DECLARE
    item_record RECORD;
    new_product_id uuid;
BEGIN
    -- For each unique (name, brand, size) in items
    FOR item_record IN 
        SELECT DISTINCT name, COALESCE(brand, '') as brand, COALESCE(item_size, '') as item_size, category, unit
        FROM public.hotel_inventory_items
    LOOP
        -- Check if a product already exists with this combination
        -- We use ON CONFLICT DO NOTHING later, but let's be explicit and find or create.
        INSERT INTO public.hotel_inventory_products (name, brand, item_size, category, unit)
        VALUES (item_record.name, item_record.brand, item_record.item_size, item_record.category, item_record.unit)
        ON CONFLICT (name, COALESCE(brand, ''), COALESCE(item_size, '')) DO UPDATE SET
            category = EXCLUDED.category,
            unit = EXCLUDED.unit
        RETURNING id INTO new_product_id;

        -- Update all items with this triplet to point to this product_id
        UPDATE public.hotel_inventory_items
        SET product_id = new_product_id
        WHERE name = item_record.name 
          AND COALESCE(brand, '') = item_record.brand 
          AND COALESCE(item_size, '') = item_record.item_size;
    END LOOP;
END $$;

-- 5. Cleanup: Optional - verify if any products are now 'orphans' (redundant generic ones)
-- We'll keep them for now, but the standard GRN will use the triplet-based ones.
