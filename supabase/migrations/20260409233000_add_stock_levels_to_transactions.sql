-- Migration: Add stock level tracking to transactions
-- Description: Adds previous_stock and new_stock columns to inventory_transactions table

ALTER TABLE public.inventory_transactions 
ADD COLUMN IF NOT EXISTS new_stock NUMERIC DEFAULT 0;


