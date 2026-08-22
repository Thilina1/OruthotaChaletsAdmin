-- A table can have only one active service session. Some existing databases
-- already contain duplicate active orders, so use a trigger instead of a
-- unique index. This preserves those bills while preventing new duplicates.
DROP INDEX IF EXISTS public.orders_one_active_order_per_table;

CREATE OR REPLACE FUNCTION public.enforce_one_active_order_per_table()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.table_id IS NULL OR NEW.status NOT IN ('open', 'billed') THEN
    RETURN NEW;
  END IF;

  -- Serialize attempts for the same table, including concurrent requests.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.table_id::TEXT, 0));

  IF EXISTS (
    SELECT 1
    FROM public.orders existing_order
    WHERE existing_order.table_id = NEW.table_id
      AND existing_order.status IN ('open', 'billed')
      AND existing_order.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Table % already has an active order', NEW.table_id
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_enforce_one_active_order_per_table ON public.orders;
CREATE TRIGGER orders_enforce_one_active_order_per_table
  BEFORE INSERT OR UPDATE OF table_id, status
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_one_active_order_per_table();

COMMENT ON FUNCTION public.enforce_one_active_order_per_table() IS
  'Prevents new duplicate active orders without modifying existing order records.';
