-- Add service_charge column to payroll_records
ALTER TABLE payroll_records
  ADD COLUMN IF NOT EXISTS service_charge numeric NOT NULL DEFAULT 0;
