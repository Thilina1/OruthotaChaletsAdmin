-- The transfer-fulfillment flow (PUT /api/admin/inventory-requests) has always
-- written received_quantity when completing a request, but the column was
-- never actually added to the table — so it silently failed to persist and
-- the UI could never distinguish "requested 5, issued 3" from "issued 5".
ALTER TABLE public.inventory_requests
  ADD COLUMN IF NOT EXISTS received_quantity NUMERIC(10, 2);
