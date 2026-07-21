-- Let a chalet package define custom facilities (e.g. Pool Access, Spa, Airport
-- Pickup) beyond the existing breakfast/lunch/dinner flags. Stored as a flexible
-- named list, same pattern as buffet_packages.other_charges.
ALTER TABLE public.chalet_packages
  ADD COLUMN IF NOT EXISTS facilities JSONB NOT NULL DEFAULT '[]'::jsonb;
