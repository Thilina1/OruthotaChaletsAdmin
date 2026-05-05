-- Migration: Enforce unique SKU/Item Code
-- Description: Ensures that no two items share the same code/sku

ALTER TABLE public.inventory_items 
ADD CONSTRAINT inventory_items_code_unique UNIQUE (code);
