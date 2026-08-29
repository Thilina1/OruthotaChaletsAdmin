-- Create one persistent notification per eligible user while chalet bookings
-- are waiting in the pending state.
DELETE FROM public.notifications
WHERE type = 'chalet_booking';

INSERT INTO public.notifications (user_id, type, title, message, href)
SELECT
  users.id,
  'chalet_booking',
  'Chalet Bookings Awaiting Action',
  pending.total::text || ' chalet booking' || CASE WHEN pending.total = 1 THEN '' ELSE 's' END || ' awaiting your action.',
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
