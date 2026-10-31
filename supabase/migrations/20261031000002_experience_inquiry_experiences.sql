-- Experiences requested on an inquiry, each with its own headcount:
-- [{ "name": "Tea Plantation Tour", "people": 4 }, ...]. experience_type keeps
-- the names joined for search and older screens; billing starts one line per entry.
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS experiences JSONB;

COMMENT ON COLUMN public.contact_messages.experiences IS
  'Requested experiences with the number of people for each.';
