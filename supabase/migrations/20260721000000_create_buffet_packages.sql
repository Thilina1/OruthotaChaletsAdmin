-- Buffet packages: a named package (e.g. "Standard Buffet", "Deluxe Buffet")
-- with its own menu of items and billing charges (VAT / service charge / other charge).
CREATE TABLE IF NOT EXISTS public.buffet_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    service_charge_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    other_charge_label TEXT,
    other_charge_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Menu items that belong to a buffet package.
CREATE TABLE IF NOT EXISTS public.buffet_menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES public.buffet_packages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buffet_menu_items_package_id ON public.buffet_menu_items(package_id);

ALTER TABLE public.buffet_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buffet_menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on buffet_packages" ON public.buffet_packages;
CREATE POLICY "Allow all on buffet_packages" ON public.buffet_packages FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all on buffet_menu_items" ON public.buffet_menu_items;
CREATE POLICY "Allow all on buffet_menu_items" ON public.buffet_menu_items FOR ALL USING (TRUE) WITH CHECK (TRUE);
