-- Add received_quantity column to purchase_order_items
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(10, 2);

-- Update existing records to have received_quantity match quantity
UPDATE purchase_order_items SET received_quantity = quantity WHERE received_quantity IS NULL;
