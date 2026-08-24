ALTER TABLE public.other_expense_cash_requests
  ALTER COLUMN expense_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.other_expense_cash_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.other_expense_cash_requests(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL UNIQUE REFERENCES public.expenses(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.other_expense_cash_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_other_expense_cash_request_items"
  ON public.other_expense_cash_request_items FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS other_expense_cash_request_items_request_idx
  ON public.other_expense_cash_request_items(request_id);

INSERT INTO public.other_expense_cash_request_items(request_id, expense_id, amount)
SELECT id, expense_id, requested_amount
FROM public.other_expense_cash_requests
WHERE expense_id IS NOT NULL
ON CONFLICT (expense_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_other_expense_cash_request(
  p_expense_ids UUID[],
  p_requested_by UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_request_id UUID;
  expense_count INTEGER;
  total_amount NUMERIC(15,2);
  request_number_value TEXT;
BEGIN
  IF COALESCE(array_length(p_expense_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one expense is required';
  END IF;

  PERFORM 1 FROM public.expenses WHERE id = ANY(p_expense_ids) FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.other_expense_cash_request_items
    WHERE expense_id = ANY(p_expense_ids)
  ) THEN
    RAISE EXCEPTION 'One or more expenses have already been requested';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO expense_count, total_amount
  FROM public.expenses
  WHERE id = ANY(p_expense_ids) AND COALESCE(is_paid, false) = false;

  IF expense_count <> array_length(p_expense_ids, 1) OR total_amount <= 0 THEN
    RAISE EXCEPTION 'Expenses must exist, be unpaid, and have a positive amount';
  END IF;

  request_number_value := 'OER-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || RIGHT(EXTRACT(EPOCH FROM clock_timestamp())::BIGINT::TEXT, 6);
  INSERT INTO public.other_expense_cash_requests(
    request_number, expense_id, description, expense_date,
    requested_amount, requested_by
  ) VALUES (
    request_number_value, NULL, expense_count || ' other expense(s)', CURRENT_DATE,
    total_amount, p_requested_by
  ) RETURNING id INTO new_request_id;

  INSERT INTO public.other_expense_cash_request_items(request_id, expense_id, amount)
  SELECT new_request_id, id, amount
  FROM public.expenses
  WHERE id = ANY(p_expense_ids);

  RETURN new_request_id;
END;
$$;
