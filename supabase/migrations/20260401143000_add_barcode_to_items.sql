-- Add barcode and brand to hotel_inventory_items for better identification
ALTER TABLE public.hotel_inventory_items ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.hotel_inventory_items ADD COLUMN IF NOT EXISTS brand TEXT;
