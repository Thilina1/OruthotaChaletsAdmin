-- Maintain one persistent notification per eligible user while approved cash
-- requests are waiting for issuance.
CREATE OR REPLACE FUNCTION public.sync_inventory_cash_issuance_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  issuance_count BIGINT;
BEGIN
  SELECT
    count(*) FILTER (
      WHERE cash_request.status = 'APPROVED'
        AND COALESCE(purchase_order.payment_type, 'cash') <> 'credit'
    )
    + count(*) FILTER (
      WHERE cash_request.status = 'ISSUED'
        AND cash_request.additional_status = 'APPROVED'
    )
  INTO issuance_count
  FROM public.inventory_cash_requests cash_request
  LEFT JOIN public.purchase_orders purchase_order
    ON purchase_order.id = cash_request.purchase_order_id;

  DELETE FROM public.notifications
  WHERE type = 'inventory_cash_issuance';

  IF issuance_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'inventory_cash_issuance',
      'Inventory Cash Awaiting Issuance',
      issuance_count::text || ' cash issuance' ||
        CASE WHEN issuance_count = 1 THEN '' ELSE 's' END ||
        ' awaiting your action.',
      '/dashboard/accounting/inventory-cash'
    FROM public.users
    WHERE COALESCE(users.permissions, '[]'::jsonb)
      @> '["/dashboard/accounting/inventory-cash"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_inventory_cash_issuance_notifications_trigger
  ON public.inventory_cash_requests;

CREATE TRIGGER sync_inventory_cash_issuance_notifications_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.inventory_cash_requests
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_inventory_cash_issuance_notifications();

-- Synchronize the current issuance queue immediately.
DELETE FROM public.notifications
WHERE type = 'inventory_cash_issuance';

INSERT INTO public.notifications (user_id, type, title, message, href)
SELECT
  users.id,
  'inventory_cash_issuance',
  'Inventory Cash Awaiting Issuance',
  pending.total::text || ' cash issuance' ||
    CASE WHEN pending.total = 1 THEN '' ELSE 's' END ||
    ' awaiting your action.',
  '/dashboard/accounting/inventory-cash'
FROM public.users
CROSS JOIN (
  SELECT
    count(*) FILTER (
      WHERE cash_request.status = 'APPROVED'
        AND COALESCE(purchase_order.payment_type, 'cash') <> 'credit'
    )
    + count(*) FILTER (
      WHERE cash_request.status = 'ISSUED'
        AND cash_request.additional_status = 'APPROVED'
    ) AS total
  FROM public.inventory_cash_requests cash_request
  LEFT JOIN public.purchase_orders purchase_order
    ON purchase_order.id = cash_request.purchase_order_id
) pending
WHERE pending.total > 0
  AND COALESCE(users.permissions, '[]'::jsonb)
    @> '["/dashboard/accounting/inventory-cash"]'::jsonb;

