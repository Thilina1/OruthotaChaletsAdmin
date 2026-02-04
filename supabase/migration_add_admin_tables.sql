-- 1. Create USERS table (missing in current schema)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE NOT NULL,
  role text CHECK (role IN ('admin', 'waiter', 'kitchen', 'payment')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Update ROOMS table to match application needs
-- Existing: id, title, description, roomCount, view, pricePerNight, imageUrl, created_at
-- Needed: room_number, type, status
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS room_number text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('available', 'occupied', 'maintenance')) DEFAULT 'available';

-- 3. Create TABLES for Menu/Orders (Restaurant side)
CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10, 2),
  buying_price numeric(10, 2),
  category text,
  availability boolean DEFAULT true,
  stock_type text,
  stock integer,
  unit text,
  sell_type text,
  variety_of_dishes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number integer UNIQUE,
  status text CHECK (status IN ('available', 'occupied', 'reserved')) DEFAULT 'available',
  capacity integer,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES public.restaurant_tables(id),
  table_number integer,
  status text CHECK (status IN ('open', 'billed', 'closed')) DEFAULT 'open',
  total_price numeric(10, 2) DEFAULT 0,
  waiter_id uuid REFERENCES public.users(id),
  waiter_name text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id),
  name text,
  price numeric(10, 2),
  quantity integer DEFAULT 1,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);
