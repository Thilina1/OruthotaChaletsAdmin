-- Give casual workers their own immutable T-prefixed employee numbers and an
-- optional link to a system user account. They remain outside salary_details.
ALTER TABLE public.casual_workers
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS employee_number TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS system_access BOOLEAN NOT NULL DEFAULT false;

CREATE SEQUENCE IF NOT EXISTS public.casual_worker_number_sequence;

CREATE OR REPLACE FUNCTION public.generate_casual_worker_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'T' || LPAD(nextval('public.casual_worker_number_sequence')::TEXT, 4, '0');
END;
$$;

ALTER TABLE public.casual_workers
  ALTER COLUMN employee_number SET DEFAULT public.generate_casual_worker_number();

UPDATE public.casual_workers
SET employee_number = public.generate_casual_worker_number()
WHERE employee_number IS NULL;

ALTER TABLE public.casual_workers
  ALTER COLUMN employee_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS casual_workers_employee_number_unique
  ON public.casual_workers (employee_number);

CREATE UNIQUE INDEX IF NOT EXISTS casual_workers_user_id_unique
  ON public.casual_workers (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_employee_number_valid;
ALTER TABLE public.users ADD CONSTRAINT users_employee_number_valid CHECK (
  CASE
    WHEN employee_number ~ '^[0-9]{4,5}$' THEN employee_number::INTEGER BETWEEN 1 AND 50000
    ELSE employee_number ~ '^T[0-9]{4,}$'
  END
);

CREATE OR REPLACE FUNCTION public.prevent_casual_worker_number_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employee_number IS DISTINCT FROM OLD.employee_number THEN
    RAISE EXCEPTION 'Temporary employee number cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS casual_workers_prevent_number_change ON public.casual_workers;
CREATE TRIGGER casual_workers_prevent_number_change
  BEFORE UPDATE OF employee_number ON public.casual_workers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_casual_worker_number_change();

COMMENT ON COLUMN public.casual_workers.employee_number IS
  'Immutable temporary employee/login number beginning at T0001.';
