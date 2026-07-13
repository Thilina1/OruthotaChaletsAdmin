CREATE TABLE IF NOT EXISTS expense_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    group_name  TEXT NOT NULL DEFAULT 'Custom',
    is_system   BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT expense_categories_name_key UNIQUE (name)
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON expense_categories USING (true) WITH CHECK (true);

-- Seed full COA-compliant system categories
INSERT INTO expense_categories (name, group_name, is_system) VALUES
    -- Direct Costs (COGS)
    ('Food Cost',                       'Direct Costs (COGS)',   true),
    ('Beverage Cost',                   'Direct Costs (COGS)',   true),
    ('Guest Amenities Cost',            'Direct Costs (COGS)',   true),
    ('Staff Meals (Cafeteria Cost)',     'Direct Costs (COGS)',   true),
    ('OTA Commissions',                 'Direct Costs (COGS)',   true),
    ('Stock Adjustment',                'Direct Costs (COGS)',   true),

    -- Utilities
    ('Electricity',                     'Utilities',             true),
    ('Water',                           'Utilities',             true),
    ('Gas & Fuel',                      'Utilities',             true),

    -- Staff Expenses
    ('Salary',                          'Staff Expenses',        true),
    ('Staff Service Charge Distribution','Staff Expenses',       true),
    ('Staff Accommodation',             'Staff Expenses',        true),
    ('Overtime Pay',                    'Staff Expenses',        true),

    -- Repairs & Maintenance
    ('Repairs & Maintenance',           'Repairs & Maintenance', true),
    ('Office Maintenance Expenses',     'Repairs & Maintenance', true),
    ('Housekeeping Supplies',           'Repairs & Maintenance', true),
    ('Laundry Supplies',               'Repairs & Maintenance', true),

    -- Administrative
    ('Office Rent',                     'Administrative',        true),
    ('Telephone Expenses',              'Administrative',        true),
    ('Advertising & Marketing',         'Administrative',        true),
    ('Commission on Sales',             'Administrative',        true),
    ('Sales Expenses',                  'Administrative',        true),
    ('Print & Stationery',              'Administrative',        true),
    ('Cleaning Supplies & Chemicals',   'Administrative',        true),
    ('IT & Software Subscriptions',     'Administrative',        true),
    ('Travel Expenses',                 'Administrative',        true),
    ('Entertainment Expenses',          'Administrative',        true),
    ('Legal Expenses',                  'Administrative',        true),
    ('Freight & Forwarding Charges',    'Administrative',        true),
    ('Postal Expenses',                 'Administrative',        true),
    ('Allowances / Guest Rebates',      'Administrative',        true),
    ('Round Off',                       'Administrative',        true),
    ('Miscellaneous Expenses',          'Administrative',        true),

    -- Financial
    ('Bank Charges',                    'Financial',             true),
    ('Interest Expense',                'Financial',             true),
    ('Depreciation',                    'Financial',             true),
    ('Write Off',                       'Financial',             true),
    ('Exchange Gain/Loss',              'Financial',             true),
    ('Gain/Loss on Asset Disposal',     'Financial',             true),
    ('Impairment',                      'Financial',             true),

    -- Tax & Licenses
    ('Tourism Board License Renewals',  'Tax & Licenses',        true),
    ('Liquor License Fees',             'Tax & Licenses',        true),
    ('Other License Fees',              'Tax & Licenses',        true)

ON CONFLICT (name) DO NOTHING;
