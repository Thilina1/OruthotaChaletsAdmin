-- Ensure the master exists on installations missing the earlier metadata migration.
CREATE TABLE IF NOT EXISTS public.inventory_brands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.inventory_brands ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.inventory_brands TO service_role;

INSERT INTO public.inventory_brands(name)
SELECT DISTINCT btrim(brand) FROM public.inventory_items
WHERE brand IS NOT NULL AND btrim(brand) <> ''
ON CONFLICT (name) DO NOTHING;

-- Rename a brand and its current catalog references in one transaction.
CREATE OR REPLACE FUNCTION public.rename_inventory_brand_master(record_id text, new_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    old_name text;
    clean_name text := btrim(new_name);
    brand_record public.inventory_brands%ROWTYPE;
BEGIN
    IF clean_name IS NULL OR clean_name = '' THEN
        RAISE EXCEPTION 'Brand name is required' USING ERRCODE = '22023';
    END IF;

    LOCK TABLE public.inventory_brands IN SHARE ROW EXCLUSIVE MODE;
    LOCK TABLE public.inventory_items IN SHARE ROW EXCLUSIVE MODE;

    IF left(record_id, 11) = 'item-brand:' THEN
        old_name := substring(record_id FROM 12);
        IF NOT EXISTS (SELECT 1 FROM public.inventory_items WHERE lower(btrim(brand)) = lower(old_name)) THEN
            RAISE EXCEPTION 'Brand not found' USING ERRCODE = 'P0002';
        END IF;
    ELSE
        SELECT name INTO old_name FROM public.inventory_brands WHERE id = record_id::uuid;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand not found' USING ERRCODE = 'P0002';
        END IF;
    END IF;

    IF lower(clean_name) <> lower(btrim(old_name)) AND (
        EXISTS (SELECT 1 FROM public.inventory_brands WHERE lower(btrim(name)) = lower(clean_name))
        OR EXISTS (SELECT 1 FROM public.inventory_items WHERE lower(btrim(brand)) = lower(clean_name))
    ) THEN
        RAISE EXCEPTION 'This brand name already exists' USING ERRCODE = '23505';
    END IF;

    -- Consolidate differently capitalized legacy master records for the same brand.
    SELECT * INTO brand_record FROM public.inventory_brands
    WHERE lower(btrim(name)) = lower(btrim(old_name)) ORDER BY created_at, id LIMIT 1;
    IF FOUND THEN
        DELETE FROM public.inventory_brands
        WHERE lower(btrim(name)) = lower(btrim(old_name)) AND id <> brand_record.id;
        UPDATE public.inventory_brands SET name = clean_name WHERE id = brand_record.id
        RETURNING * INTO brand_record;
    ELSE
        INSERT INTO public.inventory_brands(name) VALUES (clean_name) RETURNING * INTO brand_record;
    END IF;

    UPDATE public.inventory_items SET brand = clean_name
    WHERE lower(btrim(brand)) = lower(btrim(old_name));

    RETURN to_jsonb(brand_record);
END;
$$;

REVOKE ALL ON FUNCTION public.rename_inventory_brand_master(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rename_inventory_brand_master(text, text) TO service_role;
