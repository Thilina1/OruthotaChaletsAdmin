-- Allow anyone to read app_settings (settings are not sensitive, custom JWT doesn't set auth.role)
CREATE POLICY IF NOT EXISTS "Allow public read of app_settings" ON public.app_settings
    FOR SELECT USING (true);
