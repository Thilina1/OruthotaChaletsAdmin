-- Create restaurant_sections table
CREATE TABLE IF NOT EXISTS public.restaurant_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.restaurant_sections ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow read access for all authenticated users" ON public.restaurant_sections
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all access for admin users" ON public.restaurant_sections
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE public.users.id = auth.uid() AND public.users.role = 'admin'
        )
    );

-- Seed default values
INSERT INTO public.restaurant_sections (name) VALUES
    ('Sri Lankan'),
    ('Western'),
    ('Outdoor'),
    ('Bar')
ON CONFLICT (name) DO NOTHING;
