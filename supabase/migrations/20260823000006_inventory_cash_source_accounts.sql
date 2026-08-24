CREATE TABLE IF NOT EXISTS public.inventory_cash_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.inventory_cash_requests(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('initial', 'additional')),
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  issued_by UUID NOT NULL REFERENCES public.users(id),
  account_transaction_id UUID REFERENCES public.account_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(request_id, issue_type)
);

ALTER TABLE public.inventory_cash_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_inventory_cash_issues"
  ON public.inventory_cash_issues FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS inventory_cash_issues_request_idx ON public.inventory_cash_issues(request_id);

CREATE OR REPLACE FUNCTION public.issue_inventory_cash(
  p_request_id UUID,
  p_account_id UUID,
  p_amount NUMERIC,
  p_issued_by UUID,
  p_is_additional BOOLEAN DEFAULT false
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cash_request public.inventory_cash_requests%ROWTYPE;
  account_record public.accounts%ROWTYPE;
  approved_limit NUMERIC(15,2);
  new_balance NUMERIC(15,2);
  transaction_id UUID;
  issue_kind TEXT;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Issue amount must be greater than zero'; END IF;

  SELECT * INTO cash_request FROM public.inventory_cash_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inventory cash request not found'; END IF;

  IF p_is_additional THEN
    IF cash_request.additional_status <> 'APPROVED' THEN RAISE EXCEPTION 'Additional request is not approved'; END IF;
    approved_limit := cash_request.additional_approved_amount;
    issue_kind := 'additional';
  ELSE
    IF cash_request.status <> 'APPROVED' THEN RAISE EXCEPTION 'Cash request is not approved'; END IF;
    approved_limit := cash_request.approved_amount;
    issue_kind := 'initial';
  END IF;

  IF p_amount > COALESCE(approved_limit, 0) THEN RAISE EXCEPTION 'Issue amount exceeds the approved amount'; END IF;

  SELECT * INTO account_record FROM public.accounts WHERE id = p_account_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active source account not found'; END IF;
  IF account_record.current_balance < p_amount THEN RAISE EXCEPTION 'Insufficient source account balance'; END IF;

  new_balance := account_record.current_balance - p_amount;
  INSERT INTO public.account_transactions(account_id, type, amount, description, reference, date, balance_after)
  VALUES (
    p_account_id, 'debit', p_amount,
    CASE WHEN p_is_additional THEN 'Additional inventory cash - ' ELSE 'Inventory cash - ' END || cash_request.purpose,
    cash_request.request_number, CURRENT_DATE, new_balance
  ) RETURNING id INTO transaction_id;

  UPDATE public.accounts SET current_balance = new_balance, updated_at = NOW() WHERE id = p_account_id;
  INSERT INTO public.inventory_cash_issues(request_id, issue_type, account_id, amount, issued_by, account_transaction_id)
  VALUES (p_request_id, issue_kind, p_account_id, p_amount, p_issued_by, transaction_id);

  IF p_is_additional THEN
    UPDATE public.inventory_cash_requests SET
      additional_issued_amount = p_amount,
      additional_status = 'ISSUED',
      updated_at = NOW()
    WHERE id = p_request_id;
  ELSE
    UPDATE public.inventory_cash_requests SET
      status = 'ISSUED',
      issued_amount = p_amount,
      issued_by = p_issued_by,
      issued_at = NOW(),
      updated_at = NOW()
    WHERE id = p_request_id;
  END IF;
END;
$$;
