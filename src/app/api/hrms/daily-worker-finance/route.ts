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

  const date = new URL(request.url).searchParams.get('date');
  let requestsQuery = supabase.from('daily_worker_cash_requests').select(`
    *, requester:users!requested_by(name), issuer:users!last_issued_by(name),
    issues:daily_worker_cash_issues(id, amount, created_at, account:accounts(id, name), issued_by_user:users!issued_by(name))
  `).order('created_at', { ascending: false });
  let paymentsQuery = supabase.from('daily_payments').select('date, amount, is_paid');
  if (date) {
    requestsQuery = requestsQuery.eq('work_date', date);
    paymentsQuery = paymentsQuery.eq('date', date);
  }

  const [requestsResult, paymentsResult, accountsResult] = await Promise.all([
    requestsQuery,
    paymentsQuery,
    supabase.from('accounts').select('id, name, type, current_balance').eq('is_active', true).order('name'),
  ]);
  const error = requestsResult.error || paymentsResult.error || accountsResult.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const requests = (requestsResult.data || []).map(request => {
    const spent = (paymentsResult.data || [])
      .filter(payment => payment.date === request.work_date && payment.is_paid)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const issued = Number(request.issued_amount || 0);
    const requested = Number(request.requested_amount || 0);
    return {
      ...request,
      spent_amount: spent,
      amount_to_issue: Math.max(0, requested - issued),
      balance: issued - spent,
    };
  });

  const summary = requests.reduce((totals, request) => ({
    requested: totals.requested + Number(request.requested_amount || 0),
    issued: totals.issued + Number(request.issued_amount || 0),
    to_issue: totals.to_issue + Number(request.amount_to_issue || 0),
    spent: totals.spent + Number(request.spent_amount || 0),
    balance: totals.balance + Number(request.balance || 0),
  }), { requested: 0, issued: 0, to_issue: 0, spent: 0, balance: 0 });

  return NextResponse.json({ requests, accounts: accountsResult.data || [], summary });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { work_date, purpose, requested_amount } = await request.json();
  const amount = Number(requested_amount);
  if (!work_date || !purpose?.trim() || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Work date, purpose, and a valid amount are required.' }, { status: 400 });
  }
  const requestNumber = `DWC-${work_date.replaceAll('-', '')}-${Date.now().toString().slice(-6)}`;
  const { data, error } = await supabase.from('daily_worker_cash_requests').insert({
    request_number: requestNumber, work_date, purpose: purpose.trim(), requested_amount: amount, requested_by: user.userId,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
    return NextResponse.json({ error: 'Request, account, and a valid issue amount are required.' }, { status: 400 });
  }
  const { error } = await supabase.rpc('issue_daily_worker_cash', {
    p_request_id: request_id, p_account_id: account_id, p_amount: issueAmount, p_issued_by: user.userId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ success: true });
}
