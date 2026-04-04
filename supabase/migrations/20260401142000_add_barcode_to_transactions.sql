-- Add barcode column to inventory transactions
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS barcode TEXT;
