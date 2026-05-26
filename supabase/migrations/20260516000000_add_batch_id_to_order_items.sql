-- Add batch_id to order_items to support accurate stock deductions

ALTER TABLE order_items
ADD COLUMN batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL;

COMMENT ON COLUMN order_items.batch_id IS 'References the specific inventory batch this item was fulfilled from, to support accurate stock reversal.';
  



  