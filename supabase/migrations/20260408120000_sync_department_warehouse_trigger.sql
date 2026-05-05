-- 0. Ensure columns exist and phantom constraints are gone (Safety for existing tables)
ALTER TABLE public.inventory_warehouses DROP CONSTRAINT IF EXISTS warehouse_type_check;
ALTER TABLE public.inventory_warehouses ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'Internal';
ALTER TABLE public.inventory_warehouses ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.inventory_warehouses ADD COLUMN IF NOT EXISTS description text;

-- 1. Function to handle the sync
CREATE OR REPLACE FUNCTION public.sync_department_to_warehouse()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Create a new warehouse for the new department
        INSERT INTO public.inventory_warehouses (department_id, name, description, status, type, is_active)
        VALUES (
            NEW.id, 
            NEW.name, 
            NEW.description, 
            NEW.status, 
            'Internal', -- Default type
            (NEW.status = 'active') -- is_active mapped from status
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Update the matching warehouse (identified by department_id)
        UPDATE public.inventory_warehouses
        SET 
            name = NEW.name,
            description = NEW.description,
            status = NEW.status,
            is_active = (NEW.status = 'active'),
            updated_at = timezone('utc'::text, now())
        WHERE department_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS trigger_sync_department_warehouse ON public.inventory_departments;
CREATE TRIGGER trigger_sync_department_warehouse
AFTER INSERT OR UPDATE ON public.inventory_departments
FOR EACH ROW
EXECUTE FUNCTION public.sync_department_to_warehouse();

-- 3. Ensure the unique constraint exists for ON CONFLICT (Safety)
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.inventory_warehouses ADD CONSTRAINT inventory_warehouses_department_id_key UNIQUE (department_id);
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN duplicate_table THEN NULL;
    END;
END $$;

-- 4. Backfill missing warehouses (Safety check)
INSERT INTO public.inventory_warehouses (department_id, name, description, status, type, is_active)
SELECT 
    id, 
    name, 
    description, 
    status,
    'Internal',
    (status = 'active')
FROM public.inventory_departments d
WHERE NOT EXISTS (
    SELECT 1 FROM public.inventory_warehouses w WHERE w.department_id = d.id
)
ON CONFLICT (department_id) DO NOTHING;


