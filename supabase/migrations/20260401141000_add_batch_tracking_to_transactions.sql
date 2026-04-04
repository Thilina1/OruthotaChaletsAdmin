-- Add Batch tracking columns to inventory_transactions
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2);

-- Update inventory_requests to ensure we track these fields in action_metadata
-- (Already handled by JSONB action_metadata column in previous migrations)
