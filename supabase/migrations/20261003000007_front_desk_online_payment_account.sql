ALTER TABLE public.front_desk_account_settings
  ADD COLUMN IF NOT EXISTS online_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS online_account_transaction_id UUID REFERENCES public.account_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_required_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_balance_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT,
  ADD COLUMN IF NOT EXISTS payment_environment TEXT,
  ADD COLUMN IF NOT EXISTS payhere_order_id TEXT,
  ADD COLUMN IF NOT EXISTS payhere_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payhere_status_code TEXT,
  ADD COLUMN IF NOT EXISTS payhere_status_message TEXT,
  ADD COLUMN IF NOT EXISTS payhere_method TEXT,
  ADD COLUMN IF NOT EXISTS payhere_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS payhere_currency TEXT,
  ADD COLUMN IF NOT EXISTS payhere_received_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS chalet_bookings_online_account_transaction_idx
  ON public.chalet_bookings(online_account_transaction_id)
  WHERE online_account_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.post_chalet_online_payment(p_booking_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  booking_record public.chalet_bookings%ROWTYPE;
  settings_record public.front_desk_account_settings%ROWTYPE;
  account_balance NUMERIC;
  new_balance NUMERIC;
  transaction_id UUID;
  paid_amount NUMERIC;
  paid_currency TEXT;
  exchange_rate NUMERIC := 0;
  allocation JSONB;
  allocation_package_id UUID;
  allocation_category_id UUID;
  amount_lkr NUMERIC;
BEGIN
  SELECT * INTO booking_record
  FROM public.chalet_bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF booking_record.online_account_transaction_id IS NOT NULL THEN
    RETURN booking_record.online_account_transaction_id;
  END IF;

  IF COALESCE(booking_record.payment_status, '') <> 'paid' THEN
    RETURN NULL;
  END IF;

  paid_amount := COALESCE(booking_record.payhere_amount, booking_record.payment_required_amount, booking_record.amount_paid, 0);
  paid_currency := UPPER(COALESCE(NULLIF(booking_record.payhere_currency, ''), booking_record.currency, 'LKR'));

  IF paid_amount <= 0 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO settings_record
  FROM public.front_desk_account_settings
  WHERE singleton = true;

  IF settings_record.online_account_id IS NULL THEN
    RAISE EXCEPTION 'Set the Front Desk Online Payment Account before posting online payments.';
  END IF;

  SELECT current_balance INTO account_balance
  FROM public.accounts
  WHERE id = settings_record.online_account_id AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The configured Front Desk Online Payment Account is inactive or unavailable.';
  END IF;

  IF paid_currency = 'USD' THEN
    allocation := CASE
      WHEN jsonb_typeof(to_jsonb(booking_record.room_allocations)) = 'array'
      THEN to_jsonb(booking_record.room_allocations)->0
      ELSE NULL
    END;

    allocation_package_id := NULLIF(COALESCE(allocation->>'packageId', allocation->>'package_id', ''), '')::UUID;
    allocation_category_id := NULLIF(COALESCE(allocation->>'roomCategoryId', allocation->>'room_category_id', ''), '')::UUID;

    SELECT COALESCE(usd_to_lkr_rate, 0) INTO exchange_rate
    FROM public.chalet_rates
    WHERE package_id = COALESCE(booking_record.package_id, allocation_package_id)
      AND occupancy_type_id IS NULL
      AND COALESCE(room_category_id::TEXT, '') = COALESCE(COALESCE(booking_record.room_category_id, allocation_category_id)::TEXT, '')
    LIMIT 1;

    IF COALESCE(exchange_rate, 0) <= 0 THEN
      SELECT COALESCE(usd_to_lkr_rate, 0) INTO exchange_rate
      FROM public.chalet_rates
      WHERE package_id = COALESCE(booking_record.package_id, allocation_package_id)
        AND occupancy_type_id IS NULL
        AND room_category_id IS NULL
      LIMIT 1;
    END IF;

    IF COALESCE(exchange_rate, 0) <= 0 THEN
      RAISE EXCEPTION 'USD to LKR rate is missing for this booking.';
    END IF;

    amount_lkr := paid_amount * exchange_rate;
  ELSE
    amount_lkr := paid_amount;
  END IF;

  amount_lkr := ROUND(amount_lkr, 2);
  new_balance := account_balance + amount_lkr;

  INSERT INTO public.account_transactions(account_id, type, amount, description, reference, date, balance_after)
  VALUES (
    settings_record.online_account_id,
    'credit',
    amount_lkr,
    'Front Desk online payment',
    COALESCE(booking_record.payhere_order_id, booking_record.booking_ref, booking_record.id::TEXT),
    CURRENT_DATE,
    new_balance
  )
  RETURNING id INTO transaction_id;

  UPDATE public.accounts
  SET current_balance = new_balance, updated_at = NOW()
  WHERE id = settings_record.online_account_id;

  UPDATE public.chalet_bookings
  SET online_account_transaction_id = transaction_id,
      payment_method = COALESCE(payment_method, 'online'),
      amount_paid = GREATEST(COALESCE(amount_paid, 0), paid_amount),
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN transaction_id;
END;
$$;
