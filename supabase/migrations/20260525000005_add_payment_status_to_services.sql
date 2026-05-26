-- Add payment_status to service_incomes table
ALTER TABLE public.service_incomes
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';
