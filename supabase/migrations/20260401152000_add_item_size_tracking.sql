-- Add item_size column to hotel_inventory_items
ALTER TABLE public.hotel_inventory_items ADD COLUMN IF NOT EXISTS item_size TEXT;

-- Add item_size column to inventory_transactions
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS item_size TEXT;

-- Sync function update (Already exists in previous migration, just adding item_size sync if needed)
-- We'll just leave it for now as brand/supplier were the main sync requirements.
