-- Normalize legacy free-text expense categories to COA-compliant values.
-- Run this once to clean up existing data. New entries use the dropdown.

-- Utilities
UPDATE expenses SET category = 'Electricity'             WHERE lower(trim(category)) IN ('utilities','electricity','electricity bill','ceb bill','ceb');
UPDATE expenses SET category = 'Water'                   WHERE lower(trim(category)) IN ('water','water bill');
UPDATE expenses SET category = 'Gas & Fuel'              WHERE lower(trim(category)) IN ('gas','fuel','gas & fuel','gas and fuel');

-- Rent / Administrative
UPDATE expenses SET category = 'Office Rent'             WHERE lower(trim(category)) IN ('rent','office rent');
UPDATE expenses SET category = 'Telephone Expenses'      WHERE lower(trim(category)) IN ('telephone','telephone & internet','telephone and internet','phone','internet');
UPDATE expenses SET category = 'Advertising & Marketing' WHERE lower(trim(category)) IN ('marketing','advertising','advertising & marketing');
UPDATE expenses SET category = 'Travel Expenses'         WHERE lower(trim(category)) IN ('travel','travel & transport','travel and transport');
UPDATE expenses SET category = 'Entertainment Expenses'  WHERE lower(trim(category)) IN ('entertainment','entertainment expenses');
UPDATE expenses SET category = 'Cleaning Supplies & Chemicals' WHERE lower(trim(category)) IN ('cleaning','cleaning supplies','cleaning supplies & chemicals');
UPDATE expenses SET category = 'IT & Software Subscriptions'   WHERE lower(trim(category)) IN ('it','software','it & software','it and software');
UPDATE expenses SET category = 'Postal Expenses'         WHERE lower(trim(category)) IN ('postage','postal','postal expenses');
UPDATE expenses SET category = 'Miscellaneous Expenses'  WHERE lower(trim(category)) IN ('other','others','general','miscellaneous','miscellaneous expenses');

-- Repairs & Maintenance
UPDATE expenses SET category = 'Repairs & Maintenance'   WHERE lower(trim(category)) IN ('maintenance','repairs','repairs & maintenance','repairs and maintenance');
UPDATE expenses SET category = 'Office Maintenance Expenses' WHERE lower(trim(category)) IN ('office maintenance','office maintenance expenses');

-- Staff
UPDATE expenses SET category = 'Salary'                  WHERE lower(trim(category)) IN ('salaries','salary');

-- COGS
UPDATE expenses SET category = 'Food Cost'               WHERE lower(trim(category)) IN ('inventory','food','food cost');
UPDATE expenses SET category = 'Guest Amenities Cost'    WHERE lower(trim(category)) IN ('guest amenities','guest amenities cost');
UPDATE expenses SET category = 'Staff Meals (Cafeteria Cost)' WHERE lower(trim(category)) IN ('staff meals','staff meals (cafeteria cost)','cafeteria');

-- Financial
UPDATE expenses SET category = 'Tourism Board License Renewals' WHERE lower(trim(category)) IN ('tourism board license','tourism license');
UPDATE expenses SET category = 'Liquor License Fees'     WHERE lower(trim(category)) IN ('liquor license','liquor license fees');
