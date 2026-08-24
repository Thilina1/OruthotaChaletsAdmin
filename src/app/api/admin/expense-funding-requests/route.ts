import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

async function currentUser() {
  const token = (await cookies()).get('auth_token')?.value;
  return token ? verifyToken(token) : null;
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const month = searchParams.get('month');
  const expenseId = searchParams.get('expenseId');
  let query = supabase.from('other_expense_cash_requests').select(`
    *, requester:users!requested_by(name), issuer:users!last_issued_by(name),
    issues:other_expense_cash_issues(id, amount, created_at, account:accounts(id, name)),
    items:other_expense_cash_request_items(id, expense_id, amount)
  `).order('created_at', { ascending: false });

  if (expenseId) query = query.eq('expense_id', expenseId);
  else if (date) query = query.eq('expense_date', date);
  else if (month && /^\d{4}-\d{2}$/.test(month)) {
    const monthStart = `${month}-01`;
    const nextMonth = new Date(`${monthStart}T00:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    query = query.gte('expense_date', monthStart).lt('expense_date', nextMonth.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    requests: (data || []).map(item => ({
      ...item,
      amount_to_issue: Math.max(0, Number(item.requested_amount || 0) - Number(item.issued_amount || 0)),
    })),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { expense_id, expense_ids } = await request.json();
  const expenseIds = Array.isArray(expense_ids) ? expense_ids : expense_id ? [expense_id] : [];
  if (!expenseIds.length) return NextResponse.json({ error: 'At least one expense is required.' }, { status: 400 });

  const { data: requestId, error } = await supabase.rpc('create_other_expense_cash_request', {
    p_expense_ids: expenseIds,
    p_requested_by: user.userId,
  });
  if (error) {
    if (error.code === '23505' || error.message.includes('already been requested')) {
      return NextResponse.json({ error: 'Funds have already been requested for one or more selected expenses.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { data, error: selectError } = await supabase.from('other_expense_cash_requests')
    .select('*, items:other_expense_cash_request_items(expense_id, amount)').eq('id', requestId).single();
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 });
  return NextResponse.json({ request: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user || !['admin', 'payment'].includes(user.role)) {
    return NextResponse.json({ error: 'Accounts access required.' }, { status: 403 });
  }
  const { request_id, account_id, amount } = await request.json();
  const issueAmount = Number(amount);
  if (!request_id || !account_id || !Number.isFinite(issueAmount) || issueAmount <= 0) {
    return NextResponse.json({ error: 'Request, account, and a valid amount are required.' }, { status: 400 });
  }
  const { error } = await supabase.rpc('issue_other_expense_cash', {
    p_request_id: request_id,
    p_account_id: account_id,
    p_amount: issueAmount,
    p_issued_by: user.userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ success: true });
}
