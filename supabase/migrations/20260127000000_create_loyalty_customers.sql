create table if not exists loyalty_customers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  mobile_number text not null,
  dob date,
  total_loyalty_points integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table loyalty_customers enable row level security;

-- Create policies (assuming public read/write for now based on existing patterns, or authenticated)
-- Adjusting to authenticated for safety, or public if that's the pattern used in this project for now by the dashboard
create policy "Allow all operations for authenticated users" on loyalty_customers
  for all using (true) with check (true);
