CREATE TABLE IF NOT EXISTS job_titles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL,
  title      TEXT NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department, title)
);

ALTER TABLE job_titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_job_titles" ON job_titles FOR ALL USING (true) WITH CHECK (true);

-- Seed from the previously hardcoded staff-hierarchy
INSERT INTO job_titles (department, title, sort_order) VALUES
  ('Administration', 'admin',            0),
  ('Administration', 'Managing Director',1),
  ('Administration', 'General Manager',  2),
  ('Office',         'Accountant',       0),
  ('Office',         'Social Media Marketer', 1),
  ('Front Office',   'Receptionist',     0),
  ('Front Office',   'Trainee Receptionist', 1),
  ('Kitchen',        'Head Chef',        0),
  ('Kitchen',        'Chef',             1),
  ('Kitchen',        'Cook',             2),
  ('Kitchen',        'Trainee Cook',     3),
  ('Restaurant',     'Restaurant Supervisor', 0),
  ('Restaurant',     'Steward',          1),
  ('Restaurant',     'Trainee Steward',  2),
  ('Housekeeping',   'Housekeeping supervisor', 0),
  ('Housekeeping',   'Housekeeper',      1),
  ('Housekeeping',   'Trainee Housekeeper', 2),
  ('Housekeeping',   'Laundry Operator', 3),
  ('Garden',         'Gardener',         0),
  ('Garden',         'Pool boy / Lifeguard', 1),
  ('Maintenance',    'Maintenance technician', 0),
  ('Stores',         'Store keeper',     0)
ON CONFLICT (department, title) DO NOTHING;
