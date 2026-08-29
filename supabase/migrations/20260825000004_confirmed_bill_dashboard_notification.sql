-- Notify users with the exact Dashboard permission after billing confirms a
-- restaurant bill. Keep one notification until all confirmed bills are paid.
CREATE OR REPLACE FUNCTION public.sync_confirmed_bill_dashboard_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  confirmed_bill_count BIGINT;
BEGIN
  SELECT count(*)
  INTO confirmed_bill_count
  FROM public.orders
  WHERE status = 'billed'
    AND confirmed_total IS NOT NULL;

  DELETE FROM public.notifications
  WHERE type = 'confirmed_restaurant_bill';

  IF confirmed_bill_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'confirmed_restaurant_bill',
      'Restaurant Bills Confirmed',
      confirmed_bill_count::text || ' confirmed restaurant bill' ||
        CASE WHEN confirmed_bill_count = 1 THEN '' ELSE 's' END ||
        ' awaiting payment completion.',
      '/dashboard'
    FROM public.users
    WHERE COALESCE(users.permissions, '[]'::jsonb)
      @> '["/dashboard"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_confirmed_bill_dashboard_notifications_trigger
  ON public.orders;

CREATE TRIGGER sync_confirmed_bill_dashboard_notifications_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.orders
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_confirmed_bill_dashboard_notifications();

-- Synchronize currently confirmed and unpaid bills immediately.
DELETE FROM public.notifications
WHERE type = 'confirmed_restaurant_bill';

INSERT INTO public.notifications (user_id, type, title, message, href)
SELECT
  users.id,
  'confirmed_restaurant_bill',
  'Restaurant Bills Confirmed',
  pending.total::text || ' confirmed restaurant bill' ||
    CASE WHEN pending.total = 1 THEN '' ELSE 's' END ||
    ' awaiting payment completion.',
  '/dashboard'
FROM public.users
CROSS JOIN (
  SELECT count(*) AS total
  FROM public.orders
  WHERE status = 'billed'
    AND confirmed_total IS NOT NULL
) pending
WHERE pending.total > 0
  AND COALESCE(users.permissions, '[]'::jsonb)
    @> '["/dashboard"]'::jsonb;

