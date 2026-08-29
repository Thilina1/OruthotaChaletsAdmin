ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID
  REFERENCES public.purchase_orders(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_purchase_order_idx
  ON public.notifications(purchase_order_id);

-- Link notifications created by the earlier backfill migration.
UPDATE public.notifications notification
SET purchase_order_id = purchase_order.id
FROM public.purchase_orders purchase_order
WHERE notification.type = 'purchase_order_approval'
  AND notification.purchase_order_id IS NULL
  AND notification.message = purchase_order.po_number || ' has been submitted for your approval.';

