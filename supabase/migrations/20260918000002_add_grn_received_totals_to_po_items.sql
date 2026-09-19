-- Store GRN/stock-in pricing separately from the original PO price.
-- unit_price and total_price remain the original purchase order values.
-- received_unit_price, discount_amount, and received_total_price represent
-- the actual received market price and discount used for stock and liability.
ALTER TABLE public.purchase_order_items
ADD COLUMN IF NOT EXISTS discount_amount numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS received_unit_price numeric(10, 2),
ADD COLUMN IF NOT EXISTS received_total_price numeric(10, 2);

UPDATE public.purchase_order_items
SET
  discount_amount = COALESCE(discount_amount, 0),
  received_unit_price = COALESCE(received_unit_price, unit_price),
  received_total_price = COALESCE(
    received_total_price,
    GREATEST(
      0,
      COALESCE(unit_price, 0) * COALESCE(received_quantity, quantity, 0) - COALESCE(discount_amount, 0)
    )
  )
WHERE received_quantity IS NOT NULL
  AND (
    received_unit_price IS NULL
    OR received_total_price IS NULL
    OR discount_amount IS NULL
  );
