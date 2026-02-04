-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('admin', 'waiter', 'kitchen', 'payment')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ROOMS TABLE
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  room_number TEXT,
  type TEXT,
  price_per_night NUMERIC(10, 2),
  room_count INTEGER DEFAULT 1,
  view TEXT,
  status TEXT CHECK (status IN ('available', 'occupied', 'maintenance')) DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- BOOKINGS / RESERVATIONS TABLE
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_name TEXT NOT NULL,
  room_id UUID REFERENCES rooms(id),
  room_title TEXT,
  check_in_date DATE,
  check_out_date DATE,
  total_cost NUMERIC(10, 2),
  status TEXT CHECK (status IN ('confirmed', 'checked-in', 'checked-out', 'cancelled')) DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2),
  buying_price NUMERIC(10, 2),
  category TEXT,
  availability BOOLEAN DEFAULT true,
  stock_type TEXT,
  stock INTEGER,
  unit TEXT,
  sell_type TEXT,
  variety_of_dishes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLES (Restaurant Tables)
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number INTEGER UNIQUE,
  status TEXT CHECK (status IN ('available', 'occupied', 'reserved')) DEFAULT 'available',
  capacity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID REFERENCES restaurant_tables(id),
  table_number INTEGER,
  status TEXT CHECK (status IN ('open', 'billed', 'closed')) DEFAULT 'open',
  total_price NUMERIC(10, 2) DEFAULT 0,
  waiter_id UUID REFERENCES users(id),
  waiter_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ORDER ITEMS TABLE
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  name TEXT,
  price NUMERIC(10, 2),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
