# Orudhota Chalets — Accounting Gap Analysis
## Current System vs Hotel Chart of Accounts (COA)

**Date:** 2026-06-28  
**Prepared by:** System Review against Hotel COA PDF

---

## LEGEND
- ✅ Fully implemented
- ⚠️ Partially implemented
- ❌ Not implemented
- 🔜 Recommended next build

---

## 1. INCOME

### 1.1 Direct Income — Sales

| COA Line Item | System Status | Notes |
|---|---|---|
| Room Revenue (Local/Foreign) | ✅ | `reservations` table (status=completed), `total_cost` pulled into Accounting |
| F&B Revenue (Restaurant & Bar) | ⚠️ | `orders` table (status=paid) pulled in, but NOT broken down into Food vs Beverage vs Bar |
| Banquet & Events Revenue | ❌ | No `banquet_bookings` income tracking. `buffet_bookings` page exists but not linked to Accounting |
| Cancellation Fees & No-Show Revenue | ❌ | No dedicated tracking. Would need a field on `reservations` |
| Late Check-out / Early Check-in Fees | ❌ | Not tracked anywhere in the system |

### 1.2 Direct Income — Service

| COA Line Item | System Status | Notes |
|---|---|---|
| Laundry Income | ✅ | `service_incomes` (service_type='laundry'), pulled into Accounting |
| Transport & Excursion Income | ✅ | `service_incomes` (service_type='transport'), pulled into Accounting |
| Spa / Pool Income | ✅ | `service_incomes` (service_type='spa'), pulled into Accounting |

### 1.3 Indirect Income

| COA Line Item | System Status | Notes |
|---|---|---|
| Interest Income | ❌ | Not tracked. Could be added as `other_incomes` category but no dedicated field |
| Interest on Fixed Deposits | ❌ | Not tracked |

**Income currently tracked via `other_incomes` table (free-form source field)** — works as a catch-all but has no enforced COA category structure.

---

## 2. EXPENSES

### 2.1 Direct Expenses — Cost of Goods Sold

| COA Line Item | System Status | Notes |
|---|---|---|
| Food Cost | ❌ | Inventory module exists (food stock tracked) but cost of goods consumed is NOT calculated or posted to Accounting |
| Beverage Cost | ❌ | Same as above — stock tracked, cost not posted |
| Guest Amenities Cost | ❌ | Not tracked |
| Staff Meals (Cafeteria Cost) | ❌ | Not tracked |
| OTA Commissions (Booking.com/Agoda) | ❌ | Not tracked. Reservation revenue is posted at gross; no commission deduction |
| Stock Adjustment | ⚠️ | Inventory adjustments exist (audit_adjustment type) but NOT linked to Accounting as an expense |

### 2.2 Indirect Expenses — Salary & HR

| COA Line Item | System Status | Notes |
|---|---|---|
| Permanent Staff Salaries | ✅ | `payroll_records` — employer cost (net + EPF 8%+12% + ETF 3%) posted to Accounting |
| Daily Wages | ✅ | `daily_payments` (is_paid=true) posted to Accounting |
| Staff Service Charge Distribution | ❌ | Service charge collected but distribution to staff not tracked |
| EPF & ETF Payable (Liability) | ❌ | Calculated in payroll but NOT recorded as a liability until paid to the department |

### 2.3 Indirect Expenses — Utility

| COA Line Item | System Status | Notes |
|---|---|---|
| Electricity | ⚠️ | Can be entered in `expenses` table manually, but no dedicated category enforcement |
| Water | ⚠️ | Same as above |
| Gas & Fuel | ⚠️ | Same as above |

### 2.4 Indirect Expenses — Administrative

| COA Line Item | System Status | Notes |
|---|---|---|
| Administrative Expenses | ⚠️ | `expenses` table with free-form category |
| Office Rent | ⚠️ | Can be entered manually in `expenses` |
| Marketing Expenses | ⚠️ | Can be entered manually |
| Legal Expenses | ⚠️ | Can be entered manually |
| Telephone Expenses | ⚠️ | Can be entered manually |
| Travel Expenses | ⚠️ | Can be entered manually |
| Print and Stationery | ⚠️ | Can be entered manually |
| Cleaning Supplies & Chemicals | ⚠️ | Can be entered manually |
| Software Subscriptions & IT Maintenance | ⚠️ | Can be entered manually |
| Entertainment Expenses | ⚠️ | Can be entered manually |
| Miscellaneous Expenses | ⚠️ | Can be entered manually |
| Freight and Forwarding Charges | ⚠️ | Can be entered manually |
| Postal Expenses | ⚠️ | Can be entered manually |

