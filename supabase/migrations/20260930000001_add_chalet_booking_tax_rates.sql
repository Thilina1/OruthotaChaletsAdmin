ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS vat_pct NUMERIC(5,2) NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS sscl_pct NUMERIC(5,2) NOT NULL DEFAULT 2.5;

ALTER TABLE public.chalet_bookings
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2)
    GENERATED ALWAYS AS (rate_per_night * (check_out_date - check_in_date) * vat_pct / 100) STORED,
  ADD COLUMN IF NOT EXISTS sscl_amount NUMERIC(12,2)
    GENERATED ALWAYS AS (rate_per_night * (check_out_date - check_in_date) * sscl_pct / 100) STORED,
  ADD COLUMN IF NOT EXISTS bill_grand_total NUMERIC(12,2)
    GENERATED ALWAYS AS (
      rate_per_night * (check_out_date - check_in_date) * (1 + (service_charge_pct + vat_pct + sscl_pct) / 100)
    ) STORED;
