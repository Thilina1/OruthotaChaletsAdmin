CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Authentication is handled by the application's HTTP-only auth_token cookie,
-- and all notification access is scoped by the server API. Allow the API's
-- configured Supabase client to perform the required database operations.
DROP POLICY IF EXISTS "Allow notification API access" ON public.notifications;
CREATE POLICY "Allow notification API access"
  ON public.notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);
