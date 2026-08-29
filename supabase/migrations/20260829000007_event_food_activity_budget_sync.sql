ALTER TABLE public.event_budget_items
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS event_budget_items_source_unique
  ON public.event_budget_items(source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_event_food_budget_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calculated_amount NUMERIC(15,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.event_budget_items
    WHERE source_type = 'food' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  calculated_amount := ROUND((NEW.quantity * NEW.unit_price)::numeric, 2);

  UPDATE public.event_budget_items
  SET event_id = NEW.event_id,
      category = 'Food & Catering',
      description = NEW.name || ' (' || NEW.quantity::text || ' ' || NEW.unit || ')',
      estimated_amount = calculated_amount,
      actual_amount = calculated_amount,
      updated_at = NOW()
  WHERE source_type = 'food' AND source_id = NEW.id;

  IF NOT FOUND THEN
    INSERT INTO public.event_budget_items(
      event_id, category, description, budget_type,
      estimated_amount, actual_amount, payment_status,
      source_type, source_id
    ) VALUES (
      NEW.event_id, 'Food & Catering',
      NEW.name || ' (' || NEW.quantity::text || ' ' || NEW.unit || ')',
      'expense', calculated_amount, calculated_amount, 'planned',
      'food', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_event_activity_budget_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.event_budget_items
    WHERE source_type = 'activity' AND source_id = OLD.id;
    RETURN OLD;
  END IF;

  UPDATE public.event_budget_items
  SET event_id = NEW.event_id,
      category = 'Activities',
      description = NEW.name || COALESCE(' - ' || NULLIF(NEW.provider, ''), ''),
      estimated_amount = NEW.cost,
      actual_amount = NEW.cost,
      updated_at = NOW()
  WHERE source_type = 'activity' AND source_id = NEW.id;

  IF NOT FOUND THEN
    INSERT INTO public.event_budget_items(
      event_id, category, description, budget_type,
      estimated_amount, actual_amount, payment_status,
      source_type, source_id
    ) VALUES (
      NEW.event_id, 'Activities',
      NEW.name || COALESCE(' - ' || NULLIF(NEW.provider, ''), ''),
      'expense', NEW.cost, NEW.cost, 'planned',
      'activity', NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_event_food_budget_item_trigger ON public.event_food_items;
CREATE TRIGGER sync_event_food_budget_item_trigger
AFTER INSERT OR UPDATE OF event_id, name, quantity, unit, unit_price OR DELETE
ON public.event_food_items
FOR EACH ROW EXECUTE FUNCTION public.sync_event_food_budget_item();

DROP TRIGGER IF EXISTS sync_event_activity_budget_item_trigger ON public.event_activities;
CREATE TRIGGER sync_event_activity_budget_item_trigger
AFTER INSERT OR UPDATE OF event_id, name, provider, cost OR DELETE
ON public.event_activities
FOR EACH ROW EXECUTE FUNCTION public.sync_event_activity_budget_item();

-- Backfill budget rows for food and activities created before this migration.
INSERT INTO public.event_budget_items(
  event_id, category, description, budget_type,
  estimated_amount, actual_amount, payment_status,
  source_type, source_id
)
SELECT
  food.event_id,
  'Food & Catering',
  food.name || ' (' || food.quantity::text || ' ' || food.unit || ')',
  'expense',
  ROUND((food.quantity * food.unit_price)::numeric, 2),
  ROUND((food.quantity * food.unit_price)::numeric, 2),
  'planned',
  'food',
  food.id
FROM public.event_food_items food
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_budget_items budget
  WHERE budget.source_type = 'food' AND budget.source_id = food.id
);

INSERT INTO public.event_budget_items(
  event_id, category, description, budget_type,
  estimated_amount, actual_amount, payment_status,
  source_type, source_id
)
SELECT
  activity.event_id,
  'Activities',
  activity.name || COALESCE(' - ' || NULLIF(activity.provider, ''), ''),
  'expense',
  activity.cost,
  activity.cost,
  'planned',
  'activity',
  activity.id
FROM public.event_activities activity
WHERE NOT EXISTS (
  SELECT 1 FROM public.event_budget_items budget
  WHERE budget.source_type = 'activity' AND budget.source_id = activity.id
);

COMMENT ON COLUMN public.event_budget_items.source_type IS 'Automatic budget source: food or activity; NULL for manual items';
COMMENT ON COLUMN public.event_budget_items.source_id IS 'ID of the food or activity row that owns this automatic budget item';
