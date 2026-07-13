-- Add manager_approved as an intermediate status
ALTER TABLE ot_requests DROP CONSTRAINT IF EXISTS ot_requests_status_check;
ALTER TABLE ot_requests ADD CONSTRAINT ot_requests_status_check
    CHECK (status IN ('pending', 'manager_approved', 'approved', 'rejected'));

-- Global default max OT hours per month (0 = no limit)
ALTER TABLE ot_settings
    ADD COLUMN IF NOT EXISTS max_ot_hours_per_month NUMERIC(5,1) NOT NULL DEFAULT 0;

-- Per-user OT hour limits (overrides global default)
CREATE TABLE IF NOT EXISTS ot_user_limits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_ot_hours_per_month NUMERIC(5,1) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);
ALTER TABLE ot_user_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON ot_user_limits USING (true) WITH CHECK (true);
