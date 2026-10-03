CREATE TABLE IF NOT EXISTS public.chalet_room_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE,
    description TEXT,
    area_sqm NUMERIC(8,2),
    room_count INT NOT NULL DEFAULT 1,
    max_adults INT NOT NULL DEFAULT 2,
    max_children INT NOT NULL DEFAULT 0,
    max_guests INT NOT NULL DEFAULT 2,
    bed_configurations JSONB NOT NULL DEFAULT '[]'::jsonb,
    bathroom_features JSONB NOT NULL DEFAULT '[]'::jsonb,
    entertainment_features JSONB NOT NULL DEFAULT '[]'::jsonb,
    general_amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
    internet_features JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chalet_rooms
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.chalet_room_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS max_adults INT,
    ADD COLUMN IF NOT EXISTS max_children INT,
    ADD COLUMN IF NOT EXISTS max_guests INT,
    ADD COLUMN IF NOT EXISTS bed_type TEXT;

ALTER TABLE public.chalet_rates
    ADD COLUMN IF NOT EXISTS room_category_id UUID REFERENCES public.chalet_room_categories(id) ON DELETE CASCADE;

ALTER TABLE public.chalet_bookings
    ADD COLUMN IF NOT EXISTS room_category_id UUID REFERENCES public.chalet_room_categories(id) ON DELETE SET NULL;

ALTER TABLE public.chalet_rates
    DROP CONSTRAINT IF EXISTS chalet_rates_package_id_occupancy_type_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS chalet_rates_default_package_occupancy_key
    ON public.chalet_rates (package_id, occupancy_type_id)
    WHERE room_category_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS chalet_rates_category_package_occupancy_key
    ON public.chalet_rates (room_category_id, package_id, occupancy_type_id)
    WHERE room_category_id IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.chalet_room_categories WHERE name = 'Superior Duplex King') THEN
        INSERT INTO public.chalet_room_categories (
            name, slug, description, area_sqm, room_count, max_adults, max_children, max_guests,
            bed_configurations, bathroom_features, entertainment_features, general_amenities, internet_features, image_urls, sort_order
        ) VALUES (
            'Superior Duplex King',
            'superior-duplex-king',
            'With the living room on the first floor and the bedrooms on the ground floor, our Superior Duplex rooms span an area of 90 square meters, and are perfect for guests who prefer large spaces.',
            90,
            1,
            4,
            2,
            4,
            '["1 King", "2 Twin"]'::jsonb,
            '[{"name":"Shower","icon":"shower"}]'::jsonb,
            '[{"name":"DVD Player","icon":"play"},{"name":"Satellite / Cable TV","icon":"tv"}]'::jsonb,
            '[{"name":"Hair Dryer","icon":"wind"}]'::jsonb,
            '[{"name":"FREE WiFi","icon":"wifi"}]'::jsonb,
            '[]'::jsonb,
            1
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.chalet_room_categories WHERE name = 'Garden Suite') THEN
        INSERT INTO public.chalet_room_categories (name, slug, room_count, max_adults, max_children, max_guests, bed_configurations, bathroom_features, entertainment_features, general_amenities, internet_features, image_urls, sort_order)
        VALUES (
            'Garden Suite',
            'garden-suite',
            1,
            2,
            2,
            4,
            '["1 King"]'::jsonb,
            '[{"name":"Shower","icon":"shower"}]'::jsonb,
            '[{"name":"Satellite / Cable TV","icon":"tv"}]'::jsonb,
            '[{"name":"Hair Dryer","icon":"wind"}]'::jsonb,
            '[{"name":"FREE WiFi","icon":"wifi"}]'::jsonb,
            '[]'::jsonb,
            2
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.chalet_room_categories WHERE name = 'Superior Duplex Twin') THEN
        INSERT INTO public.chalet_room_categories (name, slug, room_count, max_adults, max_children, max_guests, bed_configurations, bathroom_features, entertainment_features, general_amenities, internet_features, image_urls, sort_order)
        VALUES (
            'Superior Duplex Twin',
            'superior-duplex-twin',
            1,
            4,
            2,
            4,
            '["2 Twin"]'::jsonb,
            '[{"name":"Shower","icon":"shower"}]'::jsonb,
            '[{"name":"DVD Player","icon":"play"},{"name":"Satellite / Cable TV","icon":"tv"}]'::jsonb,
            '[{"name":"Hair Dryer","icon":"wind"}]'::jsonb,
            '[{"name":"FREE WiFi","icon":"wifi"}]'::jsonb,
            '[]'::jsonb,
            3
        );
    END IF;
END $$;

ALTER TABLE public.chalet_room_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'chalet_room_categories'
          AND policyname = 'chalet_room_categories_all'
    ) THEN
        CREATE POLICY "chalet_room_categories_all" ON public.chalet_room_categories FOR ALL USING (TRUE) WITH CHECK (TRUE);
    END IF;
END $$;
