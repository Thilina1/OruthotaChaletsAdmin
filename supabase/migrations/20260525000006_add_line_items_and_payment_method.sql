-- Add line_items and payment_method to service_incomes table
ALTER TABLE public.service_incomes
ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS payment_method TEXT;
