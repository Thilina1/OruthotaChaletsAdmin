import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!);
async function auth() { const token = (await cookies()).get('auth_token')?.value; return token ? verifyToken(token) : null; }

export async function GET(request: Request) {
  try {
    const user = await auth() as any;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const eventId = searchParams.get('event_id');
    const selectedEventId = eventId && eventId !== '__none__' ? eventId : null;
    let paymentQuery = supabase.from('event_payments').select('id,event_id,receipt_number,payer_name,amount,payment_method,payment_type,paid_at,reference,account_transaction_id,event:events(name),account:accounts(name)').order('paid_at', { ascending: false }).limit(500);
    let transferQuery = supabase.from('event_cash_transfers').select('id,amount,notes,created_at,account:accounts(id,name,type),user:users(name)').order('created_at', { ascending: false }).limit(200);
    if (from) {
      paymentQuery = paymentQuery.gte('paid_at', `${from}T00:00:00`);
      transferQuery = transferQuery.gte('created_at', `${from}T00:00:00`);
    }
    if (to) {
      paymentQuery = paymentQuery.lte('paid_at', `${to}T23:59:59.999`);
      transferQuery = transferQuery.lte('created_at', `${to}T23:59:59.999`);
    }
    const selectedBudgetQuery = selectedEventId
      ? supabase.from('event_budget_items').select('budget_type,actual_amount').eq('event_id', selectedEventId)
      : supabase.from('event_budget_items').select('budget_type,actual_amount').eq('event_id', '00000000-0000-0000-0000-000000000000');
    const [paymentResult, transferResult, accountResult, settingResult, eventResult, selectedBudgetResult] = await Promise.all([
      paymentQuery,
      transferQuery,
      supabase.from('accounts').select('id,name,type,current_balance').eq('is_active', true).order('name'),
      supabase.from('event_account_settings').select('card_account_id').eq('singleton', true).maybeSingle(),
      supabase.from('events').select('id,name,starts_at,status').order('starts_at', { ascending: false }).limit(300),
      selectedBudgetQuery,
    ]);
    if (paymentResult.error) throw paymentResult.error;
    if (transferResult.error) throw transferResult.error;
    if (accountResult.error) throw accountResult.error;
    if (settingResult.error) throw settingResult.error;
    if (eventResult.error) throw eventResult.error;
    if (selectedBudgetResult.error) throw selectedBudgetResult.error;
    const payments = paymentResult.data || [];
    const net = (row: any) => row.payment_type === 'refund' ? -Number(row.amount) : Number(row.amount);
    const cash = payments.filter((row: any) => row.payment_method === 'cash' && !row.account_transaction_id);
    const card = payments.filter((row: any) => row.payment_method === 'card');
    const transfers = transferResult.data || [];
    const cashTotal = cash.reduce((sum, row) => sum + net(row), 0);
    const cardTotal = card.reduce((sum, row) => sum + net(row), 0);
    const moved = transfers.reduce((sum, row) => sum + Number(row.amount), 0);
    const selectedEventPayments = selectedEventId ? payments.filter((row: any) => row.event_id === selectedEventId) : [];
    const selectedEventCash = selectedEventPayments.filter((row: any) => row.payment_method === 'cash' && !row.account_transaction_id).reduce((sum, row) => sum + net(row), 0);
    const selectedEventCard = selectedEventPayments.filter((row: any) => row.payment_method === 'card').reduce((sum, row) => sum + net(row), 0);
    const selectedEventTotalCost = (selectedBudgetResult.data || []).filter((row: any) => row.budget_type === 'expense').reduce((sum, row: any) => sum + Number(row.actual_amount), 0);
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
      summary: { total_income: cashTotal + cardTotal, cash_total: cashTotal, available_cash: cashTotal - moved, transferred_cash: moved, card_total: cardTotal, cash_count: cash.length, card_count: card.length },
      by_service: Object.fromEntries(Object.entries(byEvent).map(([name, values]) => [name, values.total])),
      by_section: byEvent, transactions: payments, selected_event: selectedEventId ? { id: selectedEventId, payments: selectedEventPayments, cash_total: selectedEventCash, card_total: selectedEventCard, total_income: selectedEventCash + selectedEventCard, paid_amount: selectedEventCash + selectedEventCard, total_cost: selectedEventTotalCost, balance_due: selectedEventTotalCost - (selectedEventCash + selectedEventCard), count: selectedEventPayments.length } : null, transfers, accounts: accountResult.data || [], events: eventResult.data || [], selected_event_id: selectedEventId, settings: settingResult.data || { card_account_id: null },
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
