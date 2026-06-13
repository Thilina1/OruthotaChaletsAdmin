-- Links menu items to inventory batches and stores the per-batch selling price for POS
CREATE TABLE IF NOT EXISTS public.menu_item_batch_pricing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    batch_id uuid NOT NULL REFERENCES public.inventory_batches(id) ON DELETE CASCADE,
    selling_price numeric(10, 2) NOT NULL,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now()),
    UNIQUE (menu_item_id, batch_id)
);

CREATE INDEX IF NOT EXISTS menu_item_batch_pricing_menu_item_id_idx ON public.menu_item_batch_pricing (menu_item_id);
CREATE INDEX IF NOT EXISTS menu_item_batch_pricing_batch_id_idx ON public.menu_item_batch_pricing (batch_id);

ALTER TABLE public.menu_item_batch_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.menu_item_batch_pricing
    FOR ALL USING (auth.role() = 'authenticated');
