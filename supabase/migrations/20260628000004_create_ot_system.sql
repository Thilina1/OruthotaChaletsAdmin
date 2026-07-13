-- OT Settings (single-row config)
CREATE TABLE IF NOT EXISTS ot_settings (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_method      TEXT NOT NULL DEFAULT 'multiplier' CHECK (calculation_method IN ('multiplier', 'flat_rate')),
    ot_multiplier           NUMERIC(5,2) NOT NULL DEFAULT 1.5,   -- e.g. 1.5 = time-and-a-half
    flat_rate_per_hour      NUMERIC(10,2) NOT NULL DEFAULT 0,    -- used only when method = flat_rate
    standard_hours_per_day  NUMERIC(4,1) NOT NULL DEFAULT 8.0,
    requires_manager_approval BOOLEAN NOT NULL DEFAULT true,
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON ot_settings USING (true) WITH CHECK (true);

-- Seed one default row
INSERT INTO ot_settings (calculation_method, ot_multiplier, flat_rate_per_hour, standard_hours_per_day, requires_manager_approval)
VALUES ('multiplier', 1.5, 0, 8.0, true)
ON CONFLICT DO NOTHING;

-- OT Requests (per employee per day)
CREATE TABLE IF NOT EXISTS ot_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date                DATE NOT NULL,
    ot_hours            NUMERIC(4,1) NOT NULL CHECK (ot_hours > 0),
    reason              TEXT,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by         UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    payroll_month       TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ot_requests_user_date_key UNIQUE (user_id, date)
);
ALTER TABLE ot_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON ot_requests USING (true) WITH CHECK (true);

-- Add OT columns to payroll_records
ALTER TABLE payroll_records
    ADD COLUMN IF NOT EXISTS ot_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ot_pay   NUMERIC(15,2) NOT NULL DEFAULT 0;
