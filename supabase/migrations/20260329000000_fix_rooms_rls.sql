-- Enable RLS exactly as needed
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the rooms (useful for booking front-ends)
DROP POLICY IF EXISTS "Allow read access for all" ON public.rooms;
CREATE POLICY "Allow read access for all" ON public.rooms FOR SELECT USING (true);

-- Allow authenticated admins/staff to Manage (Insert / Update / Delete)
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.rooms;
CREATE POLICY "Allow insert for authenticated users" ON public.rooms FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.rooms;
CREATE POLICY "Allow update for authenticated users" ON public.rooms FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.rooms;
CREATE POLICY "Allow delete for authenticated users" ON public.rooms FOR DELETE USING (auth.role() = 'authenticated');
