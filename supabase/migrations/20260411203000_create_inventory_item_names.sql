CREATE TABLE IF NOT EXISTS public.inventory_item_names (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Note: RLS should probably be disabled or configured to allow authenticated users.
-- For now we enable it and allow all operations to authenticated users if standard
ALTER TABLE public.inventory_item_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to inventory_item_names" 
ON public.inventory_item_names FOR ALL TO authenticated USING (true) WITH CHECK (true);




