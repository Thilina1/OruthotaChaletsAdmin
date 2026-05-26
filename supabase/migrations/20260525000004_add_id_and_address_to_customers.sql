-- Add id_number and address to customers table
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS id_number TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;
