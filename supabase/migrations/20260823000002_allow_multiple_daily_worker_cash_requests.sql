-- Daily wage funding may be requested in multiple installments for one work
-- date. The UI calculates the still-required amount from all prior requests.
DROP INDEX IF EXISTS public.daily_worker_cash_requests_work_date_unique;

CREATE INDEX IF NOT EXISTS daily_worker_cash_requests_work_date_idx
  ON public.daily_worker_cash_requests (work_date);
