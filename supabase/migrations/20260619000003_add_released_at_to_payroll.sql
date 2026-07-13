ALTER TABLE payroll_records
    ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