> ⚠️ **Key Problem:** The `expenses` table uses a free-text `category` field. There is NO enforced COA category list. Users can type anything, which makes reports inconsistent. **Fix:** replace free-text category with a dropdown of COA-compliant categories.

### 2.5 Indirect Expenses — Financial

| COA Line Item | System Status | Notes |
|---|---|---|
| Bank Charges | ❌ | Not tracked (could be entered in `expenses` if category existed) |
| Interest Expense | ❌ | Not tracked |
| Exchange Gain / Loss | ❌ | No multi-currency support |
| Depreciation | ❌ | Fixed assets not tracked; no depreciation schedule |
| Write Off | ❌ | Not tracked |
| Impairment | ❌ | Not tracked |
| Gain / Loss on Asset Disposal | ❌ | Not tracked |
| Allowances / Guest Rebates | ❌ | Not tracked |

### 2.6 Tax Expenses

| COA Line Item | System Status | Notes |
|---|---|---|
| Tourism Board License Renewals | ⚠️ | Can be entered manually in `expenses` |
| Liquor License Fees | ⚠️ | Can be entered manually in `expenses` |
| VAT Output | ❌ | No VAT tracking on sales |
| SSCL Payable | ❌ | Not tracked |
| Tourism Development Levy (TDL) | ❌ | Not tracked |
| APIT (Income Tax) | ⚠️ | APIT calculated in payroll but not posted to Accounting as a tax expense |

---

## 3. ASSETS

### 3.1 Current Assets

| COA Line Item | System Status | Notes |
|---|---|---|
| Bank Accounts | ✅ | `accounts` table (type=bank) with transaction history |
| Cash In Hand | ✅ | `accounts` table (type=cash) |
| Petty Cash | ✅ | `accounts` table (type=cash, name='Petty Cash') |
| Front Office Float | ✅ | `accounts` table (type=cash, name='Front Office Float') |
| Savings Accounts | ✅ | `accounts` table (type=savings) |
| Accounts Receivable / Guest Ledger | ❌ | Pending guest bills not tracked as receivables. `reservations` status exists but no AR aging |
| City Ledger (Corporate/Agent credit) | ❌ | No corporate credit account tracking |
| Credit Card Settlement / POS Clearing | ❌ | Not tracked |
| Employee Advances (Asset) | ❌ | Not tracked |
| Earnest Money / Rent Deposits | ❌ | Not tracked |
| Prepaid Expenses | ❌ | Not tracked |
| Short-term Investments | ⚠️ | `accounts` table (type=savings) can represent FDs but no interest accrual |
| Stock Assets (Food/Beverage/HK Stock) | ⚠️ | Inventory module tracks stock quantities but no monetary valuation posted to Accounting |
| VAT Input | ❌ | No VAT tracking |

### 3.2 Fixed Assets

| COA Line Item | System Status | Notes |
|---|---|---|
| Capital Equipment | ❌ | Not tracked |
| Electronic Equipment | ❌ | Not tracked |
| Furniture and Fixtures | ❌ | Not tracked |
| Office Equipment | ❌ | Not tracked |
| Plants and Machineries | ❌ | Not tracked |
| Buildings | ❌ | Not tracked |
| Software | ❌ | Not tracked |
| Kitchen & Restaurant Equipment | ❌ | Not tracked |
| Accumulated Depreciation | ❌ | No depreciation schedule |
| CWIP Account | ❌ | Not tracked |

---

## 4. LIABILITIES

### 4.1 Current Liabilities

| COA Line Item | System Status | Notes |
|---|---|---|
| Accounts Payable / Creditors | ❌ | Purchase Orders exist but no AP liability posting |
| EPF & ETF Payable | ❌ | Calculated in payroll but not posted as a liability |
| Accrued Expenses | ❌ | Not tracked |
| Guest Advance Deposits | ❌ | Booking advances not tracked as liabilities |
| Stock Received But Not Billed | ❌ | GRN exists but no liability posting |
| VAT Output | ❌ | No VAT tracking on sales |
| SSCL Payable | ❌ | Not tracked |
| Tourism Development Levy (TDL) | ❌ | Not tracked |
| Service Charge Payable | ❌ | Service charge collected on orders but not tracked as a liability |
| Tips Payable | ❌ | Not tracked |

### 4.2 Loans

