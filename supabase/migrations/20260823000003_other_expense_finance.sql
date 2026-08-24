CREATE TABLE IF NOT EXISTS public.other_expense_cash_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  expense_id UUID NOT NULL UNIQUE REFERENCES public.expenses(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  expense_date DATE NOT NULL,
  requested_amount NUMERIC(15,2) NOT NULL CHECK (requested_amount > 0),
  issued_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (issued_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_issued', 'issued', 'cancelled')),
  requested_by UUID NOT NULL REFERENCES public.users(id),
  last_issued_by UUID REFERENCES public.users(id),
  last_issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.other_expense_cash_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.other_expense_cash_requests(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  issued_by UUID NOT NULL REFERENCES public.users(id),
  account_transaction_id UUID REFERENCES public.account_transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.other_expense_cash_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.other_expense_cash_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_other_expense_cash_requests" ON public.other_expense_cash_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_other_expense_cash_issues" ON public.other_expense_cash_issues FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS other_expense_cash_requests_date_idx ON public.other_expense_cash_requests(expense_date);
CREATE INDEX IF NOT EXISTS other_expense_cash_requests_status_idx ON public.other_expense_cash_requests(status);
CREATE INDEX IF NOT EXISTS other_expense_cash_issues_request_idx ON public.other_expense_cash_issues(request_id);

CREATE OR REPLACE FUNCTION public.issue_other_expense_cash(
  p_request_id UUID,
  p_account_id UUID,
  p_amount NUMERIC,
  p_issued_by UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cash_request public.other_expense_cash_requests%ROWTYPE;
  account_record public.accounts%ROWTYPE;
  new_balance NUMERIC(15,2);
  transaction_id UUID;
  new_issued NUMERIC(15,2);
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Issue amount must be greater than zero'; END IF;

  SELECT * INTO cash_request FROM public.other_expense_cash_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Expense cash request not found'; END IF;
  IF cash_request.status IN ('issued', 'cancelled') THEN RAISE EXCEPTION 'Expense cash request cannot be issued'; END IF;
  IF cash_request.issued_amount + p_amount > cash_request.requested_amount THEN RAISE EXCEPTION 'Issue amount exceeds the amount still required'; END IF;

  SELECT * INTO account_record FROM public.accounts WHERE id = p_account_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active account not found'; END IF;
  IF account_record.current_balance < p_amount THEN RAISE EXCEPTION 'Insufficient account balance'; END IF;

  new_balance := account_record.current_balance - p_amount;
  new_issued := cash_request.issued_amount + p_amount;

  INSERT INTO public.account_transactions(account_id, type, amount, description, reference, date, balance_after)
  VALUES (p_account_id, 'debit', p_amount, 'Other expense - ' || cash_request.description, cash_request.request_number, CURRENT_DATE, new_balance)
  RETURNING id INTO transaction_id;

  UPDATE public.accounts SET current_balance = new_balance, updated_at = NOW() WHERE id = p_account_id;
  INSERT INTO public.other_expense_cash_issues(request_id, account_id, amount, issued_by, account_transaction_id)
  VALUES (p_request_id, p_account_id, p_amount, p_issued_by, transaction_id);
  UPDATE public.other_expense_cash_requests SET
    issued_amount = new_issued,
    status = CASE WHEN new_issued >= requested_amount THEN 'issued' ELSE 'partially_issued' END,
    last_issued_by = p_issued_by,
    last_issued_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;
END;
$$;
