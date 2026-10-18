-- Adult and child rates on each chalet rate (room type x package), per guest
-- per night:
--   price per room per night = room rate (after its discount)
--                            + adult rate x adults + child rate x children
-- LKR for Sri Lankan guests, USD for non Sri Lankan guests. They start at 0,
-- so existing prices do not change until they are set on the Rates page.
ALTER TABLE public.chalet_rates
  ADD COLUMN IF NOT EXISTS adult_rate NUMERIC NOT NULL DEFAULT 0 CHECK (adult_rate >= 0),
  ADD COLUMN IF NOT EXISTS child_rate NUMERIC NOT NULL DEFAULT 0 CHECK (child_rate >= 0),
  ADD COLUMN IF NOT EXISTS usd_adult_rate NUMERIC NOT NULL DEFAULT 0 CHECK (usd_adult_rate >= 0),
  ADD COLUMN IF NOT EXISTS usd_child_rate NUMERIC NOT NULL DEFAULT 0 CHECK (usd_child_rate >= 0);
