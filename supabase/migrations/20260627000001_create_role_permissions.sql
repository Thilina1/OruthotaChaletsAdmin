-- Default section permissions per role (admin-configurable)
CREATE TABLE IF NOT EXISTS role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role       TEXT NOT NULL CHECK (role IN ('admin', 'waiter', 'kitchen', 'payment')),
  paths      JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_role_permissions" ON role_permissions FOR ALL USING (true) WITH CHECK (true);

-- Seed defaults
INSERT INTO role_permissions (role, paths) VALUES
  ('admin',   '["/dashboard/profile","/dashboard/user-management","/dashboard/settings/roles","/dashboard/customers","/dashboard/loyalty","/dashboard","/dashboard/billing","/dashboard/menu-management","/dashboard/table-management","/dashboard/menu-settings","/dashboard/restaurant-settings","/dashboard/inventory-management/warehouses","/dashboard/inventory-management/add-item","/dashboard/inventory-requests","/dashboard/inventory-requests/history","/dashboard/purchase-orders","/dashboard/purchase-orders/approvals","/dashboard/inventory-stock-overview","/dashboard/inventory-management/grn","/dashboard/inventory-management","/dashboard/inventory-reports","/dashboard/room-management","/dashboard/reservations","/dashboard/inquiries","/dashboard/buffet-bookings","/dashboard/expenses","/dashboard/other-incomes","/dashboard/reports","/dashboard/hrms/employees","/dashboard/hrms/leaves","/dashboard/hrms/reports","/dashboard/hrms/payroll","/dashboard/hrms/attendance","/dashboard/hrms/daily-workers","/dashboard/services/laundry","/dashboard/services/spa","/dashboard/services/transport"]'::jsonb),
  ('waiter',  '["/dashboard/profile","/dashboard","/dashboard/billing","/dashboard/hrms/leaves","/dashboard/hrms/reports","/dashboard/hrms/attendance"]'::jsonb),
  ('kitchen', '["/dashboard/profile","/dashboard","/dashboard/hrms/leaves","/dashboard/hrms/reports","/dashboard/hrms/attendance"]'::jsonb),
  ('payment', '["/dashboard/profile","/dashboard","/dashboard/billing","/dashboard/reports","/dashboard/hrms/leaves","/dashboard/hrms/reports","/dashboard/hrms/attendance"]'::jsonb)
ON CONFLICT (role) DO NOTHING;
