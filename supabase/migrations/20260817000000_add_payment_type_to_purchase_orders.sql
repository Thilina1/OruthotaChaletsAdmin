ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'credit';

ALTER TABLE public.purchase_orders
DROP CONSTRAINT IF EXISTS purchase_orders_payment_type_check;

ALTER TABLE public.purchase_orders
ADD CONSTRAINT purchase_orders_payment_type_check
CHECK (payment_type IN ('cash', 'credit'));

COMMENT ON COLUMN public.purchase_orders.payment_type
IS 'Payment classification for the purchase order: cash or credit.';
