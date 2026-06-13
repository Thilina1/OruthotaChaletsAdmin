-- Add unique constraint to payroll_records to prevent duplicate entries for the same month and user
-- This also enables the use of UPSERT in the API
ALTER TABLE payroll_records ADD CONSTRAINT unique_user_month_payroll UNIQUE (user_id, month);
