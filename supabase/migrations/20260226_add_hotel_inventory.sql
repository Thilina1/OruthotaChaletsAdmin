-- Hotel Inventory Schema SQL

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS public.inventory_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Insert default departments based on the document
INSERT INTO public.inventory_departments (name, description)
VALUES 
  ('Kitchen', 'මුළුතැන්ගෙය'),
  ('Housekeeping', 'කාමර නඩත්තුව'),
  ('Restaurant', 'ආපනශාලාව'),
  ('Maintenance', 'නඩත්තු අංශය'),
  ('Front Office', 'කාර්යාලය'),
  ('Garden', 'උද්‍යාන අංශය')
ON CONFLICT (name) DO NOTHING;


-- 2. Inventory Items Table
CREATE TABLE IF NOT EXISTS public.hotel_inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text CHECK (category IN (
    'Food & Beverage',
    'Cleaning Materials & Chemicals',
    'Guest Amenities',
    'Linen & Fabrics',
    'Maintenance & Hardware',
    'Garden Supplies',
    'Stationery & Packaging',
    'Crockery, Cutlery & Glassware',
    'Kitchen Utensils',
    'Staff Uniforms',
    'Fuel & Gas',
    'First Aid & Safety'
  )),
  department_id uuid REFERENCES public.inventory_departments(id),
  unit text CHECK (unit IN ('kg', 'packets', 'L', 'bottles', 'Nos', 'rolls', 'tins', 'reams', 'cylinders', 'cards')),
  buying_price numeric(10, 2) DEFAULT 0,
  
  -- Stock Management
  current_stock numeric(10, 2) DEFAULT 0,
  safety_stock numeric(10, 2) DEFAULT 0, -- Minimum level
  reorder_level numeric(10, 2) DEFAULT 0, -- ROL
  maximum_level numeric(10, 2) DEFAULT 0,
  
  status text CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


-- 3. Inventory Transactions Table
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.hotel_inventory_items(id) ON DELETE CASCADE,
  transaction_type text CHECK (transaction_type IN ('receive', 'issue', 'damage', 'audit_adjustment', 'initial_stock')),
  quantity numeric(10, 2) NOT NULL,
  previous_stock numeric(10, 2),
  new_stock numeric(10, 2),
  reference_department uuid REFERENCES public.inventory_departments(id), -- For issues
  reason text, -- For damages: Expired, Broken, Rotten
  remarks text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Trigger to update updated_at on hotel_inventory_items
CREATE OR REPLACE FUNCTION update_hotel_inventory_items_modtime()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_hotel_inventory_items_modtime ON public.hotel_inventory_items;
CREATE TRIGGER update_hotel_inventory_items_modtime
    BEFORE UPDATE ON public.hotel_inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_hotel_inventory_items_modtime();
