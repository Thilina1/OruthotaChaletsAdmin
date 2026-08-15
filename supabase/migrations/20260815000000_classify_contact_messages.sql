-- Classify contact messages so experience booking inquiries can be filtered
-- and managed separately in Supabase.
ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS inquiry_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS experience_type text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_inquiry_type_check,
  ADD CONSTRAINT contact_messages_inquiry_type_check
    CHECK (inquiry_type IN ('general', 'experience')),
  DROP CONSTRAINT IF EXISTS contact_messages_experience_type_check,
  ADD CONSTRAINT contact_messages_experience_type_check
    CHECK (experience_type IS NULL OR experience_type IN ('culinary_tourism')),
  DROP CONSTRAINT IF EXISTS contact_messages_status_check,
  ADD CONSTRAINT contact_messages_status_check
    CHECK (status IN ('pending', 'contacted', 'confirmed', 'cancelled', 'completed'));

CREATE INDEX IF NOT EXISTS contact_messages_inquiry_type_idx
  ON contact_messages (inquiry_type);

CREATE INDEX IF NOT EXISTS contact_messages_experience_type_idx
  ON contact_messages (experience_type)
  WHERE experience_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS contact_messages_status_idx
  ON contact_messages (status);
