-- Simplify chalet pricing so package + room category determine the nightly rate.
-- Occupancy types remain in the schema for older data, but new active rates use NULL occupancy_type_id.

ALTER TABLE public.chalet_rates
    ALTER COLUMN occupancy_type_id DROP NOT NULL;

DROP INDEX IF EXISTS chalet_rates_default_package_occupancy_key;
DROP INDEX IF EXISTS chalet_rates_category_package_occupancy_key;

CREATE UNIQUE INDEX IF NOT EXISTS chalet_rates_default_package_key
    ON public.chalet_rates (package_id)
    WHERE room_category_id IS NULL AND occupancy_type_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS chalet_rates_category_package_key
    ON public.chalet_rates (room_category_id, package_id)
    WHERE room_category_id IS NOT NULL AND occupancy_type_id IS NULL;
