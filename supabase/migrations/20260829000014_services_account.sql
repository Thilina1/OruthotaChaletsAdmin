ALTER TABLE public.service_incomes
  ADD COLUMN IF NOT EXISTS account_transaction_id UUID
  REFERENCES public.account_transactions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.services_account_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton = true),
  card_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.services_account_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_services_account_settings" ON public.services_account_settings;
CREATE POLICY "allow_all_services_account_settings" ON public.services_account_settings FOR ALL USING (true) WITH CHECK (true);
INSERT INTO public.services_account_settings(singleton) VALUES (true) ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.services_cash_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES public.accounts(id),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0), notes TEXT,
  transferred_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  account_transaction_id UUID NOT NULL REFERENCES public.account_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.services_cash_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_services_cash_transfers" ON public.services_cash_transfers;
CREATE POLICY "allow_all_services_cash_transfers" ON public.services_cash_transfers FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.transfer_services_cash(p_account_id UUID, p_amount NUMERIC, p_notes TEXT, p_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE gross_cash NUMERIC; transferred NUMERIC; available NUMERIC; account_balance NUMERIC; new_balance NUMERIC;
  transfer_id UUID := gen_random_uuid(); transaction_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Transfer amount must be greater than zero'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('services_cash_transfer'));
  SELECT accounts.current_balance INTO account_balance FROM public.accounts WHERE id = p_account_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active destination account not found'; END IF;
  SELECT COALESCE(sum(amount),0) INTO gross_cash FROM public.service_incomes WHERE payment_status = 'paid' AND payment_method = 'cash';
  SELECT COALESCE(sum(amount),0) INTO transferred FROM public.services_cash_transfers;
  available := gross_cash - transferred;
  IF p_amount > available THEN RAISE EXCEPTION 'Transfer exceeds available services cash. Available: %', available; END IF;
  new_balance := account_balance + p_amount;
  INSERT INTO public.account_transactions(account_id,type,amount,description,reference,date,balance_after)
  VALUES(p_account_id,'credit',p_amount,'Services cash transfer','SVC-CASH-'||left(transfer_id::text,8),CURRENT_DATE,new_balance) RETURNING id INTO transaction_id;
  UPDATE public.accounts SET current_balance = new_balance, updated_at = NOW() WHERE id = p_account_id;
  INSERT INTO public.services_cash_transfers(id,account_id,amount,notes,transferred_by,account_transaction_id)
  VALUES(transfer_id,p_account_id,p_amount,NULLIF(trim(p_notes),''),p_user_id,transaction_id);
  RETURN transfer_id;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_service_card_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_tx public.account_transactions%ROWTYPE; destination UUID; balance NUMERIC; new_balance NUMERIC; tx_id UUID;
  should_reverse BOOLEAN := false; should_post BOOLEAN := false; record_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN should_reverse := OLD.account_transaction_id IS NOT NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    should_reverse := OLD.account_transaction_id IS NOT NULL AND (NEW.payment_status IS DISTINCT FROM 'paid' OR NEW.payment_method IS DISTINCT FROM 'card' OR NEW.amount IS DISTINCT FROM OLD.amount);
    should_post := NEW.payment_status = 'paid' AND NEW.payment_method = 'card' AND (NEW.account_transaction_id IS NULL OR should_reverse);
  ELSE should_post := NEW.payment_status = 'paid' AND NEW.payment_method = 'card'; END IF;

  IF should_reverse THEN
    SELECT * INTO old_tx FROM public.account_transactions WHERE id = OLD.account_transaction_id;
    IF FOUND THEN
      SELECT current_balance INTO balance FROM public.accounts WHERE id = old_tx.account_id FOR UPDATE;
      UPDATE public.accounts SET current_balance = balance - old_tx.amount, updated_at = NOW() WHERE id = old_tx.account_id;
      DELETE FROM public.account_transactions WHERE id = old_tx.id;
    END IF;
  END IF;

  IF should_post THEN
    SELECT card_account_id INTO destination FROM public.services_account_settings WHERE singleton = true;
    IF destination IS NULL THEN RAISE EXCEPTION 'Set the Services Card Payment Account before accepting card payments'; END IF;
    SELECT current_balance INTO balance FROM public.accounts WHERE id = destination AND is_active = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The configured Services Card Payment Account is inactive or unavailable'; END IF;
    new_balance := balance + NEW.amount;
    INSERT INTO public.account_transactions(account_id,type,amount,description,reference,date,balance_after)
    VALUES(destination,'credit',NEW.amount,'Services card payment - '||NEW.service_type,'SVC-'||upper(left(NEW.id::text,8)),NEW.date,new_balance) RETURNING id INTO tx_id;
    UPDATE public.accounts SET current_balance = new_balance, updated_at = NOW() WHERE id = destination;
    UPDATE public.service_incomes SET account_transaction_id = tx_id WHERE id = NEW.id;
  ELSIF TG_OP = 'UPDATE' AND should_reverse THEN
    UPDATE public.service_incomes SET account_transaction_id = NULL WHERE id = NEW.id;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS sync_service_card_payment_trigger ON public.service_incomes;
CREATE TRIGGER sync_service_card_payment_trigger
AFTER INSERT OR UPDATE OF amount,payment_status,payment_method OR DELETE ON public.service_incomes
FOR EACH ROW EXECUTE FUNCTION public.sync_service_card_payment();

CREATE INDEX IF NOT EXISTS services_cash_transfers_created_idx ON public.services_cash_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS service_incomes_account_transaction_idx ON public.service_incomes(account_transaction_id) WHERE account_transaction_id IS NOT NULL;
