import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
async function auth() { const token = (await cookies()).get('auth_token')?.value; return token ? verifyToken(token) : null; }

export async function GET() {
  try {
    const user = await auth() as any;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'payment'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const [ordersResult, cardOrdersResult, transfersResult, accountsResult, settingsResult] = await Promise.all([
      supabase.from('orders').select('id,confirmed_total,total_price,paid_at').eq('status', 'closed').eq('payment_method', 'cash').order('paid_at', { ascending: false }),
      supabase.from('orders').select('id,confirmed_total,total_price,paid_at,card_account_transaction_id').eq('status', 'closed').eq('payment_method', 'card').order('paid_at', { ascending: false }),
      supabase.from('restaurant_cash_transfers').select('id,amount,notes,created_at,account:accounts(id,name,type),user:users(name)').order('created_at', { ascending: false }).limit(200),
      supabase.from('accounts').select('id,name,type,current_balance').eq('is_active', true).order('name'),
      supabase.from('restaurant_account_settings').select('card_account_id').eq('singleton', true).maybeSingle(),
    ]);
    if (ordersResult.error) throw ordersResult.error; if (cardOrdersResult.error) throw cardOrdersResult.error; if (transfersResult.error) throw transfersResult.error; if (accountsResult.error) throw accountsResult.error; if (settingsResult.error) throw settingsResult.error;
    const cashOrders = ordersResult.data || []; const transfers = transfersResult.data || [];
    const grossCash = cashOrders.reduce((sum, row) => sum + Number(row.confirmed_total || row.total_price || 0), 0);
    const transferredCash = transfers.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const colomboDate = (value: Date | string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
    const today = colomboDate(new Date());
    const todayCash = cashOrders.filter(row => row.paid_at && colomboDate(row.paid_at) === today).reduce((sum, row) => sum + Number(row.confirmed_total || row.total_price || 0), 0);
    const cardOrders = cardOrdersResult.data || [];
    const cardTotal = cardOrders.reduce((sum, row) => sum + Number(row.confirmed_total || row.total_price || 0), 0);
    return NextResponse.json({ summary: { gross_cash: grossCash, transferred_cash: transferredCash, available_cash: grossCash - transferredCash, today_cash: todayCash, cash_bill_count: cashOrders.length, card_total: cardTotal, card_bill_count: cardOrders.length }, transfers, accounts: accountsResult.data || [], settings: settingsResult.data || { card_account_id: null } });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const user = await auth() as any; if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'payment'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { card_account_id } = await request.json();
    if (!card_account_id) return NextResponse.json({ error: 'Select a Card Payment Account.' }, { status: 400 });
    const { data: account } = await supabase.from('accounts').select('id').eq('id', card_account_id).eq('is_active', true).maybeSingle();
    if (!account) return NextResponse.json({ error: 'Active account not found.' }, { status: 404 });
    const { error } = await supabase.from('restaurant_account_settings').upsert({ singleton: true, card_account_id, updated_by: user.userId, updated_at: new Date().toISOString() }, { onConflict: 'singleton' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const user = await auth() as any; if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'payment'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { account_id, amount, notes } = await request.json(); const numericAmount = Number(amount);
    if (!account_id || !Number.isFinite(numericAmount) || numericAmount <= 0) return NextResponse.json({ error: 'A destination account and valid amount are required.' }, { status: 400 });
    const { data, error } = await supabase.rpc('transfer_restaurant_cash', { p_account_id: account_id, p_amount: numericAmount, p_notes: notes || '', p_user_id: user.userId });
    if (error) throw error; return NextResponse.json({ transfer_id: data }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
