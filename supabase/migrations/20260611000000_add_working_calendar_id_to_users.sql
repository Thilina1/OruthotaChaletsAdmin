ALTER TABLE users
  ADD COLUMN IF NOT EXISTS working_calendar_id UUID REFERENCES working_calendars(id) ON DELETE SET NULL;
