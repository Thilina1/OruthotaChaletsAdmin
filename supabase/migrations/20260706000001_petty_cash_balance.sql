-- Add balance tracking columns to petty_cash_requests
ALTER TABLE petty_cash_requests
  ADD COLUMN IF NOT EXISTS amount_spent numeric,
  ADD COLUMN IF NOT EXISTS balance_status text
    CHECK (balance_status IN ('return_pending', 'returned', 'additional_pending', 'additional_issued')),
  ADD COLUMN IF NOT EXISTS balance_amount numeric,   -- actual amount returned or additionally issued (may differ from calculated balance)
  ADD COLUMN IF NOT EXISTS balance_actioned_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_actioned_by uuid REFERENCES users(id);

-- balance_expected = amount - amount_spent
--   positive → employee must return the difference
--   negative → company must issue additional to employee
-- balance_amount = what was actually returned / issued (recorded by accounts at action time)
