-- Add named allowances breakdown column to salary_details
-- fixed_allowances keeps the total for backward compatibility; allowances_json stores the itemised list
ALTER TABLE salary_details ADD COLUMN IF NOT EXISTS allowances_json JSONB DEFAULT '[]'::jsonb;
