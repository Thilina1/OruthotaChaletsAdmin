-- Migration for Buffet Table Bookings
CREATE TABLE IF NOT EXISTS table_bookings (
  id         UUID                     DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT                     NOT NULL,
  email      TEXT                     NOT NULL,
  phone      TEXT,
  date       DATE                     NOT NULL,
  meal_type  TEXT                     NOT NULL,
  guests     INTEGER                  NOT NULL DEFAULT 2,
  comments   TEXT,
  status     TEXT                     DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE table_bookings ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to insert a booking (public-facing form)
CREATE POLICY "Anyone can book a buffet" ON table_bookings
  FOR INSERT WITH CHECK (true);

-- Policy to allow authenticated users (admin dashboard) to view bookings
CREATE POLICY "Authenticated users can view bookings" ON table_bookings
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy to allow authenticated users to update bookings (status etc)
CREATE POLICY "Authenticated users can update bookings" ON table_bookings
  FOR UPDATE USING (auth.role() = 'authenticated');
