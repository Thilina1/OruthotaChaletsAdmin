ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_method_check' AND conrelid = 'public.orders'::regclass) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card'));
  END IF;
END; $$;

CREATE INDEX IF NOT EXISTS orders_restaurant_cash_idx ON public.orders(payment_method, paid_at DESC) WHERE status = 'closed';

CREATE TABLE IF NOT EXISTS public.restaurant_cash_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  transferred_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  account_transaction_id UUID NOT NULL REFERENCES public.account_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.restaurant_cash_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_restaurant_cash_transfers" ON public.restaurant_cash_transfers;
CREATE POLICY "allow_all_restaurant_cash_transfers" ON public.restaurant_cash_transfers FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS restaurant_cash_transfers_created_idx ON public.restaurant_cash_transfers(created_at DESC);

CREATE OR REPLACE FUNCTION public.transfer_restaurant_cash(p_account_id UUID, p_amount NUMERIC, p_notes TEXT, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  gross_cash NUMERIC(15,2); transferred_cash NUMERIC(15,2); available_cash NUMERIC(15,2);
  current_account_balance NUMERIC(15,2); new_account_balance NUMERIC(15,2);
  transfer_id UUID := gen_random_uuid(); transaction_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Transfer amount must be greater than zero'; END IF;
  -- A global transaction lock prevents simultaneous transfers to different
  -- accounts from spending the same restaurant cash balance.
  PERFORM pg_advisory_xact_lock(hashtext('restaurant_cash_transfer'));
  SELECT current_balance INTO current_account_balance FROM public.accounts WHERE id = p_account_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active destination account not found'; END IF;
  SELECT COALESCE(sum(COALESCE(confirmed_total, total_price, 0)), 0) INTO gross_cash FROM public.orders WHERE status = 'closed' AND payment_method = 'cash';
  SELECT COALESCE(sum(amount), 0) INTO transferred_cash FROM public.restaurant_cash_transfers;
  available_cash := gross_cash - transferred_cash;
  IF p_amount > available_cash THEN RAISE EXCEPTION 'Transfer exceeds available restaurant cash. Available: %', available_cash; END IF;
  new_account_balance := current_account_balance + p_amount;
  INSERT INTO public.account_transactions(account_id, type, amount, description, reference, date, balance_after)
  VALUES (p_account_id, 'credit', p_amount, 'Restaurant cash transfer', 'REST-CASH-' || left(transfer_id::text, 8), CURRENT_DATE, new_account_balance)
  RETURNING id INTO transaction_id;
  UPDATE public.accounts SET current_balance = new_account_balance, updated_at = NOW() WHERE id = p_account_id;
  INSERT INTO public.restaurant_cash_transfers(id, account_id, amount, notes, transferred_by, account_transaction_id)
  VALUES (transfer_id, p_account_id, p_amount, NULLIF(trim(p_notes), ''), p_user_id, transaction_id);
  RETURN transfer_id;
END; $$;
