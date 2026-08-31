CREATE TABLE IF NOT EXISTS public.kitchen_section_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT kitchen_section_items_section_check
    CHECK (section IN ('Staff', 'Function', 'A la carte', 'Room guest')),
  CONSTRAINT kitchen_section_items_unique UNIQUE (section, item_id)
);

CREATE INDEX IF NOT EXISTS kitchen_section_items_item_idx
  ON public.kitchen_section_items(item_id);

COMMENT ON TABLE public.kitchen_section_items IS
  'Inventory items initialized for each Item Request Portal kitchen section.';
