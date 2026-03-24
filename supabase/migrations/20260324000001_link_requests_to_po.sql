-- Track which inventory requests have been added to a purchase order
ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL;
