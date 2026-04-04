-- Add batch_number and supplier columns to inventory transactions
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS supplier TEXT;
