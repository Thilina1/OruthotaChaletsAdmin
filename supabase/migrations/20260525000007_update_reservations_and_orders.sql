-- Add customer_id to reservations
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Add customer_id to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Add indexes for faster billing lookups
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON public.reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
