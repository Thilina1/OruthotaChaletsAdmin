-- The role_permissions_role_check constraint limited role to only the four built-in
-- values, blocking custom roles created via the Roles settings page.
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_check;
