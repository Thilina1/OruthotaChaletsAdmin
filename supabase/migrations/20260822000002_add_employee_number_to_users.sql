-- Assign every system user a unique employee number usable for login.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employee_number TEXT;

-- Preserve existing users by assigning deterministic numbers from 0001 upward.
WITH numbered_users AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id)::INTEGER AS employee_number
  FROM public.users
  WHERE employee_number IS NULL
)
UPDATE public.users AS users
SET employee_number = LPAD(numbered_users.employee_number::TEXT, 4, '0')
FROM numbered_users
WHERE users.id = numbered_users.id;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_employee_number_valid;

ALTER TABLE public.users
  ADD CONSTRAINT users_employee_number_valid
  CHECK (
    employee_number ~ '^[0-9]{4,5}$'
    AND employee_number::INTEGER BETWEEN 1 AND 50000
  );

CREATE UNIQUE INDEX IF NOT EXISTS users_employee_number_unique
  ON public.users (employee_number);

CREATE SEQUENCE IF NOT EXISTS public.employee_number_sequence;

-- Continue after the largest number assigned during the backfill. Sequence access
-- is atomic, so concurrent employee creation cannot receive duplicate numbers.
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

ALTER TABLE public.users
  ALTER COLUMN employee_number SET NOT NULL;

COMMENT ON COLUMN public.users.employee_number IS
  'System-generated unique employee login number from 0001 through 50000.';
