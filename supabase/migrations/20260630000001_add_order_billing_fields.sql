-- Add billing fields to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_mobile TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_total NUMERIC;
