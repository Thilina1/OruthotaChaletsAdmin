-- Casual / daily workers (not system users, no login)
CREATE TABLE IF NOT EXISTS casual_workers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  phone      TEXT,
  nic        TEXT,
  department TEXT,
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  is_active  BOOLEAN DEFAULT true,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One record per worker per day: attendance + payment in one row
CREATE TABLE IF NOT EXISTS daily_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id   UUID NOT NULL REFERENCES casual_workers(id) ON DELETE CASCADE,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_rate  NUMERIC NOT NULL DEFAULT 0,   -- snapshot of rate on that day
  day_type    TEXT NOT NULL DEFAULT 'full'
              CHECK (day_type IN ('full', 'half', 'absent')),
  amount      NUMERIC NOT NULL DEFAULT 0,   -- daily_rate or daily_rate/2 or 0
  is_paid     BOOLEAN DEFAULT false,
  paid_at     TIMESTAMPTZ,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, date)
);

-- Open RLS (app uses custom auth)
ALTER TABLE casual_workers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_payments  ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_casual_workers" ON casual_workers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_daily_payments" ON daily_payments  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_daily_payments_date      ON daily_payments(date);
CREATE INDEX IF NOT EXISTS idx_daily_payments_worker_id ON daily_payments(worker_id);
