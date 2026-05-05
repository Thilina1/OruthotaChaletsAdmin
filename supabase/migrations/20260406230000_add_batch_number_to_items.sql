-- Migration: Add batch_number and expiry_date to hotel_inventory_items
ALTER TABLE public.hotel_inventory_items 
ADD COLUMN IF NOT EXISTS batch_number text,
ADD COLUMN IF NOT EXISTS expiry_date date;
