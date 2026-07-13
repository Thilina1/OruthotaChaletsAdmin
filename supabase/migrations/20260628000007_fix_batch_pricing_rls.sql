-- Fix menu_item_batch_pricing RLS: auth.role() always returns 'anon' in custom JWT system
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.menu_item_batch_pricing;
CREATE POLICY allow_all ON public.menu_item_batch_pricing USING (true) WITH CHECK (true);
