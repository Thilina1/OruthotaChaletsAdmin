ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS grn_number text,
ADD COLUMN IF NOT EXISTS payment_type text,
ADD COLUMN IF NOT EXISTS purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_transactions
DROP CONSTRAINT IF EXISTS inventory_transactions_payment_type_check;

ALTER TABLE public.inventory_transactions
ADD CONSTRAINT inventory_transactions_payment_type_check
CHECK (payment_type IS NULL OR payment_type IN ('cash', 'credit'));

CREATE INDEX IF NOT EXISTS inventory_transactions_grn_number_idx
ON public.inventory_transactions(grn_number);

CREATE INDEX IF NOT EXISTS inventory_transactions_purchase_order_id_idx
ON public.inventory_transactions(purchase_order_id);

COMMENT ON COLUMN public.inventory_transactions.grn_number
IS 'Shared reference for all transaction lines posted in one direct GRN.';

COMMENT ON COLUMN public.inventory_transactions.payment_type
IS 'Cash or credit classification for a direct GRN; null for unrelated inventory transactions.';

COMMENT ON COLUMN public.inventory_transactions.purchase_order_id
IS 'Purchase order reference when the receipt was generated from a PO.';
