import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth-utils';
import { chaletOutstandingLkr, chaletPaymentHistory } from '@/lib/chalet-billing';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!,
);

type GuestPayment = {
  id: string;
  paid_at: string | null;
  source: string;
  reference: string | null;
  payment_method: string | null;
  amount: number;
  account_name: string | null;
  recorded_by: string | null;
  note: string | null;
};

// Every payment related to one stay, in LKR, oldest first:
// - chalet booking payments (booking form deposits, website payment)
// - Front Desk bill settlements for the guest during the stay
// - restaurant bills the guest paid directly at the restaurant during the stay
export async function GET(request: Request) {
  try {
    const token = (await cookies()).get('auth_token')?.value;
    if (!token || !(await verifyToken(token))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = new URL(request.url).searchParams;
    const type = params.get('type');
    const recordId = params.get('record_id');
    if (!recordId || !['reservation', 'chalet'].includes(type || '')) {
      return NextResponse.json({ error: 'A valid stay is required.' }, { status: 400 });
    }

    const payments: GuestPayment[] = [];
    let stay: any;
    let customerId: string | null = null;
    // Still to pay for this stay itself (room or chalet), in LKR.
    let stayBalance = 0;

    if (type === 'reservation') {
      const { data, error } = await supabase.from('reservations').select('*').eq('id', recordId).single();
      if (error) throw error;
      stay = data;
      customerId = stay.customer_id || null;
      stayBalance = stay.payment_status === 'paid' ? 0 : Number(stay.total_cost || 0);
    } else {
      const [bookingResult, ratesResult, rowsResult] = await Promise.all([
        supabase.from('chalet_bookings').select('*').eq('id', recordId).single(),
        supabase.from('chalet_rates').select('package_id,room_category_id,occupancy_type_id,usd_to_lkr_rate'),
        supabase
          .from('chalet_booking_payments')
          .select('id,amount,payment_method,paid_at,account:accounts(name),user:users(name)')
          .eq('booking_id', recordId)
          .order('paid_at', { ascending: true }),
      ]);
      if (bookingResult.error) throw bookingResult.error;
      stay = bookingResult.data;
      stayBalance = chaletOutstandingLkr(stay, ratesResult.data || []);
      // Tolerates the payments table not existing before its migration.
      const rows = rowsResult.error ? [] : rowsResult.data || [];
      chaletPaymentHistory(stay, rows, ratesResult.data || []).forEach(payment => {
        payments.push({
          id: payment.id,
          paid_at: payment.paid_at,
          source: payment.label === 'Booking payment' ? 'Chalet booking' : payment.label,
          reference: stay.booking_ref || null,
          payment_method: payment.payment_method,
          amount: payment.amount,
          account_name: payment.account_name || (payment.payment_method === 'cash' && payment.label === 'Booking payment' ? 'Front Desk cash' : null),
          recorded_by: payment.recorded_by,
          note: null,
        });
      });
      // Chalet bookings store the guest's details, not a customer id.
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', String(stay.customer_name || '').trim())
        .limit(1)
        .maybeSingle();
      customerId = customer?.id || null;
    }

    if (customerId) {
      // Stay dates are local (Asia/Colombo) days.
      const from = `${stay.check_in_date}T00:00:00+05:30`;
      const to = `${stay.check_out_date}T23:59:59+05:30`;
      const [billsResult, ordersResult] = await Promise.all([
        supabase
          .from('guest_bill_history')
          .select('id,bill_number,total,payment_method,paid_at,items')
          .eq('customer_id', customerId)
          .gte('paid_at', from)
          .lte('paid_at', to),
        supabase
          .from('orders')
          .select('id,bill_number,confirmed_total,total_price,payment_method,paid_at,table_number')
          .eq('customer_id', customerId)
          .eq('status', 'closed')
          .gte('paid_at', from)
          .lte('paid_at', to),
      ]);

      (billsResult.error ? [] : billsResult.data || []).forEach((bill: any) => {
        const categories = Array.from(new Set((Array.isArray(bill.items) ? bill.items : []).map((item: any) => item.category).filter(Boolean)));
        payments.push({
          id: bill.id,
          paid_at: bill.paid_at,
          source: 'Front Desk bill',
          reference: bill.bill_number,
          payment_method: bill.payment_method,
          amount: Number(bill.total || 0),
          account_name: bill.payment_method === 'cash' ? 'Front Desk cash' : null,
          recorded_by: null,
          note: categories.length ? categories.join(', ') : null,
        });
      });

      (ordersResult.error ? [] : ordersResult.data || []).forEach((order: any) => {
        payments.push({
          id: order.id,
          paid_at: order.paid_at,
          source: 'Restaurant',
          reference: order.bill_number || `REST-${String(order.id).slice(0, 8).toUpperCase()}`,
          payment_method: order.payment_method,
          amount: Number(order.confirmed_total ?? order.total_price ?? 0),
          account_name: null,
          recorded_by: null,
          note: order.table_number ? `Table ${order.table_number}` : null,
        });
      });
    }

    // Other charges the Front Desk bill will collect at settlement: restaurant
    // orders charged to the room and services added to the bill.
    let restaurantBalance = 0;
    let servicesBalance = 0;
    if (customerId) {
      const [openOrders, openServices] = await Promise.all([
        supabase
          .from('orders')
          .select('confirmed_total,total_price')
          .eq('customer_id', customerId)
          .in('status', ['open', 'billed', 'room_charge'])
          .not('waiter_name', 'like', 'Package Meal|%'),
        supabase.from('service_incomes').select('amount').eq('customer_id', customerId).eq('payment_status', 'add_to_bill'),
      ]);
      restaurantBalance = (openOrders.error ? [] : openOrders.data || []).reduce((sum: number, order: any) => sum + Number(order.confirmed_total ?? order.total_price ?? 0), 0);
      servicesBalance = (openServices.error ? [] : openServices.data || []).reduce((sum: number, service: any) => sum + Number(service.amount || 0), 0);
    }
    const round2 = (value: number) => Math.round(value * 100) / 100;

    // Undated entries (older payments) first, then by date and time.
    payments.sort((a, b) => (a.paid_at ? new Date(a.paid_at).getTime() : 0) - (b.paid_at ? new Date(b.paid_at).getTime() : 0));

    return NextResponse.json({
      payments,
      total: round2(payments.reduce((sum, payment) => sum + payment.amount, 0)),
      balance: {
        stay: round2(stayBalance),
        restaurant: round2(restaurantBalance),
        services: round2(servicesBalance),
        total: round2(stayBalance + restaurantBalance + servicesBalance),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
