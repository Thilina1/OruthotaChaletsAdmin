import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { normalizeExpenseCategory } from '@/lib/expense-categories';

// Map a category/source to a COA department for P&L reporting
function assignDepartment(category: string, source?: string): string {
  const cat = (category || '').toLowerCase();
  const src = (source || '').toLowerCase();

  if (cat === 'room income' || src === 'reservations') return 'Rooms';
  if (cat === 'restaurant income' || src === 'restaurant') return 'Food & Beverage';
  if (cat === 'food cost' || cat === 'beverage cost' || cat === 'guest amenities cost'
    || cat === 'staff meals (cafeteria cost)' || cat === 'stock adjustment'
    || cat === 'ota commissions') return 'Food & Beverage';

  if (cat === 'service income') {
    if (src === 'laundry') return 'Laundry';
    if (src === 'transport') return 'Transport & Excursions';
    if (src === 'spa' || src === 'pool') return 'Spa / Pool';
    return 'Services';
  }

  if (cat === 'salary' || cat === 'salaries' || src === 'payroll'
    || cat === 'staff service charge distribution' || cat === 'overtime pay'
    || cat === 'daily wages' || src === 'daily workers'
    || cat === 'staff accommodation') return 'Human Resources';

  if (cat === 'electricity' || cat === 'water' || cat === 'gas & fuel') return 'Utilities';

  if (cat === 'bank charges' || cat === 'interest expense' || cat === 'depreciation'
    || cat === 'write off' || cat === 'exchange gain/loss'
    || cat === 'gain/loss on asset disposal' || cat === 'impairment') return 'Finance';

  if (cat === 'tourism board license renewals' || cat === 'liquor license fees'
    || cat === 'other license fees') return 'Finance';

  if (cat === 'other income') return 'General';

  if (cat === 'inventory purchases') return 'Inventory';

  return 'Administration';
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('auth_token')?.value;
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!(await verifyToken(token))) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        // payroll_records uses YYYY-MM month format
        const fromMonth = from ? from.slice(0, 7) : null;
        const toMonth = to ? to.slice(0, 7) : null;

        const applyDate = (query: any, col: string) => {
            if (from) query = query.gte(col, from);
            if (to) query = query.lte(col, to);
            return query;
        };

        const applyMonth = (query: any) => {
            if (fromMonth) query = query.gte('month', fromMonth);
            if (toMonth) query = query.lte('month', toMonth);
            return query;
        };

        const [
            expensesRes,
            otherIncomesRes,
            serviceIncomesRes,
            reservationsRes,
            ordersRes,
            payrollRes,
            dailyPaymentsRes,
            inventoryIssuesRes,
        ] = await Promise.all([
            applyDate(supabase.from('expenses').select('id,description,amount,category,date').order('date', { ascending: false }), 'date'),
            applyDate(supabase.from('other_incomes').select('id,description,amount,source,date').order('date', { ascending: false }), 'date'),
            applyDate(
                supabase.from('service_incomes').select('id,description,amount,service_type,date,customer_name,payment_status').eq('payment_status', 'paid').order('date', { ascending: false }),
                'date'
            ),
            applyDate(
                supabase.from('reservations').select('id,guest_name,total_cost,check_out_date,status').eq('status', 'completed').order('check_out_date', { ascending: false }),
                'check_out_date'
            ),
            applyDate(
                supabase.from('orders').select('id,total_price,confirmed_total,table_number,status,created_at').eq('status', 'closed').order('created_at', { ascending: false }),
                'created_at'
            ),
            // Payroll: true employer cost = net_salary + epf_employee_8 + epf_employer_12 + etf_employer_3
            applyMonth(
                supabase.from('payroll_records')
                    .select('id,user_id,month,net_salary,epf_employee_8,epf_employer_12,etf_employer_3,users(name)')
                    .order('month', { ascending: false })
            ),
            // Daily worker payments (paid only)
            applyDate(
                supabase.from('daily_payments').select('id,worker_id,date,amount,is_paid,casual_workers(name)').eq('is_paid', true).order('date', { ascending: false }),
                'date'
            ),
            // Inventory COGS: items issued to kitchen/bar
            applyDate(
                supabase.from('inventory_transactions')
                    .select('id,quantity,created_at,item:inventory_items(name,category:inventory_categories(name)),batch:inventory_batches(buying_price)')
                    .eq('transaction_type', 'issue')
                    .order('created_at', { ascending: false }),
                'created_at'
            ),
        ]);

        // --- Income ---
        const otherIncomes = (otherIncomesRes.data || []).map((r: any) => ({
            id: r.id, type: 'income' as const,
            description: r.description, amount: Number(r.amount),
            category: 'Other Income', date: r.date, source: r.source,
            department: assignDepartment('Other Income', r.source),
        }));

        const serviceIncomes = (serviceIncomesRes.data || []).map((r: any) => {
            const source = r.service_type ? r.service_type.replace(/_/g, ' ') : 'Service';
            return {
                id: r.id, type: 'income' as const,
                description: r.description || r.service_type, amount: Number(r.amount),
                category: 'Service Income', date: r.date, source,
                meta: r.customer_name,
                department: assignDepartment('Service Income', source),
            };
        });

        const reservationIncomes = (reservationsRes.data || []).map((r: any) => ({
            id: r.id, type: 'income' as const,
            description: `Room: ${r.guest_name || 'Guest'}`, amount: Number(r.total_cost || 0),
            category: 'Room Income', date: r.check_out_date || new Date().toISOString().split('T')[0],
            source: 'Reservations', meta: r.guest_name,
            department: 'Rooms',
        }));

        const orderIncomes = (ordersRes.data || []).map((r: any) => ({
            id: r.id, type: 'income' as const,
            description: r.table_number ? `Restaurant — Table ${r.table_number}` : 'Restaurant Order',
            amount: Number(r.confirmed_total || r.total_price || 0),
            category: 'Restaurant Income', date: (r.created_at || '').split('T')[0],
            source: 'Restaurant',
            department: 'Food & Beverage',
        }));

        // --- Expenses ---
        const generalExpenses = (expensesRes.data || []).map((r: any) => {
            const rawCat = r.category || 'Miscellaneous';
            const category = normalizeExpenseCategory(rawCat);
            return {
                id: r.id, type: 'expense' as const,
                description: r.description, amount: Number(r.amount),
                category, date: r.date, source: rawCat,
                department: assignDepartment(category),
            };
        });

        // True employer cost = what leaves the business:
        //   net_salary (to employee) + epf_employee_8 (employee's share paid to EPF)
        //   + epf_employer_12 (employer's extra EPF) + etf_employer_3 (employer's ETF)
        const payrollExpenses = (payrollRes.data || []).map((r: any) => {
            const net       = Number(r.net_salary     || 0);
            const epfEe     = Number(r.epf_employee_8 || 0);
            const epfEr     = Number(r.epf_employer_12 || 0);
            const etfEr     = Number(r.etf_employer_3  || 0);
            const employerCost = net + epfEe + epfEr + etfEr;
            const employeeName = (r.users as any)?.name || 'Employee';
            return {
                id: r.id, type: 'expense' as const,
                description: `Salary: ${employeeName}`,
                amount: employerCost,
                category: 'Salary',
                date: `${r.month}-01`,
                source: 'Payroll',
                department: 'Human Resources',
                meta: `Net ${net.toLocaleString()} + EPF emp ${epfEe.toLocaleString()} + EPF empl ${epfEr.toLocaleString()} + ETF ${etfEr.toLocaleString()}`,
            };
        });

        const dailyWageExpenses = (dailyPaymentsRes.data || []).map((r: any) => {
            const workerName = (r.casual_workers as any)?.name || 'Daily Worker';
            return {
                id: r.id, type: 'expense' as const,
                description: `Daily Wage: ${workerName}`,
                amount: Number(r.amount || 0),
                category: 'Daily Wages',
                date: r.date,
                source: 'Daily Workers',
                department: 'Human Resources',
            };
        });

        // COGS from inventory issues
        const BEVERAGE_KEYWORDS = ['beer', 'wine', 'spirits', 'whiskey', 'rum', 'vodka', 'gin', 'juice', 'soft drink', 'soda', 'beverage', 'drink', 'alcohol', 'cocktail', 'liquor', 'bar'];
        const inventoryCogs = (inventoryIssuesRes.data || []).map((r: any) => {
            const qty = Number(r.quantity || 0);
            const buyingPrice = Number(r.batch?.buying_price || 0);
            const cost = qty * buyingPrice;
            const itemName = r.item?.name || 'Item';
            const catName = ((r.item?.category?.name) || '').toLowerCase();
            const isBeverage = BEVERAGE_KEYWORDS.some(k => catName.includes(k) || itemName.toLowerCase().includes(k));
            return {
                id: r.id, type: 'expense' as const,
                description: `COGS: ${itemName} (${qty} units)`,
                amount: cost,
                category: isBeverage ? 'Beverage Cost' : 'Food Cost',
                date: (r.created_at || '').split('T')[0],
                source: 'Inventory',
                department: 'Food & Beverage',
                meta: `${qty} × LKR ${buyingPrice}`,
            };
        }).filter((r: any) => r.amount > 0);

        // Inventory cash purchases — kept separate so a missing table never breaks the rest of accounting
        // ISSUED: cash is already out of accounting, use issued_at as the expense date
        // SETTLED: confirmed spend, use settled_at; any returned cash reduces the net figure via meta
        let cashPurchaseExpenses: any[] = [];
        try {
            const { data: cashData } = await supabase
                .from('inventory_cash_requests')
                .select('id,request_number,purpose,status,issued_amount,additional_issued_amount,spent_amount,returned_amount,issued_at,settled_at,requested_by_user:users!inventory_cash_requests_requested_by_fkey(name)')
                .in('status', ['ISSUED', 'SETTLED']);

            cashPurchaseExpenses = (cashData || []).map((r: any) => {
                const employeeName = r.requested_by_user?.name || 'Employee';
                const isSettled = r.status === 'SETTLED';
                const dateStr = isSettled
                    ? (r.settled_at || '').split('T')[0]
                    : (r.issued_at || '').split('T')[0];

                // Apply date filter in JS — issued vs settled use different date columns
                if (!dateStr) return null;
                if (from && dateStr < from) return null;
                if (to && dateStr > to) return null;

                const amount = isSettled
                    ? Number(r.spent_amount || 0)
                    : Number(r.issued_amount || 0) + Number(r.additional_issued_amount || 0);
                const returned = isSettled ? Number(r.returned_amount || 0) : 0;

                return {
                    id: r.id, type: 'expense' as const,
                    description: `${r.purpose} (${r.request_number})`,
                    amount,
                    category: 'Inventory Purchases',
                    date: dateStr,
                    source: 'Cash Request',
                    department: 'Inventory',
                    meta: isSettled
                        ? `By ${employeeName}${returned > 0 ? ` · Returned LKR ${returned.toLocaleString()}` : ''}`
                        : `By ${employeeName} · Pending settlement`,
                };
            }).filter((r: any) => r && r.amount > 0);
        } catch (_) {
            // inventory_cash_requests table not yet migrated — skip silently
        }

        const allIncomes = [...otherIncomes, ...serviceIncomes, ...reservationIncomes, ...orderIncomes];
        const allExpenses = [...generalExpenses, ...payrollExpenses, ...dailyWageExpenses, ...inventoryCogs, ...cashPurchaseExpenses];

        const totalIncome = allIncomes.reduce((s, r) => s + r.amount, 0);
        const totalExpenses = allExpenses.reduce((s, r) => s + r.amount, 0);
        const netPL = totalIncome - totalExpenses;

        const incomeByCategory: Record<string, number> = {};
        for (const r of allIncomes) {
            incomeByCategory[r.category] = (incomeByCategory[r.category] || 0) + r.amount;
        }

        const expenseByCategory: Record<string, number> = {};
        for (const r of allExpenses) {
            expenseByCategory[r.category] = (expenseByCategory[r.category] || 0) + r.amount;
        }

        // Department P&L
        const deptMap: Record<string, { income: number; expenses: number }> = {};
        for (const r of allIncomes) {
            const d = (r as any).department || 'General';
            if (!deptMap[d]) deptMap[d] = { income: 0, expenses: 0 };
            deptMap[d].income += r.amount;
        }
        for (const r of allExpenses) {
            const d = (r as any).department || 'Administration';
            if (!deptMap[d]) deptMap[d] = { income: 0, expenses: 0 };
            deptMap[d].expenses += r.amount;
        }
        const departmentPL = Object.entries(deptMap)
            .map(([department, v]) => ({ department, ...v, net: v.income - v.expenses }))
            .sort((a, b) => b.income - a.income);

        return NextResponse.json({
            summary: { totalIncome, totalExpenses, netPL },
            incomeByCategory,
            expenseByCategory,
            departmentPL,
            incomes: allIncomes,
            expenses: allExpenses,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
