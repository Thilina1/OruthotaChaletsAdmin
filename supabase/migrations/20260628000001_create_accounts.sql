-- Financial accounts (bank, cash, savings, etc.)
CREATE TABLE IF NOT EXISTS accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'bank' CHECK (type IN ('bank', 'cash', 'savings', 'credit_card', 'other')),
  account_number  TEXT,
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);

-- Transactions against those accounts
CREATE TABLE IF NOT EXISTS account_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  reference   TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  balance_after NUMERIC(15,2),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_account_transactions" ON account_transactions FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_account_transactions_account_id ON account_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_date ON account_transactions(date);