| COA Line Item | System Status | Notes |
|---|---|---|
| Secured Loans | ❌ | Not tracked (could use `accounts` type=other as workaround) |
| Unsecured Loans | ❌ | Not tracked |
| Bank Overdraft | ❌ | Not tracked (accounts don't have negative-balance/OD type) |

### 4.3 Non-Current Liabilities

| COA Line Item | System Status | Notes |
|---|---|---|
| Long-term Provisions | ❌ | Not tracked |
| Employee Benefits Obligation (Gratuity) | ❌ | Not tracked |

---

## 5. EQUITY

| COA Line Item | System Status | Notes |
|---|---|---|
| Capital Stock | ❌ | Not tracked |
| Dividends Paid | ❌ | Not tracked |
| Opening Balance Equity | ❌ | Not tracked |
| Retained Earnings | ❌ | Derived from P&L but not formally posted |
| Revaluation Surplus | ❌ | Not tracked |

---

## 6. PRIORITY ROADMAP

### Phase 1 — Quick Wins (Low effort, high impact) 🔜

1. **Enforce COA expense categories** — Replace the free-text `category` field in the `expenses` table with a dropdown matching the COA indirect expense list (Electricity, Water, Gas & Fuel, Office Rent, Marketing, etc.). This immediately makes the Accounting Expense Breakdown chart meaningful.

2. **Add missing income types to `other_incomes` or dedicated tables:**
   - Cancellation Fees
   - Late Check-out / Early Check-in Fees
   - Interest Income / FD Interest
   - Banquet & Events Revenue (link from `buffet_bookings`)

3. **OTA Commission tracking** — Add a `commission_amount` and `ota_name` field to `reservations` so net room revenue is accurate.

4. **Utility expense sub-categories** — Add Electricity, Water, Gas & Fuel as enforced sub-categories.

---

### Phase 2 — Medium Priority 🔜

5. **Accounts Receivable (Guest Ledger)** — Track pending bills from checked-in guests. Currently when a guest checks in, there's no AR entry. Need: AR balance per guest, aging report (0-30, 31-60, 60+ days).

6. **EPF/ETF Payable Liability** — When payroll is processed, post EPF+ETF as a current liability. Clear it when payment is made to the department of labour.

7. **Service Charge & Tips** — Track service charge collected on restaurant orders as a liability, and record distribution to staff as an expense.

8. **Cost of Goods Sold from Inventory** — When inventory items are consumed/issued to F&B, post the cost to Food Cost or Beverage Cost accounts. Requires linking inventory issue transactions to Accounting.

9. **Stock Valuation** — Post inventory value (from `inventory_items` quantities × unit cost) as a Stock Asset on the balance sheet.

---

### Phase 3 — Advanced / Full Accounting 🔜

10. **Fixed Asset Register** — Track capital equipment, furniture, buildings with purchase date, cost, useful life, and auto-calculate monthly depreciation. Post depreciation as an expense.

11. **Loan / Liability Tracking** — Record loan receipts and repayments. Track interest accrual.

12. **Tax Tracking** — VAT Output/Input, SSCL, TDL tracking on transactions with a tax liability report for filing.

13. **Equity & Balance Sheet** — Capital, retained earnings, revaluation surplus. Produce a full Balance Sheet report (Assets = Liabilities + Equity).

14. **Multi-currency** — Exchange gain/loss for foreign currency room bookings.

15. **Gratuity / Employee Benefits Obligation** — Accrue gratuity liability based on years of service.

---

## 7. WHAT IS WORKING WELL

| Area | Detail |
|---|---|
| **Revenue capture** | Room, Restaurant, Laundry, Spa, Transport all flow into Accounting automatically |
| **Payroll expenses** | Permanent staff (correct employer cost formula) + daily wages |
| **Bank/Cash accounts** | Manual account ledger with deposit/withdrawal tracking and running balance |
| **P&L view** | Income vs Expenses bar chart, trend line, donut breakdowns, date range filter |
| **Transaction ledger** | Combined chronological view of all income and expense entries |

---

## 8. IMMEDIATE DATA QUALITY ISSUES

| Issue | Impact | Fix |
|---|---|---|
| `expenses.category` is free text | Expense breakdown chart is unreliable — same concept entered as "Electricity", "electricity bill", "CEB", etc. | Migrate to enforced COA category enum |
| Room revenue at gross (no OTA commission deduction) | Overstates room income for OTA bookings | Add commission field to reservations |
| Payroll posted on 1st of month regardless of payment date | Timing mismatch in monthly P&L | Use `released_at` date (when payroll was released to employees) instead |
| Service incomes only counted when `payment_status='paid'` | `add_to_bill` items settled via front-desk settle-bill don't appear in Accounting | Need to catch status change to 'paid' via settle-bill flow |
