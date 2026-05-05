-- 1. Create Hotel Inventory Products (Master Table)
CREATE TABLE IF NOT EXISTS public.hotel_inventory_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    category text CHECK (category IN (
        'Food & Beverage',
        'Cleaning Materials & Chemicals',
        'Guest Amenities',
        'Linen & Fabrics',
        'Maintenance & Hardware',
        'Garden Supplies',
        'Stationery & Packaging',
        'Crockery, Cutlery & Glassware',
        'Kitchen Utensils',
        'Staff Uniforms',
        'Fuel & Gas',
        'First Aid & Safety'
    )),
    unit text CHECK (unit IN ('kg', 'packets', 'L', 'bottles', 'Nos', 'rolls', 'tins', 'reams', 'cylinders', 'cards', 'box', 'bundles')),
    safety_stock numeric(10, 2) DEFAULT 0,
    reorder_level numeric(10, 2) DEFAULT 0,
    maximum_level numeric(10, 2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Ensure names are unique to prevent duplicate definitions
CREATE UNIQUE INDEX IF NOT EXISTS hotel_inventory_products_name_idx ON public.hotel_inventory_products (name);

-- 2. Add product_id to items
ALTER TABLE public.hotel_inventory_items ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.hotel_inventory_products(id);

-- 3. Data Migration: Extract unique records and link them
DO $$
BEGIN
    -- Populate products from unique names in items
    -- Use DISTINCT ON (name) to ensure we only get ONE row per product name
    -- otherwise multiple rows with same name but different description/safety_stock etc 
    -- will cause the "ON CONFLICT DO UPDATE command cannot affect row a second time" error.
    INSERT INTO public.hotel_inventory_products (name, description, category, unit, safety_stock, reorder_level, maximum_level)
    SELECT DISTINCT ON (name) name, description, category, unit, safety_stock, reorder_level, maximum_level
    FROM public.hotel_inventory_items
    ORDER BY name, created_at DESC
    ON CONFLICT (name) DO UPDATE SET 
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        unit = EXCLUDED.unit;

    -- Link items to products
    UPDATE public.hotel_inventory_items i
    SET product_id = p.id
    FROM public.hotel_inventory_products p
    WHERE i.name = p.name;
END $$;

-- 4. Clean up items table (optional: remove columns that now live in products)
-- We'll keep them for now to avoid breaking existing queries until API is updated

-- 5. Add a unique constraint to items to ensure batch-wise separation
-- (Wait: we only add this after we are sure duplicates are handled)
-- Actually, let's just make it a composite unique index
CREATE UNIQUE INDEX IF NOT EXISTS hotel_inventory_items_unique_batch_idx 
ON public.hotel_inventory_items (product_id, department_id, COALESCE(batch_number, ''), COALESCE(item_size, ''), COALESCE(brand, ''));

-- 6. Update inventory_transactions and inventory_requests to point to products if needed?
-- No, they should point to the specific batch (item_id) for accurate stock tracking.
