-- The Kitchen Orders display (and other live order screens) subscribe to
-- postgres_changes on `orders` and `order_items`, but a table only emits
-- those events if it's part of the `supabase_realtime` publication. Without
-- this, updates (e.g. marking a dish as cooking/done) silently never reach
-- other open screens until they're manually reloaded.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

-- Ensures UPDATE events carry the full row (not just changed columns + PK),
-- which some realtime consumers rely on.
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
