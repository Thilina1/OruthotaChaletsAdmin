-- Add approval fields to purchase_orders
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Update status check constraint
-- First drop existing constraint if possible (we need to know the name, usually it's purchase_orders_status_check)
-- Since we might not know the exact name, we can use this block:
DO $$
BEGIN
    ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
END $$;

ALTER TABLE public.purchase_orders 
ADD CONSTRAINT purchase_orders_status_check 
CHECK (status IN ('draft', 'pending_approval', 'approved', 'sent', 'received', 'cancelled'));

-- Index for approval tracking
CREATE INDEX IF NOT EXISTS purchase_orders_approved_by_idx ON public.purchase_orders (approved_by);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON public.purchase_orders (status);
