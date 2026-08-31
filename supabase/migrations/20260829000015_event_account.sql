CREATE TABLE IF NOT EXISTS public.event_account_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton = true),
  card_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.event_account_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_event_account_settings" ON public.event_account_settings;
CREATE POLICY "allow_all_event_account_settings" ON public.event_account_settings FOR ALL USING (true) WITH CHECK (true);
INSERT INTO public.event_account_settings(singleton) VALUES(true) ON CONFLICT(singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.event_cash_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES public.accounts(id),
  amount NUMERIC(15,2) NOT NULL CHECK(amount>0), notes TEXT,
  transferred_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  account_transaction_id UUID NOT NULL REFERENCES public.account_transactions(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.event_cash_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_event_cash_transfers" ON public.event_cash_transfers;
CREATE POLICY "allow_all_event_cash_transfers" ON public.event_cash_transfers FOR ALL USING(true) WITH CHECK(true);

CREATE OR REPLACE FUNCTION public.transfer_event_cash(p_account_id UUID,p_amount NUMERIC,p_notes TEXT,p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE gross NUMERIC; moved NUMERIC; available NUMERIC; balance NUMERIC; after_balance NUMERIC; transfer_id UUID:=gen_random_uuid(); tx_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Transfer amount must be greater than zero'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('event_cash_transfer'));
  SELECT current_balance INTO balance FROM public.accounts WHERE id=p_account_id AND is_active=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active destination account not found'; END IF;
  -- Older cash payments were posted directly by the previous workflow. Only
  -- unposted cash belongs to the new Event Cash balance.
  SELECT COALESCE(sum(CASE WHEN payment_type='refund' THEN -amount ELSE amount END),0)
  INTO gross FROM public.event_payments
  WHERE payment_method='cash' AND account_transaction_id IS NULL;
  SELECT COALESCE(sum(amount),0) INTO moved FROM public.event_cash_transfers; available:=gross-moved;
  IF p_amount>available THEN RAISE EXCEPTION 'Transfer exceeds available event cash. Available: %',available; END IF;
  after_balance:=balance+p_amount;
  INSERT INTO public.account_transactions(account_id,type,amount,description,reference,date,balance_after) VALUES(p_account_id,'credit',p_amount,'Event cash transfer','EVT-CASH-'||left(transfer_id::text,8),CURRENT_DATE,after_balance) RETURNING id INTO tx_id;
  UPDATE public.accounts SET current_balance=after_balance,updated_at=NOW() WHERE id=p_account_id;
  INSERT INTO public.event_cash_transfers(id,account_id,amount,notes,transferred_by,account_transaction_id) VALUES(transfer_id,p_account_id,p_amount,NULLIF(trim(p_notes),''),p_user_id,tx_id);
  RETURN transfer_id;
END; $$;

-- Replace the old per-payment receiving-account trigger. Cash stays in Event
-- Cash; card payments use the configured card account. Financial income is
-- still recorded for both methods.
CREATE OR REPLACE FUNCTION public.post_event_payment_to_accounts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE destination UUID; balance NUMERIC; after_balance NUMERIC; tx_id UUID; income_id UUID; event_name TEXT; tx_type TEXT; entry TEXT;
BEGIN
  IF NEW.payment_method IS NULL OR NEW.payment_method NOT IN ('cash','card') THEN
    RAISE EXCEPTION 'Event payment method must be cash or card';
  END IF;
  SELECT name INTO event_name FROM public.events WHERE id=NEW.event_id;
  tx_type:=CASE WHEN NEW.payment_type='refund' THEN 'debit' ELSE 'credit' END;
  entry:=CASE WHEN NEW.payment_type='refund' THEN 'Event refund - ' ELSE 'Event payment - ' END||COALESCE(event_name,'Event')||' - '||NEW.payer_name;
  IF NEW.payment_method='card' THEN
    SELECT card_account_id INTO destination FROM public.event_account_settings WHERE singleton=true;
    IF destination IS NULL THEN RAISE EXCEPTION 'Set the Event Card Payment Account before accepting card payments'; END IF;
    SELECT current_balance INTO balance FROM public.accounts WHERE id=destination AND is_active=true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Configured Event Card Payment Account is inactive or unavailable'; END IF;
    after_balance:=balance+CASE WHEN tx_type='credit' THEN NEW.amount ELSE -NEW.amount END;
    INSERT INTO public.account_transactions(account_id,type,amount,description,reference,date,balance_after) VALUES(destination,tx_type,NEW.amount,entry,NEW.receipt_number,NEW.paid_at::date,after_balance) RETURNING id INTO tx_id;
    UPDATE public.accounts SET current_balance=after_balance,updated_at=NOW() WHERE id=destination;
    UPDATE public.event_payments SET account_id=destination,account_transaction_id=tx_id WHERE id=NEW.id;
  END IF;
  INSERT INTO public.other_incomes(description,amount,source,date) VALUES(entry,CASE WHEN NEW.payment_type='refund' THEN -NEW.amount ELSE NEW.amount END,'Event Management',NEW.paid_at::date) RETURNING id INTO income_id;
  UPDATE public.event_payments SET other_income_id=income_id WHERE id=NEW.id;
  RETURN NEW;
END; $$;

COMMENT ON COLUMN public.event_payments.account_id IS 'Automatically selected card account; null for cash held in Event Cash';
CREATE INDEX IF NOT EXISTS event_cash_transfers_created_idx ON public.event_cash_transfers(created_at DESC);
