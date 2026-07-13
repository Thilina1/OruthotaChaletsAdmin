-- Fix menu_items RLS: policies were restricted to 'authenticated' role,
-- but this app uses custom JWT auth with the anon key, so the client is always 'anon'.
DROP POLICY IF EXISTS "Allow read access for all authenticated users" ON public.menu_items;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON public.menu_items;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON public.menu_items;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON public.menu_items;

CREATE POLICY "allow_all" ON public.menu_items USING (true) WITH CHECK (true);
