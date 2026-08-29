-- Maintain one persistent notification per eligible kitchen user while open
-- orders contain items that have not been marked done.
CREATE OR REPLACE FUNCTION public.sync_kitchen_order_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_kot_count BIGINT;
BEGIN
  SELECT count(*)
  INTO active_kot_count
  FROM public.orders order_record
  WHERE order_record.status = 'open'
    AND EXISTS (
      SELECT 1
      FROM public.order_items order_item
      WHERE order_item.order_id = order_record.id
        AND COALESCE(order_item.kitchen_status, 'pending') <> 'done'
    );

  DELETE FROM public.notifications
  WHERE type = 'kitchen_order';

  IF active_kot_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'kitchen_order',
      'Kitchen Orders Awaiting Action',
      active_kot_count::text || ' kitchen order ticket' ||
        CASE WHEN active_kot_count = 1 THEN '' ELSE 's' END ||
        ' awaiting your action.',
      '/dashboard/kitchen/orders'
    FROM public.users
    WHERE COALESCE(users.permissions, '[]'::jsonb)
      @> '["/dashboard/kitchen/orders"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_kitchen_notifications_from_orders
  ON public.orders;
CREATE TRIGGER sync_kitchen_notifications_from_orders
AFTER INSERT OR UPDATE OR DELETE
ON public.orders
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_kitchen_order_notifications();

DROP TRIGGER IF EXISTS sync_kitchen_notifications_from_items
  ON public.order_items;
CREATE TRIGGER sync_kitchen_notifications_from_items
AFTER INSERT OR UPDATE OR DELETE
ON public.order_items
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_kitchen_order_notifications();

-- Synchronize the current active KOT queue immediately.
DELETE FROM public.notifications
WHERE type = 'kitchen_order';

INSERT INTO public.notifications (user_id, type, title, message, href)
SELECT
  users.id,
  'kitchen_order',
  'Kitchen Orders Awaiting Action',
  active.total::text || ' kitchen order ticket' ||
    CASE WHEN active.total = 1 THEN '' ELSE 's' END ||
    ' awaiting your action.',
  '/dashboard/kitchen/orders'
FROM public.users
CROSS JOIN (
  SELECT count(*) AS total
  FROM public.orders order_record
  WHERE order_record.status = 'open'
    AND EXISTS (
      SELECT 1
      FROM public.order_items order_item
      WHERE order_item.order_id = order_record.id
        AND COALESCE(order_item.kitchen_status, 'pending') <> 'done'
    )
) active
WHERE active.total > 0
  AND COALESCE(users.permissions, '[]'::jsonb)
    @> '["/dashboard/kitchen/orders"]'::jsonb;

