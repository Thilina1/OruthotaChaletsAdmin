-- Live USD to LKR rate. A daily job fetches the market rate, applies a margin
-- and (in Auto mode) writes it to chalet_rates.usd_to_lkr_rate, which every
-- price and booking already reads. Bookings lock the rate when they are made.

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date DATE NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  quote_currency TEXT NOT NULL DEFAULT 'LKR',
  market_rate NUMERIC(14,4),
  margin_percent NUMERIC(6,2) NOT NULL DEFAULT 0,
  applied_rate NUMERIC(14,4) NOT NULL CHECK (applied_rate > 0),
  source TEXT NOT NULL,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exchange_rates_date_idx
  ON public.exchange_rates(rate_date DESC, created_at DESC);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_exchange_rates" ON public.exchange_rates;
CREATE POLICY "allow_all_exchange_rates"
  ON public.exchange_rates FOR ALL USING (true) WITH CHECK (true);

-- Starts in Manual mode so nothing changes until Auto is switched on.
INSERT INTO public.app_settings(key, value)
VALUES ('fx_settings', '{"mode": "manual", "margin_percent": 2}'::jsonb)
ON CONFLICT (key) DO NOTHING;
