CREATE TABLE IF NOT EXISTS public.inventory_warehouses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    type text NOT NULL DEFAULT 'Internal',
    department_id uuid REFERENCES public.inventory_departments(id) ON DELETE CASCADE,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    description text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- Index for fast department lookups
CREATE INDEX IF NOT EXISTS inventory_warehouses_department_id_idx ON public.inventory_warehouses (department_id);

-- Ensure only one warehouse per department
ALTER TABLE public.inventory_warehouses 
ADD CONSTRAINT inventory_warehouses_department_id_key UNIQUE (department_id);


-- Enable RLS
ALTER TABLE public.inventory_warehouses ENABLE ROW LEVEL SECURITY;

-- Allow all for now (matching existing inventory pattern if needed, or restricting as per admin)
CREATE POLICY "Allow all for authenticated users" ON public.inventory_warehouses
    FOR ALL USING (auth.role() = 'authenticated');

-- Comment
COMMENT ON TABLE public.inventory_warehouses IS 'Stores physical warehouse locations linked to logical inventory departments.';
