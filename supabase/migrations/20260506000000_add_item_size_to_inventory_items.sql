-- Migration: Add item_size to inventory_items
-- Created to fix: Could not find the 'item_size' column of 'inventory_items' in the schema cache

ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS item_size TEXT;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
