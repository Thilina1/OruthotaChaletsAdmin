import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApiUser, hasApiPathAccess } from '@/lib/api-auth';
// Uses the USD to LKR rate locked on the booking (else the current rate).
import { chaletExchangeRate } from '@/lib/chalet-billing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
);

const PAGE_PATH = '/dashboard/front-desk-account';
const canAccess = (user: NonNullable<Awaited<ReturnType<typeof getApiUser>>>) =>
  hasApiPathAccess(user, PAGE_PATH, ['payment']);

const colomboDate = (value: Date | string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));

function customerBillCurrency(nationality?: string | null): 'LKR' | 'USD' {
  return nationality === 'Non Sri Lankan' ? 'USD' : 'LKR';
}

function chaletPaidAmountInLkr(booking: any, rates: any[] = []) {
  const amount = Number(booking.payhere_amount || booking.payment_required_amount || booking.amount_paid || 0);
  const currency = String(booking.payhere_currency || booking.currency || customerBillCurrency(booking.nationality)).toUpperCase();
  const exchangeRate = chaletExchangeRate(booking, rates);
  return currency === 'USD' && exchangeRate > 0 ? amount * exchangeRate : amount;
}

export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    let billsQuery = supabase.from('guest_bill_history').select('id,bill_number,total,payment_method,paid_at,account_transaction_id,customer:customers(name)').order('paid_at', { ascending: false });
    let onlineBookingsQuery = supabase
      .from('chalet_bookings')
      .select('*')
      .eq('payment_status', 'paid')
      .order('payhere_received_at', { ascending: false, nullsFirst: false });
    let bookingPaymentsQuery = supabase
      .from('chalet_booking_payments')
      .select('id,booking_id,booking_ref,customer_name,amount,payment_method,paid_at,account_transaction_id,account:accounts(id,name,type)')
      .order('paid_at', { ascending: false });
    let transfersQuery = supabase.from('front_desk_cash_transfers').select('id,amount,notes,created_at,account:accounts(id,name,type),user:users(name)').order('created_at', { ascending: false }).limit(200);
    if (from) {
      billsQuery = billsQuery.gte('paid_at', `${from}T00:00:00`);
      onlineBookingsQuery = onlineBookingsQuery.gte('payhere_received_at', `${from}T00:00:00`);
      bookingPaymentsQuery = bookingPaymentsQuery.gte('paid_at', `${from}T00:00:00`);
      transfersQuery = transfersQuery.gte('created_at', `${from}T00:00:00`);
    }
    if (to) {
      billsQuery = billsQuery.lte('paid_at', `${to}T23:59:59.999`);
      onlineBookingsQuery = onlineBookingsQuery.lte('payhere_received_at', `${to}T23:59:59.999`);
      bookingPaymentsQuery = bookingPaymentsQuery.lte('paid_at', `${to}T23:59:59.999`);
      transfersQuery = transfersQuery.lte('created_at', `${to}T23:59:59.999`);
    }

    const [billsResult, onlineBookingsResult, ratesResult, transfersResult, accountsResult, settingsResult, bookingPaymentsResult, recordedOnlineResult] = await Promise.all([
      billsQuery,
      onlineBookingsQuery,
      supabase.from('chalet_rates').select('package_id,room_category_id,occupancy_type_id,usd_to_lkr_rate'),
      transfersQuery,
      supabase.from('accounts').select('id,name,type,current_balance').eq('is_active', true).order('name'),
      supabase.from('front_desk_account_settings').select('card_account_id,online_account_id').eq('singleton', true).maybeSingle(),
      bookingPaymentsQuery,
      supabase.from('chalet_booking_payments').select('booking_id').eq('payment_method', 'online'),
    ]);

    const firstError = [billsResult.error, ratesResult.error, transfersResult.error, accountsResult.error].find(Boolean);
    if (firstError) throw firstError;
    const settings = settingsResult.error
      ? (await supabase.from('front_desk_account_settings').select('card_account_id').eq('singleton', true).maybeSingle()).data
      : settingsResult.data;

    const bills = billsResult.data || [];
    // Payments taken in the chalet booking form (tolerates the table not
    // existing yet before its migration is applied).
    const bookingPayments = bookingPaymentsResult.error ? [] : bookingPaymentsResult.data || [];
    const recordedOnlineBookingIds = new Set((recordedOnlineResult.error ? [] : recordedOnlineResult.data || []).map((row: any) => row.booking_id).filter(Boolean));
    const cashBookingPayments = bookingPayments.filter((payment: any) => payment.payment_method === 'cash');
    const cardBookingPayments = bookingPayments.filter((payment: any) => payment.payment_method === 'card');
    const onlineBookingPayments = bookingPayments.filter((payment: any) => payment.payment_method === 'online');
    const cashBills = bills.filter((bill: any) => bill.payment_method === 'cash');
    const cardBills = bills.filter((bill: any) => bill.payment_method === 'card');
    const onlineBillHistory = bills.filter((bill: any) => bill.payment_method === 'online');
    const onlineBookingBills = (onlineBookingsResult.error ? [] : onlineBookingsResult.data || [])
      .filter((booking: any) =>
        booking.payment_gateway === 'payhere' ||
        booking.payhere_payment_id ||
        booking.payhere_amount ||
        // Older bookings marked online before payments were recorded per booking.
        (booking.payment_method === 'online' && !recordedOnlineBookingIds.has(booking.id))
      );
    const sumAmount = (rows: any[]) => rows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    const transfers = transfersResult.data || [];
    const cashTotal = cashBills.reduce((sum: number, bill: any) => sum + Number(bill.total || 0), 0) + sumAmount(cashBookingPayments);
    const transferredCash = transfers.reduce((sum: number, transfer: any) => sum + Number(transfer.amount || 0), 0);
    const today = colomboDate(new Date());
    const todayCash = cashBills
      .filter((bill: any) => bill.paid_at && colomboDate(bill.paid_at) === today)
      .reduce((sum: number, bill: any) => sum + Number(bill.total || 0), 0)
      + sumAmount(cashBookingPayments.filter((payment: any) => payment.paid_at && colomboDate(payment.paid_at) === today));

    return NextResponse.json({
      summary: {
        cash_total: cashTotal,
        available_cash: cashTotal - transferredCash,
        transferred_cash: transferredCash,
        card_total: cardBills.reduce((sum: number, bill: any) => sum + Number(bill.total || 0), 0) + sumAmount(cardBookingPayments),
        online_total: onlineBillHistory.reduce((sum: number, bill: any) => sum + Number(bill.total || 0), 0)
          + onlineBookingBills.reduce((sum: number, booking: any) => sum + chaletPaidAmountInLkr(booking, ratesResult.data || []), 0)
          + sumAmount(onlineBookingPayments),
        today_cash: todayCash,
        cash_count: cashBills.length + cashBookingPayments.length,
        card_count: cardBills.length + cardBookingPayments.length,
        online_count: onlineBillHistory.length + onlineBookingBills.length + onlineBookingPayments.length,
      },
      transactions: [
        ...bills.map((bill: any) => ({
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
        ...onlineBookingBills.map((booking: any) => ({
          id: booking.id,
          paid_at: booking.payhere_received_at,
          receipt_number: booking.booking_ref,
          payer_name: booking.customer_name || 'Guest',
          payment_method: 'online',
          payment_type: 'payment',
          amount: chaletPaidAmountInLkr(booking, ratesResult.data || []),
          account_transaction_id: booking.online_account_transaction_id,
          account: null,
          event: { name: 'Website Chalet Booking' },
        })),
        ...bookingPayments.map((payment: any) => ({
          id: payment.id,
          paid_at: payment.paid_at,
          receipt_number: payment.booking_ref || 'Chalet Booking',
          payer_name: payment.customer_name || 'Guest',
          payment_method: payment.payment_method,
          payment_type: 'payment',
          amount: Number(payment.amount || 0),
          account_transaction_id: payment.account_transaction_id,
          account: payment.account || null,
          event: { name: 'Chalet Booking' },
        })),
      ].sort((a: any, b: any) => new Date(b.paid_at || 0).getTime() - new Date(a.paid_at || 0).getTime()),
      transfers,
      accounts: accountsResult.data || [],
      settings: settings || { card_account_id: null, online_account_id: null },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { card_account_id, online_account_id } = await request.json();
    if (!card_account_id && !online_account_id) return NextResponse.json({ error: 'Select at least one payment account.' }, { status: 400 });

    for (const accountId of [card_account_id, online_account_id].filter(Boolean)) {
      const { data: account } = await supabase.from('accounts').select('id').eq('id', accountId).eq('is_active', true).maybeSingle();
      if (!account) return NextResponse.json({ error: 'Active account not found.' }, { status: 404 });
    }

    const { error } = await supabase
      .from('front_desk_account_settings')
      .upsert({
        singleton: true,
        ...(card_account_id !== undefined ? { card_account_id } : {}),
        ...(online_account_id !== undefined ? { online_account_id } : {}),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'singleton' });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { account_id, amount, notes } = await request.json();
    const numericAmount = Number(amount);
    if (!account_id || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'A destination account and valid amount are required.' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('transfer_front_desk_cash', {
      p_account_id: account_id,
      p_amount: numericAmount,
      p_notes: notes || '',
      p_user_id: user.id,
    });
    if (error) throw error;

    return NextResponse.json({ transfer_id: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
