ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_approval_status_check' AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS events_approval_status_idx
  ON public.events(approval_status, starts_at);

CREATE OR REPLACE FUNCTION public.sync_event_approval_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_count BIGINT;
BEGIN
  SELECT count(*) INTO pending_count
  FROM public.events
  WHERE approval_status = 'pending';

  DELETE FROM public.notifications WHERE type = 'event_approval';

  IF pending_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'event_approval',
      'Events Awaiting Approval',
      pending_count::text || ' event' || CASE WHEN pending_count = 1 THEN '' ELSE 's' END || ' awaiting your approval.',
      '/dashboard/event-management/approvals'
    FROM public.users
    WHERE (users.role = 'admin' AND COALESCE(users.restrict_admin_permissions, false) = false)
       OR COALESCE(users.permissions, '[]'::jsonb) @> '["/dashboard/event-management/approvals"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_event_approval_notifications_trigger ON public.events;
CREATE TRIGGER sync_event_approval_notifications_trigger
AFTER INSERT OR UPDATE OF approval_status OR DELETE
ON public.events
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_event_approval_notifications();

-- Fire the statement trigger once to populate the current approval queue.
UPDATE public.events SET approval_status = approval_status WHERE false;
