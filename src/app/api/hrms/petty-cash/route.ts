import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const JOIN = `
  *,
  employee:users!petty_cash_requests_employee_id_fkey(id, name, job_title, department),
  manager:users!petty_cash_requests_manager_id_fkey(id, name),
  account_actioned_by_user:users!petty_cash_requests_account_actioned_by_fkey(id, name),
  issued_by_user:users!petty_cash_requests_issued_by_fkey(id, name)
`.trim();

async function getCurrentUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    return token ? verifyToken(token) : null;
}

export async function GET(request: Request) {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view'); // mine | manager | accounts

    try {
        let query = supabase.from('petty_cash_requests').select(JOIN).order('created_at', { ascending: false });

        if (view === 'mine') {
            query = query.eq('employee_id', user.userId);
        } else if (view === 'manager') {
            query = query.eq('manager_id', user.userId).eq('status', 'pending_manager');
        }
        // accounts / admin: no filter → all

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ requests: data ?? [] });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { amount, reason } = body;

        // Resolve the employee's reporting manager
        const { data: emp } = await supabase
            .from('users')
            .select('reporting_manager_id')
            .eq('id', user.userId)
            .single();

        const managerId = emp?.reporting_manager_id ?? null;
        const status = managerId ? 'pending_manager' : 'pending_accounts';

        const { data, error } = await supabase
            .from('petty_cash_requests')
            .insert([{
                employee_id: user.userId,
                amount,
                reason,
                status,
                manager_id: managerId,
                manager_status: managerId ? 'pending' : null,
            }])
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ request: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, action, remarks, document_url, settlement_notes, balance_amount } = body;

        if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 });

        const { data: req, error: fetchErr } = await supabase
            .from('petty_cash_requests')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchErr || !req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

        let updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        switch (action) {
            case 'manager_approve':
                updates = {
                    ...updates,
                    manager_status: 'approved',
                    manager_remarks: remarks ?? null,
                    manager_actioned_at: new Date().toISOString(),
                    status: 'pending_accounts',
                    account_status: 'pending',
                };
                break;

            case 'manager_reject':
                updates = {
                    ...updates,
                    manager_status: 'rejected',
                    manager_remarks: remarks ?? null,
                    manager_actioned_at: new Date().toISOString(),
                    status: 'rejected',
                };
                break;

            case 'accounts_approve':
                updates = {
                    ...updates,
                    account_status: 'approved',
                    account_remarks: remarks ?? null,
                    account_actioned_at: new Date().toISOString(),
                    account_actioned_by: user.userId,
                    status: 'approved',
                };
                break;

            case 'accounts_reject':
                updates = {
                    ...updates,
                    account_status: 'rejected',
                    account_remarks: remarks ?? null,
                    account_actioned_at: new Date().toISOString(),
                    account_actioned_by: user.userId,
                    status: 'rejected',
                };
                break;

            case 'issue': {
                // Check daily limits before issuing
                const today = new Date().toISOString().split('T')[0];
                const { data: settings } = await supabase.from('petty_cash_settings').select('*').single();
                const { data: todayIssued } = await supabase
                    .from('petty_cash_requests')
                    .select('amount')
                    .eq('request_date', today)
                    .in('status', ['issued', 'settled']);

                const issuedToday = todayIssued ?? [];
                const totalIssued = issuedToday.reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
                const smallIssued = issuedToday
                    .filter((r: { amount: number }) => Number(r.amount) <= (settings?.small_request_threshold ?? 50000))
                    .reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
                const largeIssued = issuedToday
                    .filter((r: { amount: number }) => Number(r.amount) > (settings?.small_request_threshold ?? 50000))
                    .reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);

                const amt = Number(req.amount);
                const isSmall = amt <= (settings?.small_request_threshold ?? 50000);

                if (totalIssued + amt > (settings?.daily_total_limit ?? 200000))
                    return NextResponse.json({ error: `Daily total limit of Rs ${(settings?.daily_total_limit ?? 200000).toLocaleString()} exceeded` }, { status: 422 });
                if (isSmall && smallIssued + amt > (settings?.small_pool_limit ?? 50000))
                    return NextResponse.json({ error: `Small requests pool limit of Rs ${(settings?.small_pool_limit ?? 50000).toLocaleString()} exceeded for today` }, { status: 422 });
                if (!isSmall && largeIssued + amt > (settings?.large_pool_limit ?? 150000))
                    return NextResponse.json({ error: `Large requests pool limit of Rs ${(settings?.large_pool_limit ?? 150000).toLocaleString()} exceeded for today` }, { status: 422 });

                updates = {
                    ...updates,
                    issued_at: new Date().toISOString(),
                    issued_by: user.userId,
                    status: 'issued',
                };
                break;
            }

            case 'settle': {
                const { amount_spent } = body;
                if (amount_spent === undefined || amount_spent === null)
                    return NextResponse.json({ error: 'amount_spent is required for settlement' }, { status: 400 });

                const spent = Number(amount_spent);
                const issued = Number(req.amount);
                const diff = issued - spent; // positive = employee must return, negative = employee needs more

                let balance_status: string | null = null;
                if (Math.abs(diff) > 0.009) { // ignore tiny rounding differences
                    balance_status = diff > 0 ? 'return_pending' : 'additional_pending';
                }

                updates = {
                    ...updates,
                    amount_spent: spent,
                    document_url: document_url ?? null,
                    settlement_notes: settlement_notes ?? null,
                    settled_at: new Date().toISOString(),
                    status: 'settled',
                    balance_status,
                };
                break;
            }

            case 'confirm_return': {
                const expectedReturn = Number(req.amount) - Number(req.amount_spent);
                const actualReturn = balance_amount != null ? Number(balance_amount) : expectedReturn;
                updates = {
                    ...updates,
                    balance_status: 'returned',
                    balance_amount: actualReturn,
                    balance_actioned_at: new Date().toISOString(),
                    balance_actioned_by: user.userId,
                };
                break;
            }

            case 'issue_additional': {
                // Issue the extra amount the employee spent beyond what was issued
                const additionalAmt = Number(req.amount_spent) - Number(req.amount);
                if (additionalAmt <= 0)
                    return NextResponse.json({ error: 'No additional amount required' }, { status: 422 });

                // Check daily limits for the additional amount
                const today2 = new Date().toISOString().split('T')[0];
                const { data: settings2 } = await supabase.from('petty_cash_settings').select('*').single();
                const { data: todayIssued2 } = await supabase
                    .from('petty_cash_requests')
                    .select('amount')
                    .eq('request_date', today2)
                    .in('status', ['issued', 'settled']);

                const issuedToday2 = todayIssued2 ?? [];
                const totalIssued2 = issuedToday2.reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
                const isSmall2 = additionalAmt <= (settings2?.small_request_threshold ?? 50000);
                const smallIssued2 = issuedToday2.filter((r: { amount: number }) => Number(r.amount) <= (settings2?.small_request_threshold ?? 50000)).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
                const largeIssued2 = issuedToday2.filter((r: { amount: number }) => Number(r.amount) > (settings2?.small_request_threshold ?? 50000)).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);

                if (totalIssued2 + additionalAmt > (settings2?.daily_total_limit ?? 200000))
                    return NextResponse.json({ error: `Daily total limit exceeded for additional issuance` }, { status: 422 });
                if (isSmall2 && smallIssued2 + additionalAmt > (settings2?.small_pool_limit ?? 50000))
                    return NextResponse.json({ error: `Small pool limit exceeded for additional issuance` }, { status: 422 });
                if (!isSmall2 && largeIssued2 + additionalAmt > (settings2?.large_pool_limit ?? 150000))
                    return NextResponse.json({ error: `Large pool limit exceeded for additional issuance` }, { status: 422 });

                const actualAdditional = balance_amount != null ? Number(balance_amount) : additionalAmt;
                updates = {
                    ...updates,
                    balance_status: 'additional_issued',
                    balance_amount: actualAdditional,
                    balance_actioned_at: new Date().toISOString(),
                    balance_actioned_by: user.userId,
                };
                break;
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('petty_cash_requests')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ request: data });
    } catch (error) {
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}
