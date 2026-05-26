-- Add customer_name and room_number to service_incomes table
ALTER TABLE public.service_incomes
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS room_number TEXT;
