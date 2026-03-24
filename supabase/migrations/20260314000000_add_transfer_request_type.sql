-- Add TRANSFER_REQUEST to request_type constraint
ALTER TABLE public.inventory_requests DROP CONSTRAINT IF EXISTS inventory_requests_request_type_check;
ALTER TABLE public.inventory_requests ADD CONSTRAINT inventory_requests_request_type_check 
CHECK (request_type IN ('NEW_ITEM', 'ADD_STOCK', 'receive', 'issue', 'damage', 'audit_adjustment', 'initial_stock', 'TRANSFER_REQUEST'));
