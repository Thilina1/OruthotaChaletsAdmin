-- Add status column to inventory_departments for soft delete
ALTER TABLE public.inventory_departments 
ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('active', 'inactive')) DEFAULT 'active';

-- Update existing records if any were null (though DEFAULT handles new ones)
UPDATE public.inventory_departments SET status = 'active' WHERE status IS NULL;
