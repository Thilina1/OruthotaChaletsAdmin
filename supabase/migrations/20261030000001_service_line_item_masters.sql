-- Master list of line items per service (Laundry, Transport & Excursion,
-- Spa/Pool, Experience). Service income records pick their line items from
-- this list; for Experience, default_amount is the rate per person.
CREATE TABLE IF NOT EXISTS public.service_line_item_masters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_type TEXT NOT NULL,
    name TEXT NOT NULL,
    default_amount NUMERIC NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_line_item_masters_type_name_key
    ON public.service_line_item_masters (service_type, lower(name));

ALTER TABLE public.service_line_item_masters ENABLE ROW LEVEL SECURITY;

-- Dropped first so the migration can be re-run safely.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.service_line_item_masters;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.service_line_item_masters;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.service_line_item_masters;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.service_line_item_masters;

CREATE POLICY "Enable read access for all users" ON public.service_line_item_masters FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.service_line_item_masters FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.service_line_item_masters FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.service_line_item_masters FOR DELETE USING (auth.role() = 'authenticated');
