CREATE TABLE IF NOT EXISTS public.app_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc', now())
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.app_settings
    FOR ALL USING (auth.role() = 'authenticated');

-- Seed default: empty restaurant warehouse list
INSERT INTO public.app_settings (key, value)
VALUES ('restaurant_warehouse_ids', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
