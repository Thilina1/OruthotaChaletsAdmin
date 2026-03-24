-- Add toggle to restrict admin permissions to selected ones
ALTER TABLE users ADD COLUMN IF NOT EXISTS restrict_admin_permissions BOOLEAN DEFAULT false;
