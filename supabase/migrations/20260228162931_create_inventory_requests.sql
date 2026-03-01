-- Create inventory requests table for approval mechanism
CREATE TABLE IF NOT EXISTS public.inventory_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('NEW_ITEM', 'ADD_STOCK')),
    item_id UUID REFERENCES public.hotel_inventory_items(id) ON DELETE CASCADE,
    requested_quantity NUMERIC(10, 2) NOT NULL CHECK (requested_quantity > 0),
    estimated_cost NUMERIC(12, 2),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.inventory_requests ENABLE ROW LEVEL SECURITY;

-- Create policies

-- Admins can view all requests
CREATE POLICY "Admins can view all inventory requests" 
ON public.inventory_requests FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Users can view their own requests
CREATE POLICY "Users can view their own inventory requests" 
ON public.inventory_requests FOR SELECT 
USING (
  requested_by = auth.uid() OR
  -- Also allow waiters, payment, kitchen to see requests if needed
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() AND users.role IN ('waiter', 'payment', 'kitchen')
  )
);

-- Authenticated users (staff) can create requests
CREATE POLICY "Authenticated users can create inventory requests" 
ON public.inventory_requests FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND
  requested_by = auth.uid()
);

-- Only Admins can update requests (approve/reject)
CREATE POLICY "Admins can update inventory requests" 
ON public.inventory_requests FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_inventory_requests_mod_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_requests_mod_time
BEFORE UPDATE ON public.inventory_requests
FOR EACH ROW
EXECUTE FUNCTION update_inventory_requests_mod_time();
