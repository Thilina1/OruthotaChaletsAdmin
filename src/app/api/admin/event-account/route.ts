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
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const [paymentResult, transferResult, accountResult, settingResult] = await Promise.all([
      supabase.from('event_payments').select('id,receipt_number,payer_name,amount,payment_method,payment_type,paid_at,reference,account_transaction_id,event:events(name),account:accounts(name)').order('paid_at', { ascending: false }).limit(500),
      supabase.from('event_cash_transfers').select('id,amount,notes,created_at,account:accounts(id,name,type),user:users(name)').order('created_at', { ascending: false }).limit(200),
      supabase.from('accounts').select('id,name,type,current_balance').eq('is_active', true).order('name'),
      supabase.from('event_account_settings').select('card_account_id').eq('singleton', true).maybeSingle(),
    ]);
    if (paymentResult.error) throw paymentResult.error;
    if (transferResult.error) throw transferResult.error;
    if (accountResult.error) throw accountResult.error;
    if (settingResult.error) throw settingResult.error;
    const payments = paymentResult.data || [];
    const net = (row: any) => row.payment_type === 'refund' ? -Number(row.amount) : Number(row.amount);
    const cash = payments.filter((row: any) => row.payment_method === 'cash' && !row.account_transaction_id);
    const card = payments.filter((row: any) => row.payment_method === 'card');
    const transfers = transferResult.data || [];
    const cashTotal = cash.reduce((sum, row) => sum + net(row), 0);
    const moved = transfers.reduce((sum, row) => sum + Number(row.amount), 0);
    const byEvent = payments.reduce((map: Record<string, { cash: number; card: number; total: number }>, row: any) => {
      const name = (row.event as any)?.name || 'Event';
      map[name] ||= { cash: 0, card: 0, total: 0 };
      const value = net(row);
      if (row.payment_method === 'cash') map[name].cash += value;
      if (row.payment_method === 'card') map[name].card += value;
      map[name].total += value;
      return map;
    }, {});
    return NextResponse.json({
      summary: { cash_total: cashTotal, available_cash: cashTotal - moved, transferred_cash: moved, card_total: card.reduce((sum, row) => sum + net(row), 0), cash_count: cash.length, card_count: card.length },
      by_service: Object.fromEntries(Object.entries(byEvent).map(([name, values]) => [name, values.total])),
      by_section: byEvent, transactions: payments, transfers, accounts: accountResult.data || [], settings: settingResult.data || { card_account_id: null },
    });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const user = await auth() as any;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { account_id, amount, notes } = await request.json(); const value = Number(amount);
    if (!account_id || value <= 0) return NextResponse.json({ error: 'Valid account and amount required' }, { status: 400 });
    const { data, error } = await supabase.rpc('transfer_event_cash', { p_account_id: account_id, p_amount: value, p_notes: notes || '', p_user_id: user.userId });
    if (error) throw error;
    return NextResponse.json({ transfer_id: data }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function PUT(request: Request) {
  try {
    const user = await auth() as any;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { card_account_id } = await request.json();
    const { data } = await supabase.from('accounts').select('id').eq('id', card_account_id).eq('is_active', true).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Active account not found' }, { status: 404 });
    const { error } = await supabase.from('event_account_settings').upsert({ singleton: true, card_account_id, updated_by: user.userId, updated_at: new Date().toISOString() }, { onConflict: 'singleton' });
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
