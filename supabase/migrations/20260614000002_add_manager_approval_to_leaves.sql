-- Add pending_manager status and manager approval tracking to leave_requests
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_status_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_status_check
  CHECK (status IN ('pending_manager', 'pending', 'approved', 'rejected'));

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS manager_approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMPTZ;
