-- Petty Cash Settings (single configurable row)
CREATE TABLE IF NOT EXISTS petty_cash_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_total_limit numeric NOT NULL DEFAULT 200000,
  small_request_threshold numeric NOT NULL DEFAULT 50000,
  small_pool_limit numeric NOT NULL DEFAULT 50000,
  large_pool_limit numeric NOT NULL DEFAULT 150000,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id)
);

INSERT INTO petty_cash_settings (daily_total_limit, small_request_threshold, small_pool_limit, large_pool_limit)
SELECT 200000, 50000, 50000, 150000
WHERE NOT EXISTS (SELECT 1 FROM petty_cash_settings);

ALTER TABLE petty_cash_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "petty_cash_settings_all" ON petty_cash_settings;
CREATE POLICY "petty_cash_settings_all" ON petty_cash_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Petty Cash Requests
CREATE TABLE IF NOT EXISTS petty_cash_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES users(id),
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  -- Status flow:
  --   pending_manager -> pending_accounts -> approved -> issued -> settled
  --   Any stage can go to rejected
  status text NOT NULL DEFAULT 'pending_manager'
    CHECK (status IN ('pending_manager','pending_accounts','approved','issued','settled','rejected')),

  -- Manager approval step
  manager_id uuid REFERENCES users(id),
  manager_status text CHECK (manager_status IN ('pending','approved','rejected')),
  manager_remarks text,
  manager_actioned_at timestamptz,

  -- Accounts approval step
  account_status text CHECK (account_status IN ('pending','approved','rejected')),
  account_remarks text,
  account_actioned_at timestamptz,
  account_actioned_by uuid REFERENCES users(id),

  -- Issuance
  issued_at timestamptz,
  issued_by uuid REFERENCES users(id),

  -- Settlement (employee submits supporting document)
  document_url text,
  settlement_notes text,
  settled_at timestamptz,

  request_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE petty_cash_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "petty_cash_requests_all" ON petty_cash_requests;
CREATE POLICY "petty_cash_requests_all" ON petty_cash_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
