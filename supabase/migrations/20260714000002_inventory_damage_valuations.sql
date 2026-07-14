-- Add valuation and action columns to inventory_transactions
-- Used by the Expired & Damaged management page

ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS unit_value       numeric(12,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_loss_value numeric(12,2)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS action_taken     text           DEFAULT NULL,  -- 'written_off' | 'returned'
  ADD COLUMN IF NOT EXISTS action_notes     text           DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS action_at        timestamptz    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS action_by        uuid           REFERENCES users(id) ON DELETE SET NULL;

-- Index for fast lookup of unprocessed damage/expired records
CREATE INDEX IF NOT EXISTS idx_inv_tx_dmg_unprocessed
  ON inventory_transactions (transaction_type, action_taken)
  WHERE transaction_type IN ('damage', 'expired');
