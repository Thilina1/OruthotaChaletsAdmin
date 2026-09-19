ALTER TABLE public.inventory_cash_requests
  ADD COLUMN IF NOT EXISTS returned_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS returned_account_transaction_id UUID REFERENCES public.account_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS returned_moved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS returned_moved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS inventory_cash_requests_returned_account_idx
  ON public.inventory_cash_requests(returned_account_id)
  WHERE returned_account_id IS NOT NULL;
