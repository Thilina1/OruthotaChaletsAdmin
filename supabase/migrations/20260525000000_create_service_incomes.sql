-- Create service_incomes table
CREATE TABLE IF NOT EXISTS public.service_incomes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    service_type TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.service_incomes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.service_incomes FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.service_incomes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users only" ON public.service_incomes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users only" ON public.service_incomes FOR DELETE USING (auth.role() = 'authenticated');
