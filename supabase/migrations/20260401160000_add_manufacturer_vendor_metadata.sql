-- Create inventory_manufacturers table
CREATE TABLE IF NOT EXISTS public.inventory_manufacturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create inventory_vendors table
CREATE TABLE IF NOT EXISTS public.inventory_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_vendors ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies (Allow authenticated users to read and insert)
DROP POLICY IF EXISTS "Allow authenticated to read manufacturers" ON public.inventory_manufacturers;
CREATE POLICY "Allow authenticated to read manufacturers" ON public.inventory_manufacturers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert manufacturers" ON public.inventory_manufacturers;
CREATE POLICY "Allow authenticated to insert manufacturers" ON public.inventory_manufacturers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to read vendors" ON public.inventory_vendors;
CREATE POLICY "Allow authenticated to read vendors" ON public.inventory_vendors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert vendors" ON public.inventory_vendors;
CREATE POLICY "Allow authenticated to insert vendors" ON public.inventory_vendors FOR INSERT TO authenticated WITH CHECK (true);

-- Add Metadata columns to hotel_inventory_items and inventory_transactions
ALTER TABLE public.hotel_inventory_items ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.hotel_inventory_items ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE public.hotel_inventory_items ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.hotel_inventory_items ADD COLUMN IF NOT EXISTS vendor TEXT;

ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS vendor TEXT;

-- Update the sync_inventory_metadata function to include manufacturers and vendors
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

        -- Sync Manufacturer (from transactions)
        IF NEW.manufacturer IS NOT NULL AND NEW.manufacturer <> '' THEN
            INSERT INTO public.inventory_manufacturers (name)
            VALUES (TRIM(NEW.manufacturer))
            ON CONFLICT (name) DO NOTHING;
        END IF;

        -- Sync Vendor (from transactions)
        IF NEW.vendor IS NOT NULL AND NEW.vendor <> '' THEN
            INSERT INTO public.inventory_vendors (name)
            VALUES (TRIM(NEW.vendor))
            ON CONFLICT (name) DO NOTHING;
        END IF;

        -- Sync Size (from transactions)
        IF NEW.item_size IS NOT NULL AND NEW.item_size <> '' THEN
            INSERT INTO public.inventory_sizes (name)
            VALUES (TRIM(NEW.item_size))
            ON CONFLICT (name) DO NOTHING;
        END IF;
    END IF;

    -- Sync Unit (from items)
    IF TG_TABLE_NAME = 'hotel_inventory_items' THEN
        IF NEW.unit IS NOT NULL AND NEW.unit <> '' THEN
            INSERT INTO public.inventory_units (name)
            VALUES (TRIM(NEW.unit))
            ON CONFLICT (name) DO NOTHING;
        END IF;
        
        -- Also sync Brand, Supplier, Manufacturer, Vendor from items when updated
        IF NEW.brand IS NOT NULL AND NEW.brand <> '' THEN
            INSERT INTO public.inventory_brands (name)
            VALUES (TRIM(NEW.brand))
            ON CONFLICT (name) DO NOTHING;
        END IF;

        IF NEW.supplier IS NOT NULL AND NEW.supplier <> '' THEN
            INSERT INTO public.inventory_suppliers (name)
            VALUES (TRIM(NEW.supplier))
            ON CONFLICT (name) DO NOTHING;
        END IF;
        
        IF NEW.manufacturer IS NOT NULL AND NEW.manufacturer <> '' THEN
            INSERT INTO public.inventory_manufacturers (name)
            VALUES (TRIM(NEW.manufacturer))
            ON CONFLICT (name) DO NOTHING;
        END IF;

        IF NEW.vendor IS NOT NULL AND NEW.vendor <> '' THEN
            INSERT INTO public.inventory_vendors (name)
            VALUES (TRIM(NEW.vendor))
            ON CONFLICT (name) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure triggers exist on both tables (re-trigger creation to be safe)
DROP TRIGGER IF EXISTS trigger_sync_inventory_metadata ON public.inventory_transactions;
CREATE TRIGGER trigger_sync_inventory_metadata
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_metadata();

DROP TRIGGER IF EXISTS trigger_sync_inventory_metadata_items ON public.hotel_inventory_items;
CREATE TRIGGER trigger_sync_inventory_metadata_items
AFTER INSERT OR UPDATE OF unit, brand, supplier, manufacturer, vendor ON public.hotel_inventory_items
FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_metadata();
