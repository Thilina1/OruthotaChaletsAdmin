-- Fix RLS policies for custom auth system

-- Drop restrictive policies on customers
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.customers;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.customers;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.customers;

-- Drop restrictive policies on service_incomes
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.service_incomes;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON public.service_incomes;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON public.service_incomes;

-- Add open policies to match loyalty_customers and the custom auth setup
CREATE POLICY "Allow all operations for customers" ON public.customers
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for service_incomes" ON public.service_incomes
  FOR ALL USING (true) WITH CHECK (true);
