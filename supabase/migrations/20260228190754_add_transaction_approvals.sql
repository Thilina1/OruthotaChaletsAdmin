-- Add action_metadata JSONB column for transaction specific details
ALTER TABLE public.inventory_requests ADD COLUMN action_metadata JSONB;

-- Drop existing constraint on request_type if it exists
ALTER TABLE public.inventory_requests DROP CONSTRAINT IF EXISTS inventory_requests_request_type_check;

-- Add new constraint with all transaction types
ALTER TABLE public.inventory_requests ADD CONSTRAINT inventory_requests_request_type_check 
CHECK (request_type IN ('NEW_ITEM', 'ADD_STOCK', 'receive', 'issue', 'damage', 'audit_adjustment', 'initial_stock'));
