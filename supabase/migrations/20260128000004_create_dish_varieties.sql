-- Create dish_varieties table
CREATE TABLE IF NOT EXISTS public.dish_varieties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.dish_varieties ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.dish_varieties FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.dish_varieties FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.dish_varieties FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.dish_varieties FOR DELETE USING (auth.role() = 'authenticated');
