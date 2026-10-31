-- Experiences are now managed in Service Line Items (service type 'Experience'),
-- so experience_type holds the chosen experience names instead of the single
-- 'culinary_tourism' value. The website still sends 'culinary_tourism', which
-- remains valid.
ALTER TABLE public.contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_experience_type_check;
