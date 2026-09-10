-- Persistent notifications for the three actionable Reservation-section
-- queues. Recipients match dashboard access rules: unrestricted admins have
-- access by default, while all other users need the explicit page permission.

CREATE OR REPLACE FUNCTION public.sync_experience_inquiry_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_count BIGINT;
BEGIN
  SELECT count(*) INTO pending_count
  FROM public.contact_messages
  WHERE inquiry_type = 'experience' AND status = 'pending';

  DELETE FROM public.notifications WHERE type = 'experience_inquiry';

  IF pending_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'experience_inquiry',
      'Experience Inquiries Awaiting Action',
      pending_count::text || ' experience inquir' ||
        CASE WHEN pending_count = 1 THEN 'y' ELSE 'ies' END ||
        ' awaiting your action.',
      '/dashboard/experience-inquiries'
    FROM public.users
    WHERE
      (users.role = 'admin' AND NOT COALESCE(users.restrict_admin_permissions, false))
      OR COALESCE(users.permissions, '[]'::jsonb)
        @> '["/dashboard/experience-inquiries"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_experience_inquiry_notifications_trigger
  ON public.contact_messages;

CREATE TRIGGER sync_experience_inquiry_notifications_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.contact_messages
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_experience_inquiry_notifications();

CREATE OR REPLACE FUNCTION public.sync_general_inquiry_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_count BIGINT;
BEGIN
  SELECT count(*) INTO pending_count
  FROM public.contact_messages
  WHERE inquiry_type = 'general' AND status = 'pending';

  DELETE FROM public.notifications WHERE type = 'general_inquiry';

  IF pending_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'general_inquiry',
      'Inquiries Awaiting Action',
      pending_count::text || ' inquir' ||
        CASE WHEN pending_count = 1 THEN 'y' ELSE 'ies' END ||
        ' awaiting your action.',
      '/dashboard/inquiries'
    FROM public.users
    WHERE
      (users.role = 'admin' AND NOT COALESCE(users.restrict_admin_permissions, false))
      OR COALESCE(users.permissions, '[]'::jsonb)
        @> '["/dashboard/inquiries"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_buffet_booking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_count BIGINT;
BEGIN
  SELECT count(*) INTO pending_count
  FROM public.table_bookings
  WHERE status = 'pending';

  DELETE FROM public.notifications WHERE type = 'buffet_booking';

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
    WHERE
      (users.role = 'admin' AND NOT COALESCE(users.restrict_admin_permissions, false))
      OR COALESCE(users.permissions, '[]'::jsonb)
        @> '["/dashboard/buffet-bookings"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

-- Rebuild all three queues now so existing pending records appear without
-- waiting for a future insert or status update.
UPDATE public.contact_messages SET status = status WHERE false;
UPDATE public.table_bookings SET status = status WHERE false;
