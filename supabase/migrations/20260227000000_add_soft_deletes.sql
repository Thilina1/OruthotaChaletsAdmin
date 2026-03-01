-- Migration to add soft delete support

-- 1. Add deleted_at to menu_items
ALTER TABLE public.menu_items
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Add deleted_at to hotel_inventory_items
ALTER TABLE public.hotel_inventory_items
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
