ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS liability_settled_at timestamptz,
ADD COLUMN IF NOT EXISTS liability_settled_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_transactions
ADD COLUMN IF NOT EXISTS liability_settled_at timestamptz,
ADD COLUMN IF NOT EXISTS liability_settled_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS purchase_orders_liability_settled_at_idx
ON public.purchase_orders(liability_settled_at);

CREATE INDEX IF NOT EXISTS inventory_transactions_liability_settled_at_idx
ON public.inventory_transactions(liability_settled_at);

COMMENT ON COLUMN public.purchase_orders.liability_settled_at
IS 'When the supplier liability for a credit purchase order was settled.';

COMMENT ON COLUMN public.inventory_transactions.liability_settled_at
IS 'Settlement timestamp shared by every line of a direct credit GRN.';
