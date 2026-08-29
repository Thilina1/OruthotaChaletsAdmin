-- Maintain one persistent notification per eligible billing user while
-- restaurant orders are waiting for payment processing.
CREATE OR REPLACE FUNCTION public.sync_restaurant_billing_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_bill_count BIGINT;
BEGIN
  SELECT count(*)
  INTO pending_bill_count
  FROM public.orders
  WHERE status = 'billed';

  DELETE FROM public.notifications
  WHERE type = 'restaurant_billing';

  IF pending_bill_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'restaurant_billing',
      'Restaurant Bills Awaiting Payment',
      pending_bill_count::text || ' restaurant bill' ||
        CASE WHEN pending_bill_count = 1 THEN '' ELSE 's' END ||
        ' awaiting payment.',
      '/dashboard/billing'
    FROM public.users
    WHERE COALESCE(users.permissions, '[]'::jsonb)
      @> '["/dashboard/billing"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_restaurant_billing_notifications_trigger
  ON public.orders;

CREATE TRIGGER sync_restaurant_billing_notifications_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.orders
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_restaurant_billing_notifications();

-- Synchronize the current billing queue immediately.
DELETE FROM public.notifications
WHERE type = 'restaurant_billing';

INSERT INTO public.notifications (user_id, type, title, message, href)
SELECT
  users.id,
  'restaurant_billing',
  'Restaurant Bills Awaiting Payment',
  pending.total::text || ' restaurant bill' ||
    CASE WHEN pending.total = 1 THEN '' ELSE 's' END ||
    ' awaiting payment.',
  '/dashboard/billing'
FROM public.users
CROSS JOIN (
  SELECT count(*) AS total
  FROM public.orders
  WHERE status = 'billed'
) pending
WHERE pending.total > 0
  AND COALESCE(users.permissions, '[]'::jsonb)
    @> '["/dashboard/billing"]'::jsonb;

