-- Price lock: a chalet booking keeps the prices it was made with. Later
-- changes to Chalet Rates, Bill Settings or the USD to LKR rate only affect new
-- bookings. Charges (service charge / VAT / SSCL and "applies to") are already
-- stored per booking; this adds the locked exchange rate.

-- Current USD to LKR rate for a booking's package and room category (falls
-- back to the package's rate without a category).
CREATE OR REPLACE FUNCTION public.chalet_booking_current_usd_rate(p_package_id UUID, p_room_category_id UUID, p_room_allocations JSONB)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  allocation JSONB;
  package_id_value UUID;
  category_id_value UUID;
  rate NUMERIC := 0;
BEGIN
  allocation := CASE WHEN jsonb_typeof(p_room_allocations) = 'array' THEN p_room_allocations->0 ELSE NULL END;
  package_id_value := COALESCE(p_package_id, NULLIF(COALESCE(allocation->>'packageId', allocation->>'package_id', ''), '')::UUID);
  category_id_value := COALESCE(p_room_category_id, NULLIF(COALESCE(allocation->>'roomCategoryId', allocation->>'room_category_id', ''), '')::UUID);
  IF package_id_value IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(r.usd_to_lkr_rate, 0) INTO rate
  FROM public.chalet_rates r
  WHERE r.package_id = package_id_value
    AND r.occupancy_type_id IS NULL
    AND COALESCE(r.room_category_id::TEXT, '') = COALESCE(category_id_value::TEXT, '')
  LIMIT 1;

  IF COALESCE(rate, 0) <= 0 THEN
    SELECT COALESCE(r.usd_to_lkr_rate, 0) INTO rate
    FROM public.chalet_rates r
    WHERE r.package_id = package_id_value
      AND r.occupancy_type_id IS NULL
      AND r.room_category_id IS NULL
    LIMIT 1;
  END IF;

  RETURN COALESCE(rate, 0);
END;
$$;

ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS usd_to_lkr_rate NUMERIC(12,4);

-- Lock existing bookings at today's rate (no rate was saved for them before).
UPDATE public.chalet_bookings
SET usd_to_lkr_rate = NULLIF(public.chalet_booking_current_usd_rate(package_id, room_category_id, to_jsonb(room_allocations)), 0)
WHERE usd_to_lkr_rate IS NULL;

-- New bookings (admin form or website) get the rate in force when created,
-- unless one is given.
CREATE OR REPLACE FUNCTION public.set_chalet_booking_usd_rate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.usd_to_lkr_rate IS NULL OR NEW.usd_to_lkr_rate <= 0 THEN
    NEW.usd_to_lkr_rate := NULLIF(public.chalet_booking_current_usd_rate(NEW.package_id, NEW.room_category_id, to_jsonb(NEW.room_allocations)), 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_chalet_booking_usd_rate_trigger ON public.chalet_bookings;
CREATE TRIGGER set_chalet_booking_usd_rate_trigger
BEFORE INSERT ON public.chalet_bookings
FOR EACH ROW EXECUTE FUNCTION public.set_chalet_booking_usd_rate();

-- Website payments convert at the booking's locked rate.
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
  amount_lkr NUMERIC;
  recorded_payments NUMERIC := 0;
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
    -- The exchange rate locked on the booking when it was made.
    exchange_rate := COALESCE(booking_record.usd_to_lkr_rate, 0);
    IF exchange_rate <= 0 THEN
      exchange_rate := public.chalet_booking_current_usd_rate(booking_record.package_id, booking_record.room_category_id, to_jsonb(booking_record.room_allocations));
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

  SELECT COALESCE(sum(amount), 0) INTO recorded_payments
  FROM public.chalet_booking_payments
  WHERE booking_id = p_booking_id;

  UPDATE public.chalet_bookings
  SET online_account_transaction_id = transaction_id,
      payment_method = COALESCE(payment_method, 'online'),
      amount_paid = amount_lkr + recorded_payments,
      updated_at = NOW()
  WHERE id = p_booking_id;

  RETURN transaction_id;
END;
$$;
