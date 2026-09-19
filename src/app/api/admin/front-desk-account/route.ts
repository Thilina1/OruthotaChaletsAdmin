import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
);

async function auth() {
  const token = (await cookies()).get('auth_token')?.value;
  return token ? verifyToken(token) : null;
}

const colomboDate = (value: Date | string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));

export async function GET(request: Request) {
  try {
    const user = await auth() as any;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'payment'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    let billsQuery = supabase.from('guest_bill_history').select('id,bill_number,total,payment_method,paid_at,account_transaction_id,customer:customers(name)').order('paid_at', { ascending: false });
    let transfersQuery = supabase.from('front_desk_cash_transfers').select('id,amount,notes,created_at,account:accounts(id,name,type),user:users(name)').order('created_at', { ascending: false }).limit(200);
    if (from) {
      billsQuery = billsQuery.gte('paid_at', `${from}T00:00:00`);
      transfersQuery = transfersQuery.gte('created_at', `${from}T00:00:00`);
    }
    if (to) {
      billsQuery = billsQuery.lte('paid_at', `${to}T23:59:59.999`);
      transfersQuery = transfersQuery.lte('created_at', `${to}T23:59:59.999`);
    }

    const [billsResult, transfersResult, accountsResult, settingsResult] = await Promise.all([
      billsQuery,
      transfersQuery,
      supabase.from('accounts').select('id,name,type,current_balance').eq('is_active', true).order('name'),
      supabase.from('front_desk_account_settings').select('card_account_id').eq('singleton', true).maybeSingle(),
    ]);

    const firstError = [billsResult.error, transfersResult.error, accountsResult.error, settingsResult.error].find(Boolean);
    if (firstError) throw firstError;

    const bills = billsResult.data || [];
    const cashBills = bills.filter((bill: any) => bill.payment_method === 'cash');
    const cardBills = bills.filter((bill: any) => bill.payment_method === 'card');
    const transfers = transfersResult.data || [];
    const cashTotal = cashBills.reduce((sum: number, bill: any) => sum + Number(bill.total || 0), 0);
    const transferredCash = transfers.reduce((sum: number, transfer: any) => sum + Number(transfer.amount || 0), 0);
    const today = colomboDate(new Date());
    const todayCash = cashBills
      .filter((bill: any) => bill.paid_at && colomboDate(bill.paid_at) === today)
      .reduce((sum: number, bill: any) => sum + Number(bill.total || 0), 0);

    return NextResponse.json({
      summary: {
        cash_total: cashTotal,
        available_cash: cashTotal - transferredCash,
        transferred_cash: transferredCash,
        card_total: cardBills.reduce((sum: number, bill: any) => sum + Number(bill.total || 0), 0),
        today_cash: todayCash,
        cash_count: cashBills.length,
        card_count: cardBills.length,
      },
      transactions: bills.map((bill: any) => ({
        id: bill.id,
        paid_at: bill.paid_at,
        receipt_number: bill.bill_number,
        payer_name: bill.customer?.name || 'Guest',
        payment_method: bill.payment_method,
        payment_type: 'payment',
        amount: Number(bill.total || 0),
        account_transaction_id: bill.account_transaction_id,
        account: null,
        event: { name: 'Guest Bill' },
      })),
      transfers,
      accounts: accountsResult.data || [],
      settings: settingsResult.data || { card_account_id: null },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await auth() as any;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'payment'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { card_account_id } = await request.json();
    if (!card_account_id) return NextResponse.json({ error: 'Select a Card Payment Account.' }, { status: 400 });

    const { data: account } = await supabase.from('accounts').select('id').eq('id', card_account_id).eq('is_active', true).maybeSingle();
    if (!account) return NextResponse.json({ error: 'Active account not found.' }, { status: 404 });

    const { error } = await supabase
      .from('front_desk_account_settings')
      .upsert({ singleton: true, card_account_id, updated_by: user.userId, updated_at: new Date().toISOString() }, { onConflict: 'singleton' });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await auth() as any;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'payment'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { account_id, amount, notes } = await request.json();
    const numericAmount = Number(amount);
    if (!account_id || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'A destination account and valid amount are required.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('transfer_front_desk_cash', {
      p_account_id: account_id,
      p_amount: numericAmount,
      p_notes: notes || '',
      p_user_id: user.userId,
    });
    if (error) throw error;

    return NextResponse.json({ transfer_id: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
