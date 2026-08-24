export interface ExpenseCategoryGroup {
  group: string;
  categories: string[];
}

export const EXPENSE_CATEGORY_GROUPS: ExpenseCategoryGroup[] = [
  {
    group: 'Direct Costs (COGS)',
    categories: [
      'Food Cost',
      'Beverage Cost',
      'Guest Amenities Cost',
      'Staff Meals (Cafeteria Cost)',
      'OTA Commissions',
      'Stock Adjustment',
    ],
  },
  {
    group: 'Utilities',
    categories: ['Electricity', 'Water', 'Gas & Fuel'],
  },
  {
    group: 'Staff Expenses',
    categories: [
      'Salary',
      'Staff Service Charge Distribution',
      'Staff Accommodation',
      'Overtime Pay',
    ],
  },
  {
    group: 'Repairs & Maintenance',
    categories: [
      'Repairs & Maintenance',
      'Office Maintenance Expenses',
      'Housekeeping Supplies',
      'Laundry Supplies',
    ],
  },
  {
    group: 'Administrative',
    categories: [
      'Office Rent',
      'Telephone Expenses',
      'Advertising & Marketing',
      'Commission on Sales',
      'Sales Expenses',
      'Print & Stationery',
      'Cleaning Supplies & Chemicals',
      'IT & Software Subscriptions',
      'Travel Expenses',
      'Entertainment Expenses',
      'Legal Expenses',
      'Freight & Forwarding Charges',
      'Postal Expenses',
      'Allowances / Guest Rebates',
      'Round Off',
      'Miscellaneous Expenses',
    ],
  },
  {
    group: 'Financial',
    categories: [
      'Bank Charges',
      'Interest Expense',
      'Depreciation',
      'Write Off',
      'Exchange Gain/Loss',
      'Gain/Loss on Asset Disposal',
      'Impairment',
    ],
  },
  {
    group: 'Tax & Licenses',
    categories: [
      'Tourism Board License Renewals',
      'Liquor License Fees',
      'Other License Fees',
    ],
  },
];

export const ALL_EXPENSE_CATEGORIES: string[] = EXPENSE_CATEGORY_GROUPS.flatMap(
  (g) => g.categories
);

/** Canonical form for old free-text entries so charts group them correctly */
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  // Utilities
  utilities: 'Electricity',
  electricity: 'Electricity',
  'electricity bill': 'Electricity',
  'ceb bill': 'Electricity',
  ceb: 'Electricity',
  water: 'Water',
  'water bill': 'Water',
  gas: 'Gas & Fuel',
  fuel: 'Gas & Fuel',
  'gas & fuel': 'Gas & Fuel',
  // Rent
  rent: 'Office Rent',
  'office rent': 'Office Rent',
  // Staff
  salaries: 'Salary',
  salary: 'Salary',
  // Inventory / COGS
  inventory: 'Food Cost',
  'food cost': 'Food Cost',
  'beverage cost': 'Beverage Cost',
  // Maintenance
  maintenance: 'Repairs & Maintenance',
  'office maintenance': 'Office Maintenance Expenses',
  // Marketing
  marketing: 'Advertising & Marketing',
  advertising: 'Advertising & Marketing',
  // Old generic names → COA names
  'guest amenities': 'Guest Amenities Cost',
  'staff meals': 'Staff Meals (Cafeteria Cost)',
  'telephone & internet': 'Telephone Expenses',
  'telephone': 'Telephone Expenses',
  'travel & transport': 'Travel Expenses',
  'travel': 'Travel Expenses',
  'entertainment': 'Entertainment Expenses',
  'cleaning supplies': 'Cleaning Supplies & Chemicals',
  'it & software': 'IT & Software Subscriptions',
  'postage': 'Postal Expenses',
  'miscellaneous': 'Miscellaneous Expenses',
  'tourism board license': 'Tourism Board License Renewals',
  'liquor license': 'Liquor License Fees',
  // Catch-all
  other: 'Miscellaneous Expenses',
  general: 'Miscellaneous Expenses',
};

export function normalizeExpenseCategory(raw: string): string {
  const key = (raw || '').trim().toLowerCase();
  return LEGACY_CATEGORY_MAP[key] ?? raw;
}
