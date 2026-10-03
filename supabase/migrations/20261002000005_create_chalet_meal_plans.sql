CREATE TABLE IF NOT EXISTS public.chalet_meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  food_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  other_costs JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chalet_packages
  ADD COLUMN IF NOT EXISTS meal_plan_id UUID REFERENCES public.chalet_meal_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meal_plan TEXT;

ALTER TABLE public.chalet_meal_plans
  ADD COLUMN IF NOT EXISTS food_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS other_costs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.chalet_meal_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'chalet_meal_plans'
      AND policyname = 'chalet meal plans all'
  ) THEN
    CREATE POLICY "chalet meal plans all"
      ON public.chalet_meal_plans
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.chalet_meal_plans (name, description, sort_order)
VALUES
  ('Room Only', 'Accommodation only, no meals included', 1),
  ('Bed & breakfast', 'Accommodation with breakfast', 2),
  ('Half Board', 'Accommodation with breakfast and dinner', 3),
  ('Full Board', 'Accommodation with breakfast, lunch, and dinner', 4)
ON CONFLICT (name) DO NOTHING;
