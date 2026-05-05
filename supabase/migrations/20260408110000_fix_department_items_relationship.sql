-- Fix the relationship between inventory_departments and hotel_inventory_items
-- explicitly add the foreign key constraint if it's missing or loose

ALTER TABLE public.hotel_inventory_items
DROP CONSTRAINT IF EXISTS hotel_inventory_items_department_id_fkey;

ALTER TABLE public.hotel_inventory_items
ADD CONSTRAINT hotel_inventory_items_department_id_fkey 
FOREIGN KEY (department_id) 
REFERENCES public.inventory_departments(id)
ON DELETE CASCADE;

-- Also check inventory_transactions relationship while we are at it
ALTER TABLE public.inventory_transactions
DROP CONSTRAINT IF EXISTS inventory_transactions_reference_department_fkey;

ALTER TABLE public.inventory_transactions
ADD CONSTRAINT inventory_transactions_reference_department_fkey
FOREIGN KEY (reference_department)
REFERENCES public.inventory_departments(id)
ON DELETE SET NULL;

-- Enable RLS for departments if not already
ALTER TABLE public.inventory_departments ENABLE ROW LEVEL SECURITY;

-- Ensure authenticated users can read departments
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.inventory_departments;
CREATE POLICY "Allow authenticated read access" ON public.inventory_departments
    FOR SELECT USING (auth.role() = 'authenticated');
