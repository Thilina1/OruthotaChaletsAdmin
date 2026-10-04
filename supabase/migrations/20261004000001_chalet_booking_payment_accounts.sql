-- Payments recorded against a chalet booking from the admin booking form.
-- Card and online payments post straight to the Front Desk Card / Online
-- Payment Accounts; cash stays in the Front Desk cash balance until it is
-- transferred to Accounting (transfer_front_desk_cash).
CREATE TABLE IF NOT EXISTS public.chalet_booking_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.chalet_bookings(id) ON DELETE SET NULL,
  booking_ref TEXT,
  customer_name TEXT,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'online')),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  account_transaction_id UUID REFERENCES public.account_transactions(id) ON DELETE SET NULL,
  recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chalet_booking_payments_booking_idx
  ON public.chalet_booking_payments(booking_id);
CREATE INDEX IF NOT EXISTS chalet_booking_payments_paid_idx
  ON public.chalet_booking_payments(paid_at DESC);

ALTER TABLE public.chalet_booking_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_chalet_booking_payments" ON public.chalet_booking_payments;
CREATE POLICY "allow_all_chalet_booking_payments"
  ON public.chalet_booking_payments FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.record_chalet_booking_payment(
  p_booking_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_user_id UUID,
  p_mark_paid BOOLEAN
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  booking_record public.chalet_bookings%ROWTYPE;
  destination_account_id UUID;
  account_balance NUMERIC;
  new_balance NUMERIC;
  transaction_id UUID;
  payment_id UUID := gen_random_uuid();
  payment_amount NUMERIC := ROUND(COALESCE(p_amount, 0), 2);
BEGIN
  IF payment_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;
  IF p_method IS NULL OR p_method NOT IN ('cash', 'card', 'online') THEN
    RAISE EXCEPTION 'Payment method must be cash, card or online';
  END IF;

  SELECT * INTO booking_record
  FROM public.chalet_bookings
  WHERE id = p_booking_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF p_method IN ('card', 'online') THEN
    SELECT CASE WHEN p_method = 'card' THEN card_account_id ELSE online_account_id END
    INTO destination_account_id
    FROM public.front_desk_account_settings
    WHERE singleton = true;

    IF destination_account_id IS NULL THEN
      RAISE EXCEPTION 'Set the Front Desk % Payment Account before accepting % payments.',
        CASE WHEN p_method = 'card' THEN 'Card' ELSE 'Online' END, p_method;
    END IF;

    SELECT current_balance INTO account_balance
    FROM public.accounts
    WHERE id = destination_account_id AND is_active = true
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The configured Front Desk % payment account is inactive or unavailable.', p_method;
    END IF;

    new_balance := account_balance + payment_amount;

    INSERT INTO public.account_transactions(account_id, type, amount, description, reference, date, balance_after)
    VALUES (
      destination_account_id,
      'credit',
      payment_amount,
      'Front Desk ' || p_method || ' payment - Chalet booking',
      COALESCE(booking_record.booking_ref, booking_record.id::TEXT),
      CURRENT_DATE,
      new_balance
    )
    RETURNING id INTO transaction_id;

    UPDATE public.accounts
    SET current_balance = new_balance, updated_at = NOW()
    WHERE id = destination_account_id;
  END IF;

  INSERT INTO public.chalet_booking_payments(
    id, booking_id, booking_ref, customer_name, amount, payment_method,
    account_id, account_transaction_id, recorded_by
  )
  VALUES (
    payment_id, p_booking_id, booking_record.booking_ref, booking_record.customer_name, payment_amount, p_method,
    destination_account_id, transaction_id, p_user_id
  );

  UPDATE public.chalet_bookings
  SET amount_paid = COALESCE(amount_paid, 0) + payment_amount,
      payment_method = p_method,
      payment_status = CASE WHEN p_mark_paid THEN 'paid' ELSE payment_status END,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN payment_id;
END;
$$;

-- Front Desk cash now also includes cash taken against chalet bookings.
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

  gross_cash := gross_cash + (
    SELECT COALESCE(sum(amount), 0)
    FROM public.chalet_booking_payments
    WHERE payment_method = 'cash'
  );

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
