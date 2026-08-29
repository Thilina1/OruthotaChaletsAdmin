-- Maintain one persistent buffet-booking notification per eligible user,
-- including bookings created by the separate public website.
CREATE OR REPLACE FUNCTION public.sync_buffet_booking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_count BIGINT;
BEGIN
  SELECT count(*)
  INTO pending_count
  FROM public.table_bookings
  WHERE status = 'pending';

  DELETE FROM public.notifications
  WHERE type = 'buffet_booking';

  IF pending_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'buffet_booking',
      'Buffet Bookings Awaiting Action',
      pending_count::text || ' buffet booking' ||
        CASE WHEN pending_count = 1 THEN '' ELSE 's' END ||
        ' awaiting your action.',
      '/dashboard/buffet-bookings'
    FROM public.users
    WHERE COALESCE(users.permissions, '[]'::jsonb)
      @> '["/dashboard/buffet-bookings"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_buffet_booking_notifications_trigger
  ON public.table_bookings;

CREATE TRIGGER sync_buffet_booking_notifications_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.table_bookings
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_buffet_booking_notifications();

-- Synchronize existing pending bookings immediately.
DELETE FROM public.notifications
WHERE type = 'buffet_booking';

INSERT INTO public.notifications (user_id, type, title, message, href)
SELECT
  users.id,
  'buffet_booking',
  'Buffet Bookings Awaiting Action',
  pending.total::text || ' buffet booking' ||
    CASE WHEN pending.total = 1 THEN '' ELSE 's' END ||
    ' awaiting your action.',
  '/dashboard/buffet-bookings'
FROM public.users
CROSS JOIN (
  SELECT count(*) AS total
  FROM public.table_bookings
  WHERE status = 'pending'
) pending
WHERE pending.total > 0
  AND COALESCE(users.permissions, '[]'::jsonb)
    @> '["/dashboard/buffet-bookings"]'::jsonb;

