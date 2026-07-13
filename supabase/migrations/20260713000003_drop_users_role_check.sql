-- The users_role_check constraint blocked assigning custom roles to employees.
-- Custom roles are managed via role_permissions; the constraint is redundant.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
