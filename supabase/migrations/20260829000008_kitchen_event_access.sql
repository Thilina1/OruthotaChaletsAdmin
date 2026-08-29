UPDATE public.role_permissions
SET paths = COALESCE(paths, '[]'::jsonb) || '["/dashboard/kitchen/events"]'::jsonb,
    updated_at = NOW()
WHERE role = 'kitchen'
  AND NOT COALESCE(paths, '[]'::jsonb) @> '["/dashboard/kitchen/events"]'::jsonb;

-- Existing kitchen users store their effective permissions separately.
UPDATE public.users
SET permissions = COALESCE(permissions, '[]'::jsonb) || '["/dashboard/kitchen/events"]'::jsonb
WHERE role = 'kitchen'
  AND NOT COALESCE(permissions, '[]'::jsonb) @> '["/dashboard/kitchen/events"]'::jsonb;
