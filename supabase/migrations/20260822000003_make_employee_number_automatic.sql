-- Make employee numbers automatic for databases where the preceding migration
-- may already have been applied.
CREATE SEQUENCE IF NOT EXISTS public.employee_number_sequence;

SELECT setval(
  'public.employee_number_sequence',
  COALESCE((SELECT MAX(employee_number::INTEGER) FROM public.users), 0) + 1,
  false
);

CREATE OR REPLACE FUNCTION public.generate_employee_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  next_number INTEGER;
BEGIN
  next_number := nextval('public.employee_number_sequence');

  IF next_number > 50000 THEN
    RAISE EXCEPTION 'Employee number limit of 50000 has been reached';
  END IF;

  RETURN LPAD(next_number::TEXT, 4, '0');
END;
$$;

ALTER TABLE public.users
  ALTER COLUMN employee_number SET DEFAULT public.generate_employee_number();

CREATE OR REPLACE FUNCTION public.prevent_employee_number_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.employee_number IS DISTINCT FROM OLD.employee_number THEN
    RAISE EXCEPTION 'Employee number cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_prevent_employee_number_change ON public.users;
CREATE TRIGGER users_prevent_employee_number_change
  BEFORE UPDATE OF employee_number ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_employee_number_change();

COMMENT ON COLUMN public.users.employee_number IS
  'System-generated immutable unique employee login number from 0001 through 50000.';
