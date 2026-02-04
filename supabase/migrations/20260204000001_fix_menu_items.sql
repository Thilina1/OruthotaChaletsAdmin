-- Create menu_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    buying_price NUMERIC NOT NULL DEFAULT 0,
    category TEXT NOT NULL,
    availability BOOLEAN DEFAULT true,
    stock_type TEXT DEFAULT 'Non-Inventoried',
    stock INTEGER,
    sell_type TEXT DEFAULT 'Direct',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add columns safely if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'buying_price') THEN
        ALTER TABLE public.menu_items ADD COLUMN buying_price NUMERIC DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'stock_type') THEN
        ALTER TABLE public.menu_items ADD COLUMN stock_type TEXT DEFAULT 'Non-Inventoried';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'stock') THEN
        ALTER TABLE public.menu_items ADD COLUMN stock INTEGER;
    END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'sell_type') THEN
        ALTER TABLE public.menu_items ADD COLUMN sell_type TEXT DEFAULT 'Direct';
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON public.menu_items;
CREATE POLICY "Allow read access for all authenticated users" ON public.menu_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.menu_items;
CREATE POLICY "Allow insert for authenticated users" ON public.menu_items
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.menu_items;
CREATE POLICY "Allow update for authenticated users" ON public.menu_items
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.menu_items;
CREATE POLICY "Allow delete for authenticated users" ON public.menu_items
    FOR DELETE TO authenticated USING (true);
