ALTER TABLE public.event_payments
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id),
  ADD COLUMN IF NOT EXISTS account_transaction_id UUID REFERENCES public.account_transactions(id),
  ADD COLUMN IF NOT EXISTS other_income_id UUID REFERENCES public.other_incomes(id);

CREATE UNIQUE INDEX IF NOT EXISTS event_payments_account_transaction_unique
  ON public.event_payments(account_transaction_id)
  WHERE account_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS event_payments_other_income_unique
  ON public.event_payments(other_income_id)
  WHERE other_income_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_payments_account_idx
  ON public.event_payments(account_id);

CREATE OR REPLACE FUNCTION public.post_event_payment_to_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_record public.accounts%ROWTYPE;
  event_record public.events%ROWTYPE;
  transaction_id UUID;
  income_id UUID;
  new_balance NUMERIC(15,2);
  transaction_type TEXT;
  entry_description TEXT;
BEGIN
  IF NEW.account_id IS NULL THEN
    RAISE EXCEPTION 'A receiving account is required for event payments';
  END IF;

  SELECT * INTO account_record
  FROM public.accounts
  WHERE id = NEW.account_id AND is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active receiving account not found'; END IF;

  SELECT * INTO event_record FROM public.events WHERE id = NEW.event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;

  transaction_type := CASE WHEN NEW.payment_type = 'refund' THEN 'debit' ELSE 'credit' END;
  new_balance := account_record.current_balance + CASE WHEN transaction_type = 'credit' THEN NEW.amount ELSE -NEW.amount END;
  entry_description := CASE WHEN NEW.payment_type = 'refund' THEN 'Event refund - ' ELSE 'Event payment - ' END || event_record.name || ' - ' || NEW.payer_name;

  INSERT INTO public.account_transactions(account_id, type, amount, description, reference, date, balance_after)
  VALUES (NEW.account_id, transaction_type, NEW.amount, entry_description, NEW.receipt_number, NEW.paid_at::date, new_balance)
  RETURNING id INTO transaction_id;

  UPDATE public.accounts
  SET current_balance = new_balance, updated_at = NOW()
  WHERE id = NEW.account_id;

  -- Refunds are represented as negative income in financial reporting.
  INSERT INTO public.other_incomes(description, amount, source, date)
  VALUES (entry_description, CASE WHEN NEW.payment_type = 'refund' THEN -NEW.amount ELSE NEW.amount END, 'Event Management', NEW.paid_at::date)
  RETURNING id INTO income_id;

  UPDATE public.event_payments
  SET account_transaction_id = transaction_id, other_income_id = income_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_event_payment_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  transaction_record public.account_transactions%ROWTYPE;
BEGIN
  IF OLD.account_transaction_id IS NOT NULL THEN
    SELECT * INTO transaction_record
    FROM public.account_transactions
    WHERE id = OLD.account_transaction_id;

    IF FOUND THEN
      UPDATE public.accounts
      SET current_balance = current_balance + CASE WHEN transaction_record.type = 'credit' THEN -transaction_record.amount ELSE transaction_record.amount END,
          updated_at = NOW()
      WHERE id = transaction_record.account_id;

      DELETE FROM public.account_transactions WHERE id = OLD.account_transaction_id;
    END IF;
  END IF;

  IF OLD.other_income_id IS NOT NULL THEN
    DELETE FROM public.other_incomes WHERE id = OLD.other_income_id;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS post_event_payment_to_accounts_trigger ON public.event_payments;
CREATE TRIGGER post_event_payment_to_accounts_trigger
AFTER INSERT ON public.event_payments
FOR EACH ROW EXECUTE FUNCTION public.post_event_payment_to_accounts();

DROP TRIGGER IF EXISTS reverse_event_payment_accounts_trigger ON public.event_payments;
CREATE TRIGGER reverse_event_payment_accounts_trigger
BEFORE DELETE ON public.event_payments
FOR EACH ROW EXECUTE FUNCTION public.reverse_event_payment_accounts();

COMMENT ON COLUMN public.event_payments.account_id IS 'Cash or bank account that received the event payment';
COMMENT ON COLUMN public.event_payments.account_transaction_id IS 'Automatically generated account ledger transaction';
COMMENT ON COLUMN public.event_payments.other_income_id IS 'Automatically generated financial-report income entry';
