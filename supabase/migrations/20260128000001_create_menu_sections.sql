-- Create menu_sections table
CREATE TABLE IF NOT EXISTS public.menu_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing public access for now as per previous patterns, or admin only if strict)
-- For simplicity and consistency with restaurant_sections:
CREATE POLICY "Enable read access for all users" ON public.menu_sections
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON public.menu_sections
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON public.menu_sections
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON public.menu_sections
    FOR DELETE USING (auth.role() = 'authenticated');

-- Insert default sections
INSERT INTO public.menu_sections (name) VALUES
    ('Sri Lankan'),
    ('Western'),
    ('Bar'),
    ('Desserts'),
    ('Beverages')
ON CONFLICT (name) DO NOTHING;
