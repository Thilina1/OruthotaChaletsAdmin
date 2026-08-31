ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS card_account_transaction_id UUID
  REFERENCES public.account_transactions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.restaurant_account_settings (
  singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton = true),
  card_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.restaurant_account_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_restaurant_account_settings" ON public.restaurant_account_settings;
CREATE POLICY "allow_all_restaurant_account_settings"
  ON public.restaurant_account_settings FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.restaurant_account_settings(singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.post_restaurant_card_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  destination_account_id UUID;
  current_account_balance NUMERIC(15,2);
  payment_amount NUMERIC(15,2);
  new_account_balance NUMERIC(15,2);
  transaction_id UUID;
BEGIN
  IF NEW.status <> 'closed'
     OR NEW.payment_method <> 'card'
     OR NEW.card_account_transaction_id IS NOT NULL
     OR (OLD.status = 'closed' AND OLD.payment_method = 'card') THEN
    RETURN NEW;
  END IF;

  SELECT card_account_id INTO destination_account_id
  FROM public.restaurant_account_settings
  WHERE singleton = true;

  IF destination_account_id IS NULL THEN
    RAISE EXCEPTION 'Set the Card Payment Account in Restaurant Account before accepting card payments';
  END IF;

  SELECT current_balance INTO current_account_balance
  FROM public.accounts
  WHERE id = destination_account_id AND is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The configured Card Payment Account is inactive or unavailable'; END IF;

  payment_amount := COALESCE(NEW.confirmed_total, NEW.total_price, 0);
  IF payment_amount <= 0 THEN RAISE EXCEPTION 'Card payment amount must be greater than zero'; END IF;
  new_account_balance := current_account_balance + payment_amount;

  INSERT INTO public.account_transactions(account_id, type, amount, description, reference, date, balance_after)
  VALUES (
    destination_account_id,
    'credit',
    payment_amount,
    'Restaurant card payment',
    'REST-' || upper(left(NEW.id::text, 8)),
    COALESCE(NEW.paid_at::date, CURRENT_DATE),
    new_account_balance
  ) RETURNING id INTO transaction_id;

  UPDATE public.accounts
  SET current_balance = new_account_balance, updated_at = NOW()
  WHERE id = destination_account_id;

  UPDATE public.orders
  SET card_account_transaction_id = transaction_id
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_restaurant_card_payment_trigger ON public.orders;
CREATE TRIGGER post_restaurant_card_payment_trigger
AFTER UPDATE OF status, payment_method
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.post_restaurant_card_payment();

CREATE INDEX IF NOT EXISTS orders_card_account_transaction_idx
  ON public.orders(card_account_transaction_id)
  WHERE card_account_transaction_id IS NOT NULL;
