-- Running invoice numbers for service income records: EXP-000001, ... for
-- experiences and INV-000001, ... for every other service (laundry,
-- transport, spa/pool, Front Desk charges and discounts). Assigned by the
-- database on insert so two staff saving at once never get the same number.
CREATE SEQUENCE IF NOT EXISTS public.service_invoice_exp_seq;
CREATE SEQUENCE IF NOT EXISTS public.service_invoice_inv_seq;

ALTER TABLE public.service_incomes
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS service_incomes_invoice_number_key
  ON public.service_incomes (invoice_number);

CREATE OR REPLACE FUNCTION public.assign_service_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    IF NEW.service_type = 'Experience' THEN
      NEW.invoice_number := 'EXP-' || lpad(nextval('public.service_invoice_exp_seq')::text, 6, '0');
    ELSE
      NEW.invoice_number := 'INV-' || lpad(nextval('public.service_invoice_inv_seq')::text, 6, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_service_invoice_number_trigger ON public.service_incomes;
CREATE TRIGGER assign_service_invoice_number_trigger
BEFORE INSERT ON public.service_incomes
FOR EACH ROW
EXECUTE FUNCTION public.assign_service_invoice_number();

-- Number existing records in the order they were created, after any number
-- already used (so the migration can be re-run safely), then move each
-- sequence past the highest number.
WITH used AS (
  SELECT
    COALESCE(MAX(substring(invoice_number FROM 5)::bigint) FILTER (WHERE invoice_number LIKE 'EXP-%'), 0) AS exp_max,
    COALESCE(MAX(substring(invoice_number FROM 5)::bigint) FILTER (WHERE invoice_number LIKE 'INV-%'), 0) AS inv_max
  FROM public.service_incomes
  WHERE invoice_number ~ '^(EXP|INV)-[0-9]+$'
),
ordered AS (
  SELECT
    id,
    service_type = 'Experience' AS is_experience,
    row_number() OVER (PARTITION BY service_type = 'Experience' ORDER BY created_at NULLS FIRST, id) AS rn
  FROM public.service_incomes
  WHERE invoice_number IS NULL
)
UPDATE public.service_incomes AS s
SET invoice_number = CASE
  WHEN ordered.is_experience THEN 'EXP-' || lpad((used.exp_max + ordered.rn)::text, 6, '0')
  ELSE 'INV-' || lpad((used.inv_max + ordered.rn)::text, 6, '0')
END
FROM ordered, used
WHERE s.id = ordered.id;

SELECT setval('public.service_invoice_exp_seq', GREATEST(1, COALESCE((SELECT MAX(substring(invoice_number FROM 5)::bigint) FROM public.service_incomes WHERE invoice_number ~ '^EXP-[0-9]+$'), 0)),
  EXISTS (SELECT 1 FROM public.service_incomes WHERE invoice_number ~ '^EXP-[0-9]+$'));
SELECT setval('public.service_invoice_inv_seq', GREATEST(1, COALESCE((SELECT MAX(substring(invoice_number FROM 5)::bigint) FROM public.service_incomes WHERE invoice_number ~ '^INV-[0-9]+$'), 0)),
  EXISTS (SELECT 1 FROM public.service_incomes WHERE invoice_number ~ '^INV-[0-9]+$'));

COMMENT ON COLUMN public.service_incomes.invoice_number IS
  'Running invoice number: EXP-###### for experiences, INV-###### for other services.';
