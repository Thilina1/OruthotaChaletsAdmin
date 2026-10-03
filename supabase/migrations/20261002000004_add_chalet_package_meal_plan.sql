ALTER TABLE public.chalet_packages
  ADD COLUMN IF NOT EXISTS meal_plan TEXT;
