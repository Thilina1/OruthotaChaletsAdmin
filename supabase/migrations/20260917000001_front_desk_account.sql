CREATE TABLE IF NOT EXISTS public.guest_bill_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guest_bill_history_customer_paid_idx
  ON public.guest_bill_history (customer_id, paid_at DESC);

ALTER TABLE public.guest_bill_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read guest bill history" ON public.guest_bill_history;
CREATE POLICY "Authenticated users can read guest bill history"
  ON public.guest_bill_history FOR SELECT TO authenticated USING (true);

ALTER TABLE public.guest_bill_history
  ADD COLUMN IF NOT EXISTS account_transaction_id UUID
  REFERENCES public.account_transactions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.front_desk_account_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton = true),
  card_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.front_desk_account_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_front_desk_account_settings" ON public.front_desk_account_settings;
CREATE POLICY "allow_all_front_desk_account_settings"
  ON public.front_desk_account_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.front_desk_account_settings(singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.front_desk_cash_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  transferred_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  account_transaction_id UUID NOT NULL REFERENCES public.account_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.front_desk_cash_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_front_desk_cash_transfers" ON public.front_desk_cash_transfers;
CREATE POLICY "allow_all_front_desk_cash_transfers"
  ON public.front_desk_cash_transfers FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.transfer_front_desk_cash(p_account_id UUID, p_amount NUMERIC, p_notes TEXT, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  gross_cash NUMERIC;
  transferred NUMERIC;
  available NUMERIC;
  account_balance NUMERIC;
  new_balance NUMERIC;
  transfer_id UUID := gen_random_uuid();
  transaction_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('front_desk_cash_transfer'));

  SELECT current_balance INTO account_balance
  FROM public.accounts
  WHERE id = p_account_id AND is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active destination account not found'; END IF;

  SELECT COALESCE(sum(total), 0) INTO gross_cash
  FROM public.guest_bill_history
  WHERE payment_method = 'cash';

  SELECT COALESCE(sum(amount), 0) INTO transferred
  FROM public.front_desk_cash_transfers;

  available := gross_cash - transferred;
  IF p_amount > available THEN
    RAISE EXCEPTION 'Transfer exceeds available front desk cash. Available: %', available;
  END IF;

  new_balance := account_balance + p_amount;

  INSERT INTO public.account_transactions(account_id, type, amount, description, reference, date, balance_after)
  VALUES (
    p_account_id,
    'credit',
    p_amount,
    'Front Desk cash transfer',
    'FD-CASH-' || left(transfer_id::text, 8),
    CURRENT_DATE,
    new_balance
  )
  RETURNING id INTO transaction_id;

  UPDATE public.accounts
  SET current_balance = new_balance, updated_at = NOW()
  WHERE id = p_account_id;

  INSERT INTO public.front_desk_cash_transfers(id, account_id, amount, notes, transferred_by, account_transaction_id)
  VALUES (transfer_id, p_account_id, p_amount, NULLIF(trim(p_notes), ''), p_user_id, transaction_id);

  RETURN transfer_id;
END;
$$;

CREATE INDEX IF NOT EXISTS front_desk_cash_transfers_created_idx
  ON public.front_desk_cash_transfers(created_at DESC);

CREATE INDEX IF NOT EXISTS guest_bill_history_account_transaction_idx
  ON public.guest_bill_history(account_transaction_id)
  WHERE account_transaction_id IS NOT NULL;
