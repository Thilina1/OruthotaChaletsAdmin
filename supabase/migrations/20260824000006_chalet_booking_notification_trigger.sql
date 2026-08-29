-- Keep chalet booking notifications synchronized even when bookings are
-- created by the separate public website rather than this admin application.
CREATE OR REPLACE FUNCTION public.sync_chalet_booking_notifications()
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
  FROM public.chalet_bookings
  WHERE status = 'pending';

  DELETE FROM public.notifications
  WHERE type = 'chalet_booking';

  IF pending_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'chalet_booking',
      'Chalet Bookings Awaiting Action',
      pending_count::text || ' chalet booking' ||
        CASE WHEN pending_count = 1 THEN '' ELSE 's' END ||
        ' awaiting your action.',
      '/dashboard/chalet/bookings'
    FROM public.users
    WHERE COALESCE(users.permissions, '[]'::jsonb)
      @> '["/dashboard/chalet/bookings"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_chalet_booking_notifications_trigger
  ON public.chalet_bookings;

CREATE TRIGGER sync_chalet_booking_notifications_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.chalet_bookings
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_chalet_booking_notifications();

-- Synchronize existing pending bookings immediately when this migration runs.
DELETE FROM public.notifications
WHERE type = 'chalet_booking';

INSERT INTO public.notifications (user_id, type, title, message, href)
SELECT
  users.id,
  'chalet_booking',
  'Chalet Bookings Awaiting Action',
  pending.total::text || ' chalet booking' ||
    CASE WHEN pending.total = 1 THEN '' ELSE 's' END ||
    ' awaiting your action.',
  '/dashboard/chalet/bookings'
FROM public.users
CROSS JOIN (
  SELECT count(*) AS total
  FROM public.chalet_bookings
  WHERE status = 'pending'
) pending
WHERE pending.total > 0
  AND COALESCE(users.permissions, '[]'::jsonb)
    @> '["/dashboard/chalet/bookings"]'::jsonb;
