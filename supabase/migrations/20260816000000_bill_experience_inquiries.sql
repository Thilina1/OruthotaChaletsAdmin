-- Link inquiries to existing customer records when staff select one.
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS customer_id UUID
    REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contact_messages_customer_id_idx
  ON public.contact_messages (customer_id);

-- Link an experience inquiry to its durable bill/income record.
ALTER TABLE public.service_incomes
  ADD COLUMN IF NOT EXISTS experience_inquiry_id UUID
    REFERENCES public.contact_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pricing_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;

-- PostgreSQL permits multiple NULL values, while ensuring one bill record per
-- actual experience inquiry.
CREATE UNIQUE INDEX IF NOT EXISTS service_incomes_experience_inquiry_unique
  ON public.service_incomes (experience_inquiry_id);

CREATE INDEX IF NOT EXISTS service_incomes_experience_payment_status_idx
  ON public.service_incomes (payment_status)
  WHERE service_type = 'Experience';

-- Keep the typed columns synchronized while older application deployments
-- continue writing metadata into line_items.
CREATE OR REPLACE FUNCTION public.sync_experience_income_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.service_type = 'Experience'
     AND jsonb_typeof(NEW.line_items) = 'array'
     AND jsonb_array_length(NEW.line_items) > 0
     AND NEW.line_items->0 ? 'experience_inquiry_id' THEN
    NEW.experience_inquiry_id := NULLIF(NEW.line_items->0->>'experience_inquiry_id', '')::uuid;
    NEW.pricing_breakdown := COALESCE(NEW.line_items->0->'pricing_breakdown', '{}'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_experience_income_metadata_trigger ON public.service_incomes;
CREATE TRIGGER sync_experience_income_metadata_trigger
BEFORE INSERT OR UPDATE OF service_type, line_items
ON public.service_incomes
FOR EACH ROW
EXECUTE FUNCTION public.sync_experience_income_metadata();

-- Backfill records created by the backward-compatible application version,
-- which stores this metadata on the first JSON line item.
UPDATE public.service_incomes
SET
  experience_inquiry_id = NULLIF(line_items->0->>'experience_inquiry_id', '')::uuid,
  pricing_breakdown = COALESCE(line_items->0->'pricing_breakdown', '{}'::jsonb)
WHERE service_type = 'Experience'
  AND jsonb_typeof(line_items) = 'array'
  AND jsonb_array_length(line_items) > 0
  AND line_items->0 ? 'experience_inquiry_id'
  AND experience_inquiry_id IS NULL;

COMMENT ON COLUMN public.service_incomes.experience_inquiry_id IS
  'Experience inquiry that generated this guest charge.';
COMMENT ON COLUMN public.service_incomes.pricing_breakdown IS
  'Per-person price, headcount, tax, service charge, other charges, and total snapshot.';

-- Immutable snapshots ensure past bills retain every item after live records
-- move from outstanding to paid/closed states.
CREATE TABLE IF NOT EXISTS public.guest_bill_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  total NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guest_bill_history_customer_paid_idx
  ON public.guest_bill_history (customer_id, paid_at DESC);

ALTER TABLE public.guest_bill_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read guest bill history" ON public.guest_bill_history;
CREATE POLICY "Authenticated users can read guest bill history"
  ON public.guest_bill_history FOR SELECT TO authenticated USING (true);
