-- Add COMPLETED to status constraint
ALTER TABLE public.inventory_requests DROP CONSTRAINT IF EXISTS inventory_requests_status_check;
ALTER TABLE public.inventory_requests ADD CONSTRAINT inventory_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'));
