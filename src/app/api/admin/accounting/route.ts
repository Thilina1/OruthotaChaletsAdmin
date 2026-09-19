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
  if (cat === 'inventory loss') return 'Inventory';

  return 'Administration';
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
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
            accountTransactionsRes,
            guestBillsRes,
            eventPaymentsRes,
        ] = await Promise.all([
            applyDate(supabase.from('expenses').select('id,description,amount,category,date').order('date', { ascending: false }), 'date'),
            applyDate(supabase.from('other_incomes').select('id,description,amount,source,date').order('date', { ascending: false }), 'date'),
            applyDate(
                supabase.from('service_incomes').select('id,description,amount,service_type,date,customer_name,payment_status,payment_method').eq('payment_status', 'paid').order('date', { ascending: false }),
                'date'
            ),
            applyDate(
                supabase.from('reservations').select('id,guest_name,total_cost,check_out_date,status,payment_method').eq('status', 'completed').order('check_out_date', { ascending: false }),
                'check_out_date'
            ),
            applyDate(
                supabase.from('orders').select('id,total_price,confirmed_total,table_number,status,created_at,payment_method').eq('status', 'closed').order('created_at', { ascending: false }),
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
            applyDate(
                supabase.from('account_transactions')
                    .select('id,account_id,type,amount,description,reference,date,balance_after,created_at,account:accounts(name,type)')
                    .order('date', { ascending: false })
                    .order('created_at', { ascending: false }),
                'date'
            ),
            applyDate(
                supabase.from('guest_bill_history')
                    .select('id,bill_number,total,payment_method,items,paid_at,customer:customers(name)')
                    .order('paid_at', { ascending: false }),
                'paid_at'
            ),
            applyDate(
                supabase.from('event_payments')
                    .select('id,receipt_number,payer_name,amount,payment_method,payment_type,paid_at,event:events(name)')
                    .order('paid_at', { ascending: false }),
                'paid_at'
            ),
        ]);

        // --- Income ---
        const guestBillSourceIds = new Set<string>();
        const frontDeskIncomes = (guestBillsRes.data || []).flatMap((bill: any) => {
            if (bill.payment_method === 'card') return [];
            const paidDate = (bill.paid_at || '').split('T')[0];
            const items = Array.isArray(bill.items) ? bill.items : [];
            return items.map((item: any, index: number) => {
                if (item.source_id) guestBillSourceIds.add(String(item.source_id));
                const category = item.category === 'Room'
                    ? 'Room Income'
                    : item.category === 'Restaurant'
                        ? 'Restaurant Income'
                        : item.category === 'Chalet'
                            ? 'Room Income'
                            : 'Service Income';
                const source = item.category === 'Chalet' ? 'Chalet' : item.category || 'Front Desk';
                return {
                    id: `${bill.id}-${index}`,
                    type: 'income' as const,
                    description: item.description || `Front Desk ${source}`,
                    amount: Number(item.amount || 0),
                    category,
                    date: paidDate,
                    source: `Front Desk ${source}`,
                    meta: `${bill.bill_number} · ${bill.payment_method}${bill.customer?.name ? ` · ${bill.customer.name}` : ''}`,
                    department: assignDepartment(category, source),
                };
            });
        }).filter((row: any) => row.amount !== 0);

        const otherIncomes = (otherIncomesRes.data || []).map((r: any) => ({
            id: r.id, type: 'income' as const,
            description: r.description, amount: Number(r.amount),
            category: 'Other Income', date: r.date, source: r.source,
            department: assignDepartment('Other Income', r.source),
        }));

        const eventIncomes = (eventPaymentsRes.data || []).map((r: any) => {
            if (r.payment_method === 'card') return null;
            const amount = Number(r.amount || 0) * (r.payment_type === 'refund' ? -1 : 1);
            return {
                id: `event-${r.id}`,
                type: 'income' as const,
                description: `Event: ${r.event?.name || r.receipt_number || 'Payment'}`,
                amount,
                category: 'Event Income',
                date: (r.paid_at || '').split('T')[0],
                source: 'Event',
                meta: `${r.receipt_number || 'Receipt'} · ${r.payment_method || 'payment'}${r.payer_name ? ` · ${r.payer_name}` : ''}`,
                department: 'Events',
            };
        }).filter((row: any) => row && row.amount !== 0);

        const cardPaymentIncomes = (accountTransactionsRes.data || []).filter((tx: any) =>
            tx.type === 'credit' && String(tx.description || '').toLowerCase().includes('card payment')
        ).map((tx: any) => {
            const description = String(tx.description || '');
            const lower = description.toLowerCase();
            const category = lower.includes('restaurant')
                ? 'Restaurant Income'
                : lower.includes('front desk')
                    ? 'Room Income'
                    : lower.includes('event')
                        ? 'Event Income'
                        : 'Service Income';
            const source = lower.includes('restaurant')
                ? 'Restaurant Card'
                : lower.includes('front desk')
                    ? 'Front Desk Card'
                    : lower.includes('event')
                        ? 'Event Card'
                        : 'Services Card';
            return {
                id: `card-${tx.id}`,
                type: 'income' as const,
                description,
                amount: Number(tx.amount || 0),
                category,
                date: tx.date,
                source,
                meta: `${tx.reference || 'Card payment'} · ${tx.account?.name || 'Account'}`,
                department: assignDepartment(category, source),
            };
        });

        const serviceIncomes = (serviceIncomesRes.data || []).filter((r: any) => r.payment_method !== 'card' && !guestBillSourceIds.has(String(r.id))).map((r: any) => {
            const source = r.service_type ? r.service_type.replace(/_/g, ' ') : 'Service';
            return {
                id: r.id, type: 'income' as const,
                description: r.description || r.service_type, amount: Number(r.amount),
                category: 'Service Income', date: r.date, source,
                meta: r.customer_name,
                department: assignDepartment('Service Income', source),
            };
        });

        const reservationIncomes = (reservationsRes.data || []).filter((r: any) => r.payment_method !== 'card' && !guestBillSourceIds.has(String(r.id))).map((r: any) => ({
            id: r.id, type: 'income' as const,
            description: `Room: ${r.guest_name || 'Guest'}`, amount: Number(r.total_cost || 0),
            category: 'Room Income', date: r.check_out_date || new Date().toISOString().split('T')[0],
            source: 'Reservations', meta: r.guest_name,
            department: 'Rooms',
        }));

        const orderIncomes = (ordersRes.data || []).filter((r: any) => r.payment_method !== 'card' && !guestBillSourceIds.has(String(r.id))).map((r: any) => ({
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

        // Inventory loss — valued damage/expired write-offs.
        let inventoryLossExpenses: any[] = [];
        try {
            const { data: lossData } = await supabase
                .from('inventory_transactions')
                .select(`
                    id, transaction_type, quantity, total_loss_value, unit_value, action_at,
                    item:inventory_items(name, category:inventory_categories(name)),
                    reporter:users!inventory_transactions_created_by_fkey(name)
                `)
                .in('transaction_type', ['damage', 'expired'])
                .eq('action_taken', 'written_off')
                .not('total_loss_value', 'is', null);

            inventoryLossExpenses = (lossData || []).map((r: any) => {
                const dateStr = (r.action_at || '').split('T')[0];
                if (!dateStr) return null;
                if (from && dateStr < from) return null;
                if (to && dateStr > to) return null;
                const amount = Number(r.total_loss_value || 0);
                if (amount <= 0) return null;
                const itemName = r.item?.name ?? 'Item';
                const typeLbl = r.transaction_type === 'expired' ? 'Expired' : 'Damaged';
                return {
                    id: `loss-${r.id}`,
                    type: 'expense' as const,
                    description: `${typeLbl}: ${itemName} (${r.quantity} units)`,
                    amount,
                    category: 'Inventory Loss',
                    date: dateStr,
                    source: 'Inventory',
                    department: 'Inventory',
                    meta: `By ${r.reporter?.name ?? 'staff'} · LKR ${(r.unit_value ?? 0).toLocaleString()}/unit`,
                };
            }).filter(Boolean);
        } catch (_) {
            // Column not yet migrated — skip silently
        }

        const allIncomes = [...cardPaymentIncomes, ...frontDeskIncomes, ...eventIncomes, ...otherIncomes, ...serviceIncomes, ...reservationIncomes, ...orderIncomes];
        const allExpenses = [...generalExpenses, ...payrollExpenses, ...dailyWageExpenses, ...inventoryCogs, ...cashPurchaseExpenses, ...inventoryLossExpenses];

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
            summary: { totalIncome, totalEarnings: totalIncome, totalExpenses, netPL },
            incomeByCategory,
            expenseByCategory,
            departmentPL,
            incomes: allIncomes,
            expenses: allExpenses,
            accountTransactions: accountTransactionsRes.data || [],
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
