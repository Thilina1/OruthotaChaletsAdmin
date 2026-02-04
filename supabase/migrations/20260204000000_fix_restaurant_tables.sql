-- Create restaurant_tables table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.restaurant_tables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_number INTEGER NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'available', -- available, occupied, reserved, cleaning
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safely add location column if it doesn't exist (in case table existed but column didn't)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurant_tables' AND column_name = 'location') THEN
        ALTER TABLE public.restaurant_tables ADD COLUMN location TEXT;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON public.restaurant_tables;
CREATE POLICY "Allow read access for all authenticated users" ON public.restaurant_tables
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.restaurant_tables;
CREATE POLICY "Allow insert for authenticated users" ON public.restaurant_tables
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.restaurant_tables;
CREATE POLICY "Allow update for authenticated users" ON public.restaurant_tables
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.restaurant_tables;
CREATE POLICY "Allow delete for authenticated users" ON public.restaurant_tables
    FOR DELETE TO authenticated USING (true);
