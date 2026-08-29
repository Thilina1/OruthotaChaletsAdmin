-- Maintain one persistent general-inquiry notification per eligible user,
-- including inquiries submitted by the public website.
CREATE OR REPLACE FUNCTION public.sync_general_inquiry_notifications()
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
  FROM public.contact_messages
  WHERE inquiry_type = 'general'
    AND status = 'pending';

  DELETE FROM public.notifications
  WHERE type = 'general_inquiry';

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
    WHERE COALESCE(users.permissions, '[]'::jsonb)
      @> '["/dashboard/inquiries"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_general_inquiry_notifications_trigger
  ON public.contact_messages;

CREATE TRIGGER sync_general_inquiry_notifications_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.contact_messages
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_general_inquiry_notifications();

-- Synchronize existing pending general inquiries immediately.
DELETE FROM public.notifications
WHERE type = 'general_inquiry';

INSERT INTO public.notifications (user_id, type, title, message, href)
SELECT
  users.id,
  'general_inquiry',
  'Inquiries Awaiting Action',
  pending.total::text || ' inquir' ||
    CASE WHEN pending.total = 1 THEN 'y' ELSE 'ies' END ||
    ' awaiting your action.',
  '/dashboard/inquiries'
FROM public.users
CROSS JOIN (
  SELECT count(*) AS total
  FROM public.contact_messages
  WHERE inquiry_type = 'general'
    AND status = 'pending'
) pending
WHERE pending.total > 0
  AND COALESCE(users.permissions, '[]'::jsonb)
    @> '["/dashboard/inquiries"]'::jsonb;
