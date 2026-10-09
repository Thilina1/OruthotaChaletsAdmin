UPDATE public.customers
SET id_number = upper(regexp_replace(btrim(id_number), '\s+', '', 'g'))
WHERE id_number IS NOT NULL
  AND btrim(id_number) <> '';

UPDATE public.customers
SET id_number = NULL
WHERE id_number IS NOT NULL
  AND btrim(id_number) = '';

WITH ranked_customers AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY id_number
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS duplicate_rank
  FROM public.customers
  WHERE id_number IS NOT NULL
)
UPDATE public.customers AS customers
SET id_number = NULL,
    updated_at = now()
FROM ranked_customers
WHERE customers.id = ranked_customers.id
  AND ranked_customers.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS customers_id_number_unique_idx
  ON public.customers (id_number)
  WHERE id_number IS NOT NULL;
