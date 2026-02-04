-- Create salary_details table
CREATE TABLE IF NOT EXISTS salary_details (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  basic_salary NUMERIC NOT NULL DEFAULT 0,
  fixed_allowances NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create payroll_records table
CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- Format: 'YYYY-MM'
  basic_salary NUMERIC NOT NULL DEFAULT 0,
  allowances NUMERIC NOT NULL DEFAULT 0,
  gross_salary NUMERIC NOT NULL DEFAULT 0,
  epf_employee_8 NUMERIC NOT NULL DEFAULT 0,
  epf_employer_12 NUMERIC NOT NULL DEFAULT 0,
  etf_employer_3 NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  net_salary NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE salary_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- Policies for salary_details
-- Admins can view/edit all. Users can view their own.
CREATE POLICY "Admins can manage all salary details" ON salary_details
  FOR ALL USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Users can view own salary details" ON salary_details
  FOR SELECT USING (auth.uid() = user_id);

-- Policies for payroll_records
-- Admins can manage all. Users can view their own.
CREATE POLICY "Admins can manage all payroll records" ON payroll_records
  FOR ALL USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Users can view own payroll records" ON payroll_records
  FOR SELECT USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_salary_details_user_id ON salary_details(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_user_id ON payroll_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_month ON payroll_records(month);
