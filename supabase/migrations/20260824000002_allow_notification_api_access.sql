-- This separate migration fixes environments where the notifications table
-- migration was applied before its API access policy was added.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow notification API access" ON public.notifications;
CREATE POLICY "Allow notification API access"
  ON public.notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Backfill notifications for POs submitted while notification access was
-- blocked. Only users with the exact approvals permission are recipients.
INSERT INTO public.notifications (user_id, type, title, message, href, created_at)
SELECT
  users.id,
  'purchase_order_approval',
  'Purchase Orders Awaiting Approval',
  pending.total::text || ' purchase order' || CASE WHEN pending.total = 1 THEN '' ELSE 's' END || ' awaiting your approval.',
  '/dashboard/purchase-orders/approvals',
  now()
FROM public.users
CROSS JOIN (
  SELECT count(*) AS total
  FROM public.purchase_orders
  WHERE status = 'pending_approval'
) pending
WHERE pending.total > 0
  AND COALESCE(users.permissions, '[]'::jsonb)
      @> '["/dashboard/purchase-orders/approvals"]'::jsonb
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications existing
    WHERE existing.user_id = users.id
      AND existing.type = 'purchase_order_approval'
  );
