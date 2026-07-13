ALTER TABLE users
  ADD COLUMN IF NOT EXISTS inventory_admin boolean NOT NULL DEFAULT false;
