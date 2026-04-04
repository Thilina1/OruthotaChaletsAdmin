-- Create inventory_units table
CREATE TABLE IF NOT EXISTS public.inventory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create inventory_sizes table
CREATE TABLE IF NOT EXISTS public.inventory_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_sizes ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies
DROP POLICY IF EXISTS "Allow authenticated to read units" ON public.inventory_units;
CREATE POLICY "Allow authenticated to read units" ON public.inventory_units FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert units" ON public.inventory_units;
CREATE POLICY "Allow authenticated to insert units" ON public.inventory_units FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to read sizes" ON public.inventory_sizes;
CREATE POLICY "Allow authenticated to read sizes" ON public.inventory_sizes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert sizes" ON public.inventory_sizes;
CREATE POLICY "Allow authenticated to insert sizes" ON public.inventory_sizes FOR INSERT TO authenticated WITH CHECK (true);

-- Update the sync function to include units and sizes
CREATE OR REPLACE FUNCTION public.sync_inventory_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync Brand (from transactions)
    IF TG_TABLE_NAME = 'inventory_transactions' THEN
        IF NEW.brand IS NOT NULL AND NEW.brand <> '' THEN
            INSERT INTO public.inventory_brands (name)
            VALUES (TRIM(NEW.brand))
            ON CONFLICT (name) DO NOTHING;
        END IF;

        -- Sync Supplier (from transactions)
        IF NEW.supplier IS NOT NULL AND NEW.supplier <> '' THEN
            INSERT INTO public.inventory_suppliers (name)
            VALUES (TRIM(NEW.supplier))
            ON CONFLICT (name) DO NOTHING;
        END IF;

        -- Sync Size (from transactions)
        IF NEW.item_size IS NOT NULL AND NEW.item_size <> '' THEN
            INSERT INTO public.inventory_sizes (name)
            VALUES (TRIM(NEW.item_size))
            ON CONFLICT (name) DO NOTHING;
        END IF;
    END IF;

    -- Sync Unit (can come from either items or transactions if item expanded)
    -- For safety, we'll sync from both to ensure we capture newly created units
    IF TG_TABLE_NAME = 'hotel_inventory_items' THEN
        IF NEW.unit IS NOT NULL AND NEW.unit <> '' THEN
            INSERT INTO public.inventory_units (name)
            VALUES (TRIM(NEW.unit))
            ON CONFLICT (name) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure triggers exist on both tables
DROP TRIGGER IF EXISTS trigger_sync_inventory_metadata ON public.inventory_transactions;
CREATE TRIGGER trigger_sync_inventory_metadata
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_metadata();

DROP TRIGGER IF EXISTS trigger_sync_inventory_metadata_items ON public.hotel_inventory_items;
CREATE TRIGGER trigger_sync_inventory_metadata_items
AFTER INSERT OR UPDATE OF unit ON public.hotel_inventory_items
FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_metadata();

-- Pre-populate Units from existing items
INSERT INTO public.inventory_units (name)
SELECT DISTINCT TRIM(unit) FROM public.hotel_inventory_items 
WHERE unit IS NOT NULL AND unit <> ''
ON CONFLICT (name) DO NOTHING;

-- Pre-populate Sizes from existing transactions
INSERT INTO public.inventory_sizes (name)
SELECT DISTINCT TRIM(item_size) FROM public.inventory_transactions 
WHERE item_size IS NOT NULL AND item_size <> ''
ON CONFLICT (name) DO NOTHING;
