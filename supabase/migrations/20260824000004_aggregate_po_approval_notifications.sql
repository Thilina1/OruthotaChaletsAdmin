-- Replace individual PO notifications with one queue notification per user.
DELETE FROM public.notifications
WHERE type = 'purchase_order_approval';

INSERT INTO public.notifications (user_id, type, title, message, href)
SELECT
  users.id,
  'purchase_order_approval',
  'Purchase Orders Awaiting Approval',
  pending.total::text || ' purchase order' || CASE WHEN pending.total = 1 THEN '' ELSE 's' END || ' awaiting your approval.',
  '/dashboard/purchase-orders/approvals'
FROM public.users
CROSS JOIN (
  SELECT count(*) AS total
  FROM public.purchase_orders
  WHERE status = 'pending_approval'
) pending
WHERE pending.total > 0
  AND COALESCE(users.permissions, '[]'::jsonb)
      @> '["/dashboard/purchase-orders/approvals"]'::jsonb;
