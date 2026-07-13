-- Add support_links column to expenses and other_incomes tables
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS support_links TEXT[] DEFAULT '{}';
ALTER TABLE other_incomes ADD COLUMN IF NOT EXISTS support_links TEXT[] DEFAULT '{}';
