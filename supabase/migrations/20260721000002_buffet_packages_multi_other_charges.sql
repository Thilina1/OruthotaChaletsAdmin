-- Replace the single "other charge" slot (one label + one %) with a flexible
-- list of named charges, each either a percentage of the items subtotal or a
-- flat amount. Lets admins add as many custom charges as they need.
ALTER TABLE public.buffet_packages
  ADD COLUMN IF NOT EXISTS other_charges JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Preserve any existing single other-charge as the first entry in the new list.
UPDATE public.buffet_packages
SET other_charges = jsonb_build_array(
    jsonb_build_object(
        'id', gen_random_uuid()::text,
        'name', COALESCE(other_charge_label, 'Other Charge'),
        'type', 'percentage',
        'value', other_charge_rate
    )
)
WHERE other_charge_rate IS NOT NULL AND other_charge_rate > 0;

ALTER TABLE public.buffet_packages
  DROP COLUMN IF EXISTS other_charge_label,
  DROP COLUMN IF EXISTS other_charge_rate;
