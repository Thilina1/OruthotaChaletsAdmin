-- Create blogs table
CREATE TABLE IF NOT EXISTS blogs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  preview_header TEXT NOT NULL,
  preview_description TEXT NOT NULL,
  header_1 TEXT NOT NULL,
  content_1 TEXT NOT NULL,
  content_2 TEXT,
  content_image TEXT,
  author_id UUID NOT NULL, -- Assuming linked to users table, but keeping as UUID for flexibility if user deleted
  featured BOOLEAN DEFAULT false,
  featured_position INTEGER,
  color TEXT NOT NULL CHECK (color IN ('amber', 'green', 'creme', 'blue')),
  tags TEXT[] DEFAULT '{}',
  pro_tips JSONB DEFAULT '[]'::jsonb,
  booking_button_text TEXT NOT NULL,
  booking_button_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON blogs
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON blogs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON blogs
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON blogs
    FOR DELETE USING (auth.role() = 'authenticated');
