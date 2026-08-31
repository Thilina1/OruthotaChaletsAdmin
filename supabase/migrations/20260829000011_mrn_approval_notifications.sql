ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS inventory_request_id UUID
  REFERENCES public.inventory_requests(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_inventory_request_idx
  ON public.notifications(inventory_request_id);

-- Maintain one live, aggregated notification for every user who can manage
-- the MRN approval queue.
CREATE OR REPLACE FUNCTION public.sync_mrn_approval_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_count BIGINT;
BEGIN
  SELECT count(*) INTO pending_count
  FROM public.inventory_requests
  WHERE status = 'PENDING';

  DELETE FROM public.notifications WHERE type = 'mrn_approval';

  IF pending_count > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, href)
    SELECT
      users.id,
      'mrn_approval',
      'MRN Approvals Required',
      pending_count::text || ' MRN request' ||
        CASE WHEN pending_count = 1 THEN '' ELSE 's' END ||
        ' awaiting your approval.',
      '/dashboard/inventory-requests/history'
    FROM public.users
    WHERE users.role = 'admin'
       OR COALESCE(users.inventory_admin, false) = true
       OR COALESCE(users.permissions, '[]'::jsonb) @> '["/dashboard/inventory-requests/history"]'::jsonb
       OR COALESCE(users.permissions, '[]'::jsonb) @> '["/dashboard/inventory-requests"]'::jsonb;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_mrn_approval_notifications_trigger
  ON public.inventory_requests;
CREATE TRIGGER sync_mrn_approval_notifications_trigger
AFTER INSERT OR UPDATE OF status OR DELETE
ON public.inventory_requests
FOR EACH STATEMENT
EXECUTE FUNCTION public.sync_mrn_approval_notifications();

-- Notify the employee who submitted the MRN when an approver makes a decision.
CREATE OR REPLACE FUNCTION public.notify_mrn_requester_of_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_name TEXT;
  requester_department TEXT;
  destination TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'PENDING' THEN
    DELETE FROM public.notifications
    WHERE type = 'mrn_result' AND inventory_request_id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('APPROVED', 'REJECTED') THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(inventory_items.name, NEW.brand, 'requested item')
  INTO item_name
  FROM (SELECT 1) seed
  LEFT JOIN public.inventory_items ON inventory_items.id = NEW.item_id;

  SELECT users.department INTO requester_department
  FROM public.users
  WHERE users.id = NEW.requested_by;

  destination := CASE
    WHEN lower(COALESCE(requester_department, '')) = 'kitchen'
      THEN '/dashboard/kitchen/inventory-requests'
    ELSE '/dashboard/inventory-requests/view-history'
  END;

  DELETE FROM public.notifications
  WHERE type = 'mrn_result' AND inventory_request_id = NEW.id;

  INSERT INTO public.notifications (
    user_id, type, title, message, href, inventory_request_id
  ) VALUES (
    NEW.requested_by,
    'mrn_result',
    CASE WHEN NEW.status = 'APPROVED' THEN 'MRN Approved' ELSE 'MRN Rejected' END,
    'Your MRN for ' || NEW.requested_quantity::text || ' of ' || item_name ||
      ' was ' || lower(NEW.status) || '.' ||
      CASE WHEN NEW.status = 'REJECTED' AND COALESCE(NEW.action_metadata->>'rejection_reason', '') <> ''
        THEN ' Reason: ' || NEW.action_metadata->>'rejection_reason'
        ELSE '' END,
    destination,
    NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_mrn_requester_of_decision_trigger
  ON public.inventory_requests;
CREATE TRIGGER notify_mrn_requester_of_decision_trigger
AFTER UPDATE OF status
ON public.inventory_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_mrn_requester_of_decision();

-- Populate approver notifications for MRNs that are already pending.
UPDATE public.inventory_requests SET status = status WHERE false;
