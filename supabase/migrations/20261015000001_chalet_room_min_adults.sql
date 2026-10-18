-- Fewest adults a chalet room is offered to on the website (children do not
-- count). NULL means no minimum.
ALTER TABLE public.chalet_rooms
    ADD COLUMN IF NOT EXISTS min_adults INT CHECK (min_adults IS NULL OR min_adults >= 1);
