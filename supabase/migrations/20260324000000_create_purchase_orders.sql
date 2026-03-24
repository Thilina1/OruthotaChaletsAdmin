-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
  supplier_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES hotel_inventory_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'units',
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC,
  total_price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users (auth handled at app level via JWT)
DROP POLICY IF EXISTS "Allow all for purchase_orders" ON purchase_orders;
CREATE POLICY "Allow all for purchase_orders" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for purchase_order_items" ON purchase_order_items;
CREATE POLICY "Allow all for purchase_order_items" ON purchase_order_items FOR ALL USING (true) WITH CHECK (true);
