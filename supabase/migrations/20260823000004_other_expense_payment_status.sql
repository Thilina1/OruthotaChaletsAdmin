ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS expenses_is_paid_idx ON public.expenses(is_paid);
