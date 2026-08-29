-- Maintain one persistent notification per eligible HR approver while leave
-- requests are waiting for final approval.
CREATE OR REPLACE FUNCTION public.sync_leave_approval_notifications()
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
  FROM public.leave_requests
  WHERE status = 'pending';

  DELETE FROM public.notifications
  WHERE type = 'leave_approval';

  IF pending_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'leave_approval',
      'Leave Requests Awaiting Approval',
      pending_count::text || ' leave request' ||
        CASE WHEN pending_count = 1 THEN '' ELSE 's' END ||
        ' awaiting your approval.',
      '/dashboard/hrms/leave-approvals'
    FROM public.users
    WHERE COALESCE(users.permissions, '[]'::jsonb)
      @> '["/dashboard/hrms/leave-approvals"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_leave_approval_notifications_trigger
  ON public.leave_requests;

CREATE TRIGGER sync_leave_approval_notifications_trigger
AFTER INSERT OR UPDATE OR DELETE
ON public.leave_requests
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_leave_approval_notifications();

-- Synchronize the current HR approval queue immediately.
DELETE FROM public.notifications
WHERE type = 'leave_approval';

INSERT INTO public.notifications (user_id, type, title, message, href)
SELECT
  users.id,
  'leave_approval',
  'Leave Requests Awaiting Approval',
  pending.total::text || ' leave request' ||
    CASE WHEN pending.total = 1 THEN '' ELSE 's' END ||
    ' awaiting your approval.',
  '/dashboard/hrms/leave-approvals'
FROM public.users
CROSS JOIN (
  SELECT count(*) AS total
  FROM public.leave_requests
  WHERE status = 'pending'
) pending
WHERE pending.total > 0
  AND COALESCE(users.permissions, '[]'::jsonb)
    @> '["/dashboard/hrms/leave-approvals"]'::jsonb;

