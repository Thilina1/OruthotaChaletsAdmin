-- Create inventory_brands table
CREATE TABLE IF NOT EXISTS public.inventory_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create inventory_suppliers table
CREATE TABLE IF NOT EXISTS public.inventory_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.inventory_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policies (Allow authenticated users to read and insert)
DROP POLICY IF EXISTS "Allow authenticated to read brands" ON public.inventory_brands;
CREATE POLICY "Allow authenticated to read brands" ON public.inventory_brands FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert brands" ON public.inventory_brands;
CREATE POLICY "Allow authenticated to insert brands" ON public.inventory_brands FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated to read suppliers" ON public.inventory_suppliers;
CREATE POLICY "Allow authenticated to read suppliers" ON public.inventory_suppliers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated to insert suppliers" ON public.inventory_suppliers;
CREATE POLICY "Allow authenticated to insert suppliers" ON public.inventory_suppliers FOR INSERT TO authenticated WITH CHECK (true);

-- Function to sync metadata from transactions
CREATE OR REPLACE FUNCTION public.sync_inventory_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Sync Brand
    IF NEW.brand IS NOT NULL AND NEW.brand <> '' THEN
        INSERT INTO public.inventory_brands (name)
        VALUES (TRIM(NEW.brand))
        ON CONFLICT (name) DO NOTHING;
    END IF;

    -- Sync Supplier
    IF NEW.supplier IS NOT NULL AND NEW.supplier <> '' THEN
        INSERT INTO public.inventory_suppliers (name)
        VALUES (TRIM(NEW.supplier))
        ON CONFLICT (name) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for sync
DROP TRIGGER IF EXISTS trigger_sync_inventory_metadata ON public.inventory_transactions;
CREATE TRIGGER trigger_sync_inventory_metadata
AFTER INSERT ON public.inventory_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_inventory_metadata();

-- Pre-populate from existing transactions
INSERT INTO public.inventory_brands (name)
SELECT DISTINCT TRIM(brand) FROM public.inventory_transactions 
WHERE brand IS NOT NULL AND brand <> ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.inventory_suppliers (name)
SELECT DISTINCT TRIM(supplier) FROM public.inventory_transactions 
WHERE supplier IS NOT NULL AND supplier <> ''
ON CONFLICT (name) DO NOTHING;
