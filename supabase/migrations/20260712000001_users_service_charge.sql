-- Add service charge columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS service_charge_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_charge_rate numeric;

-- Mark all existing users as not applicable
UPDATE users SET service_charge_applicable = false, service_charge_rate = null;
